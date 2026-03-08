from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from lxml import etree
import io
import json
import xlsxwriter

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define Models
class ConversionHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_filename: str
    source_type: str  # JPK_VAT
    target_type: str  # JPK_FA
    source_version: str
    target_version: str
    records_count: int
    status: str  # success, error, warning
    message: Optional[str] = None
    converted_data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversionPreview(BaseModel):
    filename: str
    source_type: str
    source_version: str
    records_count: int
    invoices: List[Dict[str, Any]]
    validation_errors: List[str]
    validation_warnings: List[str]

class ConvertRequest(BaseModel):
    invoices: List[Dict[str, Any]]
    target_version: str = "FA(4)"

# JPK XML Namespaces
JPK_NAMESPACES = {
    'tns': 'http://crd.gov.pl/wzor/2020/05/08/9393/',
    'etd': 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2018/08/24/eD/DefinicjeTypy/',
    'kck': 'http://crd.gov.pl/xml/schematy/cdp/2016/02/01/KodyCezaKrajow/',
    'xsi': 'http://www.w3.org/2001/XMLSchema-instance'
}

def parse_jpk_vat(xml_content: bytes) -> dict:
    """Parse JPK_VAT XML file and extract invoice data"""
    try:
        # Try to parse XML, handle encoding issues
        if xml_content.startswith(b'\xef\xbb\xbf'):
            xml_content = xml_content[3:]  # Remove BOM
        
        # Try different parsers
        parser = etree.XMLParser(recover=True, encoding='utf-8')
        try:
            root = etree.fromstring(xml_content, parser=parser)
        except:
            # Try with different encoding
            try:
                xml_str = xml_content.decode('utf-8', errors='ignore')
                root = etree.fromstring(xml_str.encode('utf-8'), parser=parser)
            except:
                xml_str = xml_content.decode('cp1250', errors='ignore')
                root = etree.fromstring(xml_str.encode('utf-8'), parser=parser)
                
    except etree.XMLSyntaxError as e:
        logger.error(f"XML Syntax Error: {str(e)}")
        raise ValueError(f"Błąd parsowania XML: {str(e)}")
    except Exception as e:
        logger.error(f"General parsing error: {str(e)}")
        raise ValueError(f"Błąd przetwarzania pliku: {str(e)}")
    
    # Detect namespace
    nsmap = root.nsmap
    default_ns = nsmap.get(None, '')
    
    result = {
        'version': 'VAT(4)',
        'header': {},
        'subject': {},
        'invoices_sale': [],
        'invoices_purchase': [],
        'validation_errors': [],
        'validation_warnings': []
    }
    
    # Try to extract header info
    try:
        # Try with namespace first, then without
        header = None
        if default_ns:
            header = root.find(f'.//{{{default_ns}}}Naglowek')
        if header is None:
            # Search all elements for Naglowek
            for elem in root.iter():
                if elem.tag.endswith('Naglowek'):
                    header = elem
                    break
        
        if header is not None:
            kod_formularza = None
            for elem in header.iter():
                if elem.tag.endswith('KodFormularza'):
                    kod_formularza = elem
                    break
            if kod_formularza is not None:
                result['version'] = kod_formularza.get('wersjaSchemy', 'VAT(4)')
    except Exception:
        pass
    
    # Try to extract subject info
    try:
        podmiot = None
        if default_ns:
            podmiot = root.find(f'.//{{{default_ns}}}Podmiot1')
        if podmiot is None:
            # Search all elements for Podmiot1
            for elem in root.iter():
                if elem.tag.endswith('Podmiot1'):
                    podmiot = elem
                    break
        
        if podmiot is not None:
            nip = None
            nazwa = None
            for elem in podmiot.iter():
                if elem.tag.endswith('NIP'):
                    nip = elem
                elif elem.tag.endswith('PelnaNazwa'):
                    nazwa = elem
                elif elem.tag.endswith('Nazwa') and nazwa is None:
                    nazwa = elem
            
            result['subject'] = {
                'nip': nip.text if nip is not None else '',
                'nazwa': nazwa.text if nazwa is not None else ''
            }
    except Exception:
        pass
    
    # Extract sales records (SprzedazWiersz)
    sales_rows = []
    for elem in root.iter():
        tag_local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        if tag_local in ('SprzedazWiersz', 'Faktura', 'FakturaWiersz'):
            sales_rows.append(elem)
    
    for row in sales_rows:
        invoice = extract_invoice_data(row, 'sale')
        if invoice:
            result['invoices_sale'].append(invoice)
    
    # Extract purchase records (ZakupWiersz)
    purchase_rows = []
    for elem in root.iter():
        tag_local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        if tag_local in ('ZakupWiersz',):
            purchase_rows.append(elem)
    
    for row in purchase_rows:
        invoice = extract_invoice_data(row, 'purchase')
        if invoice:
            result['invoices_purchase'].append(invoice)
    
    # If no invoices found, check for JPK_FA format (reverse conversion)
    if not result['invoices_sale'] and not result['invoices_purchase']:
        for elem in root.iter():
            tag_local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
            if tag_local == 'Faktura':
                invoice = extract_jpk_fa_invoice(elem)
                if invoice:
                    result['invoices_sale'].append(invoice)
    
    return result

