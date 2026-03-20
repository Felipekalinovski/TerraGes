import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';
import {
  LayoutDashboard,
  Truck,
  Home,
  Wallet,
  Hammer,
  ChevronLeft,
  X,
  LogOut,
  Sparkles,
  CalendarDays,
  Wrench,
  Users,
  BarChart2,
  MapPin,
  ClipboardList,
  Menu,
  Settings
} from 'lucide-react';

// Context for shared layout state
interface LayoutContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  userProfile: UserProfile | null;
  isActive: (path: string) => boolean;
  navigate: (path: string) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within a Layout provider');
  return context;
};

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export const Layout: React.FC<LayoutProps> & {
  Header: React.FC<HeaderProps>;
  Sidebar: React.FC;
  Content: React.FC<{ children: React.ReactNode }>;
  Navigation: React.FC;
} = ({ children, hideNav = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    userService.getCurrentProfile().then(setUserProfile);
  }, []);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const contextValue = {
    isSidebarOpen,
    setIsSidebarOpen,
    userProfile,
    isActive,
    navigate: (path: string) => {
      navigate(path);
      setIsSidebarOpen(false);
    }
  };

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className="flex flex-col min-h-screen bg-brand-dark text-white max-w-md mx-auto relative shadow-glass overflow-hidden font-sans">
        {/* Ambient background glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[30%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative flex flex-col flex-1 z-10">
          {children}
          {!hideNav && <Layout.Navigation />}
        </div>
        
        <Layout.Sidebar />
      </div>
    </LayoutContext.Provider>
  );
};

interface HeaderProps {
  title: string;
  subTitle?: string;
  showBack?: boolean;
  actions?: React.ReactNode;
}

Layout.Header = ({ title, subTitle, showBack, actions }) => {
  const { setIsSidebarOpen, navigate, userProfile } = useLayout();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between p-4 bg-brand-dark/80 backdrop-blur-xl border-b border-white/5 h-18">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
            <Menu size={24} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-heading font-black tracking-tight uppercase leading-none text-white drop-shadow-neon">
            {title}
          </h1>
          {subTitle && <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">{subTitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <button 
          onClick={() => navigate('/settings/profile')}
          className="size-9 rounded-full border-2 border-white/10 hover:border-primary/50 transition-all overflow-hidden p-0.5 bg-surface-dark"
        >
          <img 
            src={userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || 'U')}&background=00E599&color=000`}
            className="size-full rounded-full object-cover"
            alt="Profile"
          />
        </button>
      </div>
    </header>
  );
};

Layout.Sidebar = () => {
  const { isSidebarOpen, setIsSidebarOpen, userProfile, isActive, navigate } = useLayout();
  const { signOut } = useAuth();

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Início', path: '/dashboard' },
    { icon: <Sparkles size={20} />, label: 'Assistente IA', path: '/chat' },
    { icon: <CalendarDays size={20} />, label: 'Agenda', path: '/schedule' },
    { icon: <Truck size={20} />, label: 'Minha Frota', path: '/fleet' },
    { icon: <Wrench size={20} />, label: 'Manutenção', path: '/maintenance' },
    { icon: <Users size={20} />, label: 'Equipe', path: '/employees' },
    { icon: <ClipboardList size={20} />, label: 'Ordens de Serviço', path: '/service-orders' },
    { icon: <MapPin size={20} />, label: 'Gerenciar Obras', path: '/settings/projects' },
    { icon: <Hammer size={20} />, label: 'Diário de Obra', path: '/rdo' },
    { icon: <Wallet size={20} />, label: 'Financeiro', path: '/finance' },
    { icon: <BarChart2 size={20} />, label: 'Relatórios', path: '/reports' },
    { icon: <Settings size={20} />, label: 'Configurações', path: '/settings' },
  ];

  return (
    <>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`fixed top-0 left-0 bottom-0 w-72 bg-surface-dark/95 backdrop-blur-2xl z-50 shadow-2xl transform transition-transform duration-500 ease-out border-r border-white/5 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-black shadow-neon">
              <Hammer size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-heading font-black tracking-tight text-white uppercase italic">TerraGes</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><X size={20} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all duration-300 group ${isActive(item.path) 
                ? 'bg-primary/10 text-primary border border-primary/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span className={isActive(item.path) ? 'text-primary' : 'text-gray-500 group-hover:text-primary transition-colors'}>{item.icon}</span>
              <span className="text-sm font-bold tracking-tight uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 bg-black/40 border-t border-white/5 mt-auto">
          <button onClick={async () => { await signOut(); navigate('/login'); }} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-negative/10 text-negative hover:bg-negative/20 text-xs font-black uppercase tracking-widest transition-all">
            <LogOut size={16} /> Sair da Conta
          </button>
        </div>
      </aside>
    </>
  );
};

Layout.Content = ({ children }) => (
  <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
    {children}
  </main>
);

Layout.Navigation = () => {
  const { navigate, isActive, setIsSidebarOpen } = useLayout();

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 bg-surface-dark/80 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex justify-between items-center shadow-glass">
      <button onClick={() => navigate('/dashboard')} className={`flex flex-col items-center gap-1 transition-all ${isActive('/dashboard') ? 'text-primary scale-110 drop-shadow-neon' : 'text-gray-500'}`}>
        <LayoutDashboard size={22} strokeWidth={isActive('/dashboard') ? 3 : 2} />
        <span className="text-[8px] font-black uppercase tracking-tighter text-current">Início</span>
      </button>
      <button onClick={() => navigate('/fleet')} className={`flex flex-col items-center gap-1 transition-all ${isActive('/fleet') ? 'text-primary' : 'text-gray-500'}`}>
        <Truck size={22} strokeWidth={isActive('/fleet') ? 2.5 : 2} />
        <span className="text-[8px] font-black uppercase tracking-tighter text-current">Frota</span>
      </button>
      <button onClick={() => navigate('/rdo')} className={`flex flex-col items-center gap-1 transition-all ${isActive('/rdo') ? 'text-primary' : 'text-gray-500'}`}>
        <Home size={22} strokeWidth={isActive('/rdo') ? 2.5 : 2} />
        <span className="text-[8px] font-black uppercase tracking-tighter text-current">Obras</span>
      </button>
      <button onClick={() => navigate('/finance')} className={`flex flex-col items-center gap-1 transition-all ${isActive('/finance') ? 'text-primary' : 'text-gray-500'}`}>
        <Wallet size={22} strokeWidth={isActive('/finance') ? 2.5 : 2} />
        <span className="text-[8px] font-black uppercase tracking-tighter text-current">Dinheiro</span>
      </button>
      <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary transition-colors">
        <Menu size={22} />
        <span className="text-[8px] font-black uppercase tracking-tighter text-current">Mais</span>
      </button>
    </nav>
  );
};
