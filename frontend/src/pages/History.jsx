import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  History as HistoryIcon, 
  Download, 
  Trash2, 
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Search
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Fetch history error:', error);
      toast.error("Błąd pobierania historii");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await axios.delete(`${API}/history/${deleteId}`);
      setHistory(history.filter(h => h.id !== deleteId));
      toast.success("Usunięto z historii");
    } catch (error) {
      toast.error("Błąd usuwania");
    } finally {
      setDeleteId(null);
    }
  };

  const handleExport = async (id, format) => {
    try {
      const response = await axios.get(`${API}/export/${id}?format=${format}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export_${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Wyeksportowano do ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Błąd eksportu");
    }
  };

  const handleClearAll = async () => {
    try {
      await axios.delete(`${API}/history`);
      setHistory([]);
      toast.success("Historia wyczyszczona");
    } catch (error) {
      toast.error("Błąd czyszczenia historii");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = history.filter(item => 
    item.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.source_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatusBadge = ({ status }) => {
    const variants = {
      success: { icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200" },
      error: { icon: AlertTriangle, className: "bg-red-100 text-red-700 border-red-200" },
      warning: { icon: AlertTriangle, className: "bg-amber-100 text-amber-700 border-amber-200" }
    };
    const variant = variants[status] || variants.success;
    const Icon = variant.icon;
    
    return (
      <Badge variant="outline" className={`${variant.className} font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {status === 'success' ? 'Sukces' : status === 'error' ? 'Błąd' : 'Ostrzeżenie'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title" data-testid="history-title">Historia konwersji</h1>
          <p className="page-description">
            Przeglądaj i eksportuj poprzednie konwersje
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHistory}
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          {history.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleClearAll}
              data-testid="clear-all-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Wyczyść
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Szukaj po nazwie pliku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-slate-500" />
            Ostatnie konwersje ({filteredHistory.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-slate-600">Ładowanie historii...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 mb-2">Brak historii konwersji</p>
              <p className="text-sm text-slate-500">Przekonwertuj swój pierwszy plik JPK_VAT</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Plik</TableHead>
                    <TableHead className="font-semibold">Konwersja</TableHead>
                    <TableHead className="font-semibold">Rekordy</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => (
                    <TableRow key={item.id} className="table-row-hover" data-testid={`history-row-${item.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-700 truncate max-w-[200px]">
                            {item.original_filename}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">
                            {item.source_type}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="font-mono bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">
                            {item.target_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{item.records_count}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {formatDate(item.timestamp)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`export-btn-${item.id}`}>
                                <Download className="w-4 h-4 mr-1" />
                                Eksport
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExport(item.id, 'xlsx')}>
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Eksportuj do Excel (.xlsx)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport(item.id, 'csv')}>
                                <FileText className="w-4 h-4 mr-2" />
                                Eksportuj do CSV
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-400 hover:text-red-500"
                            onClick={() => setDeleteId(item.id)}
                            data-testid={`delete-btn-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć tę konwersję z historii? 
              Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