def extract_jpk_fa_invoice(elem) -> dict:
    """Extract invoice data from JPK_FA Faktura element"""
    data = {
        'type': 'sale',
        'lp': '',
        'nip_kontrahenta': get_xml_text(elem, 'P_3C') or get_xml_text(elem, 'NIP') or '',
        'nazwa_kontrahenta': get_xml_text(elem, 'P_3A') or get_xml_text(elem, 'Nazwa') or '',
        'dowod_sprzedazy': get_xml_text(elem, 'P_2A') or get_xml_text(elem, 'NrFaktury') or '',
        'data_wystawienia': get_xml_text(elem, 'P_1') or get_xml_text(elem, 'DataWystawienia') or '',
        'data_sprzedazy': get_xml_text(elem, 'P_6') or get_xml_text(elem, 'DataSprzedazy') or '',
        'k_19': get_xml_text(elem, 'P_13_1') or '0',
        'k_20': get_xml_text(elem, 'P_14_1') or '0',
        'k_17': get_xml_text(elem, 'P_13_2') or '0',
        'k_18': get_xml_text(elem, 'P_14_2') or '0',
        'k_15': get_xml_text(elem, 'P_13_3') or '0',
        'k_16': get_xml_text(elem, 'P_14_3') or '0',
        'k_10': '0',
        'kwota_netto': '0',
        'kwota_vat': '0',
        'kwota_brutto': get_xml_text(elem, 'P_15') or '0'
    }
    
    # Calculate totals
    try:
        netto = float(data['k_19'] or 0) + float(data['k_17'] or 0) + float(data['k_15'] or 0)
        vat = float(data['k_20'] or 0) + float(data['k_18'] or 0) + float(data['k_16'] or 0)
        if netto == 0 and float(data['kwota_brutto'] or 0) > 0:
            brutto = float(data['kwota_brutto'])
            vat = round(brutto * 0.23 / 1.23, 2)  # Estimate VAT 23%
            netto = brutto - vat
        data['kwota_netto'] = str(round(netto, 2))
        data['kwota_vat'] = str(round(vat, 2))
        if float(data['kwota_brutto']) == 0:
            data['kwota_brutto'] = str(round(netto + vat, 2))
    except (ValueError, TypeError):
        pass
    
    return data

