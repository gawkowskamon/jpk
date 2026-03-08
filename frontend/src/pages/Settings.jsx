import { useState } from "react";
import { toast } from "sonner";
import { 
  Settings as SettingsIcon, 
  FileJson,
  Save,
  Info
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    defaultTargetVersion: "FA(4)",
    autoDownload: true,
    validateXSD: true,
    keepHistory: true
  });

  const handleSave = () => {
    localStorage.setItem('jpk_converter_settings', JSON.stringify(settings));
    toast.success("Ustawienia zapisane");
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-2xl">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title" data-testid="settings-title">Ustawienia</h1>
        <p className="page-description">
          Dostosuj preferencje konwersji i zachowanie aplikacji
        </p>
      </div>

      {/* Conversion Settings */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-slate-500" />
            Ustawienia konwersji
          </CardTitle>
          <CardDescription>
            Domyślne opcje dla nowych konwersji
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="target-version">Domyślna wersja docelowa JPK_FA</Label>
            <Select 
              value={settings.defaultTargetVersion} 
              onValueChange={(value) => setSettings({...settings, defaultTargetVersion: value})}
            >
              <SelectTrigger id="target-version" className="w-full" data-testid="default-version-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FA(4)">JPK_FA(4) - najnowsza</SelectItem>
                <SelectItem value="FA(3)">JPK_FA(3)</SelectItem>
                <SelectItem value="FA(2)">JPK_FA(2)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              Wybierz wersję schematu JPK_FA używaną domyślnie przy konwersji
            </p>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="validate-xsd">Walidacja XSD</Label>
              <p className="text-sm text-slate-500">
                Sprawdzaj zgodność z schematami XSD przed konwersją
              </p>
            </div>
            <Switch 
              id="validate-xsd"
              checked={settings.validateXSD}
              onCheckedChange={(checked) => setSettings({...settings, validateXSD: checked})}
              data-testid="validate-xsd-switch"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="auto-download">Automatyczne pobieranie</Label>
              <p className="text-sm text-slate-500">
                Automatycznie pobieraj plik po konwersji
              </p>
            </div>
            <Switch 
              id="auto-download"
              checked={settings.autoDownload}
              onCheckedChange={(checked) => setSettings({...settings, autoDownload: checked})}
              data-testid="auto-download-switch"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="keep-history">Zapisuj historię</Label>
              <p className="text-sm text-slate-500">
                Przechowuj historię konwersji do późniejszego eksportu
              </p>
            </div>
            <Switch 
              id="keep-history"
              checked={settings.keepHistory}
              onCheckedChange={(checked) => setSettings({...settings, keepHistory: checked})}
              data-testid="keep-history-switch"
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Obsługiwane wersje schematów</h4>
              <p className="text-sm text-blue-800 mb-3">
                Aplikacja obsługuje następujące wersje plików JPK:
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-blue-900">Źródłowe (JPK_VAT):</p>
                  <ul className="list-disc list-inside text-blue-800 mt-1 space-y-1">
                    <li>JPK_VAT(4) - od 2020</li>
                    <li>JPK_VAT(3)</li>
                    <li>JPK_VAT(2)</li>
                    <li>Starsze wersje</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Docelowe (JPK_FA):</p>
                  <ul className="list-disc list-inside text-blue-800 mt-1 space-y-1">
                    <li>JPK_FA(4) - najnowsza</li>
                    <li>JPK_FA(3)</li>
                    <li>JPK_FA(2)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800" data-testid="save-settings-btn">
          <Save className="w-4 h-4 mr-2" />
          Zapisz ustawienia
        </Button>
      </div>
    </div>
  );
}
