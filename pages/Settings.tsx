
import React from 'react';
import { Layout } from '../components/Layout';
import { User, Building, Bell, Link2, Lock, ChevronRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  const menuItems = [
    { icon: <User size={20} />, label: 'Perfil do Usuário', path: '/settings/profile' },
    { icon: <Building size={20} />, label: 'Gerenciar Obras', path: '/settings/projects' },
    { icon: <Building size={20} />, label: 'Configurações da Empresa', path: '/settings/company' },
    { icon: <Bell size={20} />, label: 'Notificações', path: '/settings/notifications' },
    { icon: <Link2 size={20} />, label: 'Integrações', path: '/settings/integrations' },
    { icon: <Lock size={20} />, label: 'Segurança', path: '/settings/security' },
  ];

  return (
    <Layout>
      <Layout.Header 
        title="Configurações" 
        subTitle="Ajustes de sistema, perfil e integrações externas"
      />

      <Layout.Content>
        <div className="p-4 space-y-4 pt-6 animate-in fade-in duration-700">
          <div className="flex flex-col gap-3">
            {menuItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between p-5 rounded-[28px] bg-surface-dark/40 backdrop-blur-md border border-white/5 hover:border-primary/30 transition-all group shadow-glass active:scale-[0.98]"
              >
                <div className="flex items-center gap-5">
                  <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 border border-white/5">
                    {item.icon}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-white group-hover:text-primary transition-colors tracking-tight">{item.label}</span>
                    <span className="text-[9px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Clique para configurar</span>
                  </div>
                </div>
                <div className="size-10 rounded-xl bg-white/[0.02] flex items-center justify-center group-hover:bg-white/5 transition-colors">
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-opacity" />
                </div>
              </button>
            ))}
          </div>

          <div className="px-2 mt-12 space-y-6">
            <button
              onClick={() => navigate('/login')}
              className="w-full h-16 rounded-[28px] bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-400 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
            >
              <LogOut size={22} strokeWidth={2.5} />
              Encerrar Sessão
            </button>
            
            <div className="flex flex-col items-center justify-center space-y-1 py-4 opacity-30">
              <p className="text-[10px] font-black tracking-[0.4em] text-gray-400 uppercase">TerraGes OS</p>
              <p className="text-[8px] font-medium text-gray-500 uppercase tracking-widest italic">Core Engine v1.0.2 • build oct-2025</p>
            </div>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