def extract_invoice_data(row, invoice_type: str) -> dict:
    """Extract invoice data from XML row"""
    data = {
        'type': invoice_type,
        'lp': get_xml_text(row, 'LpSprzedazy') or get_xml_text(row, 'LpZakupu') or '',
        'nip_kontrahenta': get_xml_text(row, 'NrKontrahenta') or '',
        'nazwa_kontrahenta': get_xml_text(row, 'NazwaKontrahenta') or '',
        'dowod_sprzedazy': get_xml_text(row, 'DowodSprzedazy') or get_xml_text(row, 'DowodZakupu') or '',
        'data_wystawienia': get_xml_text(row, 'DataWystawienia') or '',
        'data_sprzedazy': get_xml_text(row, 'DataSprzedazy') or get_xml_text(row, 'DataZakupu') or '',
        'k_19': get_xml_text(row, 'K_19') or '0',  # Podstawa opodatkowania 23%
        'k_20': get_xml_text(row, 'K_20') or '0',  # VAT 23%
        'k_17': get_xml_text(row, 'K_17') or '0',  # Podstawa opodatkowania 8%
        'k_18': get_xml_text(row, 'K_18') or '0',  # VAT 8%
        'k_15': get_xml_text(row, 'K_15') or '0',  # Podstawa opodatkowania 5%
        'k_16': get_xml_text(row, 'K_16') or '0',  # VAT 5%
        'k_10': get_xml_text(row, 'K_10') or '0',  # Wartość netto ZW
        'kwota_netto': '0',
        'kwota_vat': '0',
        'kwota_brutto': '0'
    }
    
    # Calculate totals
    try:
        netto = float(data['k_19'] or 0) + float(data['k_17'] or 0) + float(data['k_15'] or 0) + float(data['k_10'] or 0)
        vat = float(data['k_20'] or 0) + float(data['k_18'] or 0) + float(data['k_16'] or 0)
        data['kwota_netto'] = str(round(netto, 2))
        data['kwota_vat'] = str(round(vat, 2))
        data['kwota_brutto'] = str(round(netto + vat, 2))
    except (ValueError, TypeError):
        pass
    
    return data

def get_xml_text(element, tag_name: str) -> Optional[str]:
    """Get text content from XML element by tag name"""
    # Search through all child elements
    for elem in element.iter():
        if elem.tag.endswith(tag_name):
            return elem.text
    return None

