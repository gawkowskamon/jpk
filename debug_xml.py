#!/usr/bin/env python3

import sys
sys.path.append('/app/backend')

from lxml import etree
import traceback

def test_xml_parsing():
    """Test XML parsing with the sample file"""
    
    xml_file = "/app/tests/sample_jpk_vat.xml"
    
    try:
        with open(xml_file, 'rb') as f:
            content = f.read()
        
        print("✅ File read successfully")
        print(f"File size: {len(content)} bytes")
        
        # Try to parse XML
        root = etree.fromstring(content)
        print("✅ XML parsed successfully")
        print(f"Root tag: {root.tag}")
        print(f"Namespace map: {root.nsmap}")
        
        # Test namespace detection
        nsmap = root.nsmap
        ns = None
        for prefix, uri in nsmap.items():
            if 'crd.gov.pl' in uri or 'mf.gov.pl' in uri:
                ns = {'ns': uri}
                break
        
        if ns is None:
            ns = {'ns': nsmap.get(None, '')}
        
        print(f"Detected namespace: {ns}")
        
        # Test finding elements with different methods
        print("\n--- Testing element finding ---")
        
        # Method 1: With namespace
        header1 = root.find('.//ns:Naglowek', ns)
        print(f"Header with ns: {header1}")
        
        # Method 2: With local-name
        header2 = root.find('.//*[local-name()="Naglowek"]')
        print(f"Header with local-name: {header2}")
        
        # Method 3: Direct search
        headers = root.findall('.//*[local-name()="Naglowek"]')
        print(f"All headers found: {len(headers)}")
        
        # Test sales records
        sales_rows = root.findall('.//*[local-name()="SprzedazWiersz"]')
        print(f"Sales rows found: {len(sales_rows)}")
        
        if sales_rows:
            first_row = sales_rows[0]
            print(f"First sales row children: {[child.tag for child in first_row]}")
            
            # Test get_xml_text equivalent
            lp_elem = first_row.find('.//*[local-name()="LpSprzedazy"]')
            print(f"LP element: {lp_elem}")
            if lp_elem is not None:
                print(f"LP text: {lp_elem.text}")
        
        print("✅ All XML parsing tests passed")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print(f"Exception type: {type(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_xml_parsing()
    sys.exit(0 if success else 1)