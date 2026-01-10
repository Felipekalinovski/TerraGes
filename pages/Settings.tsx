
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
    <Layout title="Configurações" hideNav={false}>
      <div className="p-4 space-y-3 pt-6">
        {menuItems.map((item, idx) => (
          <button key={idx} onClick={() => navigate(item.path)} className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-dark border border-white/5">
            <div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-[#4b3220] text-text-gold">{item.icon}</div><span className="font-medium text-white">{item.label}</span></div>
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        ))}
        <button onClick={() => navigate('/login')} className="w-full p-4 rounded-xl border border-red-500/20 text-red-400 font-medium flex items-center justify-center gap-2 mt-6"><LogOut size={20} /> Sair</button>
      </div>
    </Layout>
  );
};