def convert_to_jpk_fa(data: dict, target_version: str = "FA(4)") -> bytes:
    """Convert parsed JPK_VAT data to JPK_FA XML format"""
    
    # Create root element for JPK_FA
    nsmap = {
        None: 'http://crd.gov.pl/wzor/2021/11/29/11089/',
        'etd': 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2021/06/08/eD/DefinicjeTypy/',
        'xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    }
    
    root = etree.Element('JPK', nsmap=nsmap)
    
    # Add header
    naglowek = etree.SubElement(root, 'Naglowek')
    kod_form = etree.SubElement(naglowek, 'KodFormularza')
    kod_form.text = 'JPK_FA'
    kod_form.set('kodSystemowy', 'JPK_FA (4)')
    kod_form.set('wersjaSchemy', '1-0')
    
    wariant_form = etree.SubElement(naglowek, 'WariantFormularza')
    wariant_form.text = '4'
    
    cel_zlozenia = etree.SubElement(naglowek, 'CelZlozenia')
    cel_zlozenia.text = '1'
    
    data_wytw = etree.SubElement(naglowek, 'DataWytworzeniaJPK')
    data_wytw.text = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
    
    data_od = etree.SubElement(naglowek, 'DataOd')
    data_do = etree.SubElement(naglowek, 'DataDo')
    
    # Get date range from invoices
    all_invoices = data.get('invoices_sale', []) + data.get('invoices_purchase', [])
    dates = [inv.get('data_sprzedazy') or inv.get('data_wystawienia') for inv in all_invoices if inv.get('data_sprzedazy') or inv.get('data_wystawienia')]
    if dates:
        dates = sorted([d for d in dates if d])
        data_od.text = dates[0] if dates else datetime.now().strftime('%Y-%m-01')
        data_do.text = dates[-1] if dates else datetime.now().strftime('%Y-%m-%d')
    else:
        data_od.text = datetime.now().strftime('%Y-%m-01')
        data_do.text = datetime.now().strftime('%Y-%m-%d')
    
    # Add subject
    podmiot = etree.SubElement(root, 'Podmiot1')
    podmiot_id = etree.SubElement(podmiot, 'IdentyfikatorPodmiotu')
    nip = etree.SubElement(podmiot_id, '{http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2021/06/08/eD/DefinicjeTypy/}NIP')
    nip.text = data.get('subject', {}).get('nip', '')
    nazwa = etree.SubElement(podmiot_id, '{http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2021/06/08/eD/DefinicjeTypy/}PelnaNazwa')
    nazwa.text = data.get('subject', {}).get('nazwa', '')
    
    # Add invoices
    for idx, inv in enumerate(all_invoices, 1):
        faktura = etree.SubElement(root, 'Faktura')
        
        # Invoice header
        kod_waluty = etree.SubElement(faktura, 'KodWaluty')
        kod_waluty.text = 'PLN'
        
        p1 = etree.SubElement(faktura, 'P_1')
        p1.text = inv.get('data_wystawienia', datetime.now().strftime('%Y-%m-%d'))
        
        p2a = etree.SubElement(faktura, 'P_2A')
        p2a.text = inv.get('dowod_sprzedazy', f'FV/{idx}/2024')
        
        # Buyer info
        p3a = etree.SubElement(faktura, 'P_3A')
        p3a.text = inv.get('nazwa_kontrahenta', '')
        
        p3b = etree.SubElement(faktura, 'P_3B')
        p3b.text = ''  # Address - not available in JPK_VAT
        
        p3c = etree.SubElement(faktura, 'P_3C')
        p3c.text = inv.get('nip_kontrahenta', '')
        
        # Amounts
        p_13_1 = etree.SubElement(faktura, 'P_13_1')
        p_13_1.text = inv.get('k_19', '0')
        
        p_14_1 = etree.SubElement(faktura, 'P_14_1')
        p_14_1.text = inv.get('k_20', '0')
        
        p_15 = etree.SubElement(faktura, 'P_15')
        p_15.text = inv.get('kwota_brutto', '0')
        
        # Invoice type
        rodzaj_faktury = etree.SubElement(faktura, 'RodzajFaktury')
        rodzaj_faktury.text = 'VAT'
    
    return etree.tostring(root, pretty_print=True, xml_declaration=True, encoding='UTF-8')

@api_router.get("/")
async def root():
    return {"message": "JPK Converter Pro API"}

@api_router.post("/preview", response_model=ConversionPreview)
async def preview_file(file: UploadFile = File(...)):
    """Parse JPK_VAT file and return preview data"""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Plik musi być w formacie XML")
    
    try:
        content = await file.read()
        parsed_data = parse_jpk_vat(content)
        
        all_invoices = parsed_data.get('invoices_sale', []) + parsed_data.get('invoices_purchase', [])
        
        return ConversionPreview(
            filename=file.filename,
            source_type="JPK_VAT",
            source_version=parsed_data.get('version', 'VAT(4)'),
            records_count=len(all_invoices),
            invoices=all_invoices,
            validation_errors=parsed_data.get('validation_errors', []),
            validation_warnings=parsed_data.get('validation_warnings', [])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error parsing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd przetwarzania pliku: {str(e)}")

@api_router.post("/convert")
async def convert_file(file: UploadFile = File(...), target_version: str = "FA(4)"):
    """Convert JPK_VAT to JPK_FA and save to history"""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Plik musi być w formacie XML")
    
    try:
        content = await file.read()
        parsed_data = parse_jpk_vat(content)
        
        # Convert to JPK_FA
        converted_xml = convert_to_jpk_fa(parsed_data, target_version)
        
        all_invoices = parsed_data.get('invoices_sale', []) + parsed_data.get('invoices_purchase', [])
        
        # Save to history
        history_entry = ConversionHistory(
            original_filename=file.filename,
            source_type="JPK_VAT",
            target_type="JPK_FA",
            source_version=parsed_data.get('version', 'VAT(4)'),
            target_version=target_version,
            records_count=len(all_invoices),
            status="success",
            message="Konwersja zakończona pomyślnie",
            converted_data={
                'invoices': all_invoices,
                'subject': parsed_data.get('subject', {})
            }
        )
        
        doc = history_entry.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.conversion_history.insert_one(doc)
        
        # Return the converted file
        return StreamingResponse(
            io.BytesIO(converted_xml),
            media_type="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename=JPK_FA_{file.filename}",
                "X-Conversion-Id": history_entry.id
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error converting file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd konwersji: {str(e)}")

@api_router.get("/history", response_model=List[ConversionHistory])
async def get_history(limit: int = 50, skip: int = 0):
    """Get conversion history"""
    history = await db.conversion_history.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    for item in history:
        if isinstance(item.get('timestamp'), str):
            item['timestamp'] = datetime.fromisoformat(item['timestamp'])
    
    return history

@api_router.get("/history/{conversion_id}")
async def get_history_item(conversion_id: str):
    """Get single conversion history item"""
    item = await db.conversion_history.find_one({"id": conversion_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono konwersji")
    
    if isinstance(item.get('timestamp'), str):
        item['timestamp'] = datetime.fromisoformat(item['timestamp'])
    
    return item

@api_router.delete("/history/{conversion_id}")
async def delete_history_item(conversion_id: str):
    """Delete a conversion from history"""
    result = await db.conversion_history.delete_one({"id": conversion_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nie znaleziono konwersji")
    return {"message": "Konwersja usunięta", "id": conversion_id}

@api_router.delete("/history")
async def clear_history():
    """Clear all conversion history"""
    result = await db.conversion_history.delete_many({})
    return {"message": f"Usunięto {result.deleted_count} rekordów"}

@api_router.get("/export/{conversion_id}")
async def export_conversion(conversion_id: str, format: str = "xlsx"):
    """Export conversion data to CSV or Excel"""
    item = await db.conversion_history.find_one({"id": conversion_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Nie znaleziono konwersji")
    
    invoices = item.get('converted_data', {}).get('invoices', [])
    
    if format == "csv":
        # Generate CSV
        output = io.StringIO()
        if invoices:
            headers = list(invoices[0].keys())
            output.write(';'.join(headers) + '\n')
            for inv in invoices:
                row = [str(inv.get(h, '')) for h in headers]
                output.write(';'.join(row) + '\n')
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{conversion_id}.csv"}
        )
    else:
        # Generate Excel
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        worksheet = workbook.add_worksheet('Faktury')
        
        # Header format
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#0F172A',
            'font_color': 'white',
            'border': 1
        })
        
        if invoices:
            headers = ['LP', 'NIP Kontrahenta', 'Nazwa Kontrahenta', 'Nr Dokumentu', 
                      'Data Wystawienia', 'Data Sprzedaży', 'Netto', 'VAT', 'Brutto']
            
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
                worksheet.set_column(col, col, 15)
            
            for row, inv in enumerate(invoices, 1):
                worksheet.write(row, 0, inv.get('lp', ''))
                worksheet.write(row, 1, inv.get('nip_kontrahenta', ''))
                worksheet.write(row, 2, inv.get('nazwa_kontrahenta', ''))
                worksheet.write(row, 3, inv.get('dowod_sprzedazy', ''))
                worksheet.write(row, 4, inv.get('data_wystawienia', ''))
                worksheet.write(row, 5, inv.get('data_sprzedazy', ''))
                worksheet.write(row, 6, float(inv.get('kwota_netto', 0)))
                worksheet.write(row, 7, float(inv.get('kwota_vat', 0)))
                worksheet.write(row, 8, float(inv.get('kwota_brutto', 0)))
        
        workbook.close()
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=export_{conversion_id}.xlsx"}
        )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
