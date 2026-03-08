import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { 
  FileText, 
  UploadCloud, 
  History, 
  ArrowRightLeft,
  Settings,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import "@/App.css";

// Pages
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/", icon: UploadCloud, label: "Konwersja" },
    { path: "/history", icon: History, label: "Historia" },
    { path: "/settings", icon: Settings, label: "Ustawienia" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}
      
      <aside className={`
        fixed top-0 left-0 h-full w-[280px] bg-gradient-to-b from-slate-900 to-slate-800 z-40
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-heading font-bold text-lg">JPK Converter</h1>
              <p className="text-slate-400 text-xs">VAT → FA Pro</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-orange-500/10 text-orange-500 border-l-2 border-orange-500' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <FileText className="w-4 h-4" />
            <span>Obsługuje JPK_VAT(4) i starsze</span>
          </div>
        </div>
      </aside>
    </>
  );
};

const MobileHeader = ({ onMenuClick }) => (
  <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 z-30 flex items-center justify-between px-4">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
        <ArrowRightLeft className="w-4 h-4 text-white" />
      </div>
      <span className="text-white font-heading font-bold">JPK Converter</span>
    </div>
    <button 
      onClick={onMenuClick}
      className="text-white p-2"
      data-testid="mobile-menu-btn"
    >
      <Menu className="w-6 h-6" />
    </button>
  </header>
);

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <BrowserRouter>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="lg:ml-[280px] min-h-screen pt-16 lg:pt-0">
          <div className="p-4 lg:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
        
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
