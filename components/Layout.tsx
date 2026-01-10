
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';
import {
  LayoutDashboard,
  Truck,
  Hammer,
  DollarSign,
  Menu,
  ChevronLeft,
  Settings,
  X,
  LogOut,
  Sparkles,
  CalendarDays,
  Wrench,
  Users,
  BarChart2,
  MapPin
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  actions?: React.ReactNode;
  hideNav?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  showBack = false,
  actions,
  hideNav = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const profile = await userService.getCurrentProfile();
    setUserProfile(profile);
  };

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Início', path: '/dashboard' },
    { icon: <Sparkles size={20} />, label: 'Assistente IA', path: '/chat' },
    { icon: <CalendarDays size={20} />, label: 'Agenda', path: '/schedule' },
    { icon: <Truck size={20} />, label: 'Minha Frota', path: '/fleet' },
    { icon: <Wrench size={20} />, label: 'Manutenção', path: '/maintenance' },
    { icon: <Users size={20} />, label: 'Equipe', path: '/employees' },
    { icon: <MapPin size={20} />, label: 'Gerenciar Obras', path: '/settings/projects' },
    { icon: <Hammer size={20} />, label: 'Diário de Obra', path: '/rdo' },
    { icon: <DollarSign size={20} />, label: 'Financeiro', path: '/finance' },
    { icon: <BarChart2 size={20} />, label: 'Relatórios', path: '/reports' },
    { icon: <Settings size={20} />, label: 'Configurações', path: '/settings' },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-dark text-white max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div className={`fixed top-0 left-0 bottom-0 w-72 bg-surface-dark z-50 shadow-2xl transform transition-transform duration-300 ease-in-out border-r border-white/5 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-black shadow-lg shadow-primary/20">
              <Hammer size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">TerraGes</h2>
              <p className="text-xs text-gray-400">Gestão de Obras</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all duration-200 group ${isActive(item.path)
                ? 'bg-primary text-white font-semibold shadow-md shadow-primary/10'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <span className={`${isActive(item.path) ? 'text-white' : 'text-gray-500 group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
              {isActive(item.path) && (
                <div className="ml-auto size-1.5 rounded-full bg-white/50" />
              )}
            </button>
          ))}
        </nav>

        {/* User Profile / Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <button
            onClick={() => handleNavigation('/settings/profile')}
            className="flex items-center gap-3 mb-4 px-2 w-full rounded-lg hover:bg-white/5 transition-colors cursor-pointer py-2"
          >
            <div className="size-10 rounded-full bg-gray-700 bg-cover bg-center border-2 border-primary/30" style={{ backgroundImage: `url('${userProfile?.avatar_url || 'https://picsum.photos/200'}')` }} />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-white truncate">{userProfile?.name || 'Usuário'}</p>
              <p className="text-xs text-gray-400 truncate">{userProfile?.role || 'Administrador'}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-white/5 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Sair da Conta
          </button>
        </div>
      </div>

      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between p-4 bg-brand-dark/95 backdrop-blur-sm border-b border-white/5 h-16">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
          )}
          {title && <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-6">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      {
        !hideNav && (
          <div className="sticky bottom-0 z-30 bg-surface-dark border-t border-white/10 px-6 py-3 flex justify-between items-center pb-6">
            <button
              onClick={() => navigate('/dashboard')}
              className={`flex flex-col items-center gap-1 ${isActive('/dashboard') ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LayoutDashboard size={24} strokeWidth={isActive('/dashboard') ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Início</span>
            </button>

            <button
              onClick={() => navigate('/rdo')}
              className={`flex flex-col items-center gap-1 ${isActive('/rdo') ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Hammer size={24} strokeWidth={isActive('/rdo') ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Obras</span>
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="flex flex-col items-center gap-1 -mt-8"
            >
              <div className="size-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-brand-dark text-black">
                <Sparkles size={24} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-medium text-primary">IA</span>
            </button>

            <button
              onClick={() => navigate('/finance')}
              className={`flex flex-col items-center gap-1 ${isActive('/finance') ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <DollarSign size={24} strokeWidth={isActive('/finance') ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Finanças</span>
            </button>

            <button
              onClick={() => navigate('/schedule')}
              className={`flex flex-col items-center gap-1 ${isActive('/schedule') ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <CalendarDays size={24} strokeWidth={isActive('/schedule') ? 2.5 : 2} />
              <span className="text-[10px] font-medium">Agenda</span>
            </button>
          </div>
        )
      }
    </div >
  );
};
