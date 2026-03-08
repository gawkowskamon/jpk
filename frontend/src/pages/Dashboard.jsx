import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "sonner";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Download,
  Eye,
  ArrowRightLeft,
  Loader2,
  X,
  FileJson
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [targetVersion, setTargetVersion] = useState("FA(4)");

  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      if (!uploadedFile.name.endsWith('.xml')) {
        toast.error("Nieprawidłowy format pliku", {
          description: "Wybierz plik XML z danymi JPK_VAT"
        });
        return;
      }
      setFile(uploadedFile);
      setPreview(null);
      handlePreview(uploadedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/xml': ['.xml'],
      'text/xml': ['.xml']
    },
    maxFiles: 1
  });

  const handlePreview = async (uploadedFile) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await axios.post(`${API}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(response.data);
      toast.success("Plik załadowany", {
        description: `Znaleziono ${response.data.records_count} rekordów`
      });
    } catch (error) {
      console.error('Preview error:', error);
      toast.error("Błąd wczytywania pliku", {
        description: error.response?.data?.detail || "Sprawdź czy plik jest prawidłowym JPK_VAT"
      });
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    
    setConverting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API}/convert?target_version=${targetVersion}`, 
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          responseType: 'blob'
        }
      );

      // Download the converted file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `JPK_FA_${file.name}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Konwersja zakończona!", {
        description: "Plik JPK_FA został pobrany"
      });
    } catch (error) {
      console.error('Convert error:', error);
      toast.error("Błąd konwersji", {
        description: error.response?.data?.detail || "Nie udało się przekonwertować pliku"
      });
    } finally {
      setConverting(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setPreview(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title" data-testid="page-title">Konwersja JPK_VAT → JPK_FA</h1>
        <p className="page-description">
          Prześlij plik JPK_VAT, sprawdź podgląd danych i pobierz przekonwertowany plik JPK_FA
        </p>
      </div>

      {/* Stats */}
      {preview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="stats-card-icon primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Typ źródłowy</p>
                  <p className="text-xl font-bold font-heading text-slate-900">{preview.source_type}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="stats-card-icon accent">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Wersja schematu</p>
                  <p className="text-xl font-bold font-heading text-slate-900">{preview.source_version}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="stats-card-icon success">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Liczba rekordów</p>
                  <p className="text-xl font-bold font-heading text-slate-900">{preview.records_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* File Upload Area */}
      {!file ? (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div
              {...getRootProps()}
              data-testid="dropzone"
              className={`
                p-12 text-center cursor-pointer rounded-xl transition-all duration-300
                border-2 border-dashed
                ${isDragActive 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-slate-200 hover:border-orange-400 hover:bg-slate-50'
                }
              `}
            >
              <input {...getInputProps()} data-testid="file-input" />
              <div className="flex flex-col items-center gap-4">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center
                  ${isDragActive ? 'bg-orange-100' : 'bg-slate-100'}
                `}>
                  <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-orange-500' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-700">
                    {isDragActive ? 'Upuść plik tutaj' : 'Przeciągnij plik JPK_VAT lub kliknij'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Obsługiwane formaty: XML (JPK_VAT)
                  </p>
                </div>
                <Button variant="outline" className="mt-2" data-testid="browse-btn">
                  <FileText className="w-4 h-4 mr-2" />
                  Wybierz plik
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">{file.name}</CardTitle>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={resetUpload}
              data-testid="reset-upload-btn"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Wersja docelowa:</span>
                <Select value={targetVersion} onValueChange={setTargetVersion}>
                  <SelectTrigger className="w-32" data-testid="version-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FA(4)">JPK_FA(4)</SelectItem>
                    <SelectItem value="FA(3)">JPK_FA(3)</SelectItem>
                    <SelectItem value="FA(2)">JPK_FA(2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleConvert}
                disabled={converting || loading}
                className="bg-slate-900 hover:bg-slate-800"
                data-testid="convert-btn"
              >
                {converting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                )}
                {converting ? 'Konwertowanie...' : 'Konwertuj i pobierz'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">Analizowanie pliku...</p>
          </CardContent>
        </Card>
      )}

      {/* Validation Messages */}
      {preview && (preview.validation_errors.length > 0 || preview.validation_warnings.length > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Uwagi walidacji
            </CardTitle>
          </CardHeader>
          <CardContent>
            {preview.validation_errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-red-700 mb-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{err}</span>
              </div>
            ))}
            {preview.validation_warnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2 text-amber-700 mb-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{warn}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Data Preview Table */}
      {preview && preview.invoices.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-500" />
                Podgląd danych ({preview.invoices.length} faktur)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">LP</TableHead>
                    <TableHead className="font-semibold">Typ</TableHead>
                    <TableHead className="font-semibold">NIP</TableHead>
                    <TableHead className="font-semibold">Kontrahent</TableHead>
                    <TableHead className="font-semibold">Nr dokumentu</TableHead>
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold text-right">Netto</TableHead>
                    <TableHead className="font-semibold text-right">VAT</TableHead>
                    <TableHead className="font-semibold text-right">Brutto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.invoices.map((inv, index) => (
                    <TableRow key={index} className="table-row-hover" data-testid={`invoice-row-${index}`}>
                      <TableCell className="font-mono text-xs">{inv.lp || index + 1}</TableCell>
                      <TableCell>
                        <Badge variant={inv.type === 'sale' ? 'default' : 'secondary'} className="text-xs">
                          {inv.type === 'sale' ? 'Sprzedaż' : 'Zakup'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{inv.nip_kontrahenta || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.nazwa_kontrahenta || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.dowod_sprzedazy || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.data_sprzedazy || inv.data_wystawienia || '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {parseFloat(inv.kwota_netto || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {parseFloat(inv.kwota_vat || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {parseFloat(inv.kwota_brutto || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
