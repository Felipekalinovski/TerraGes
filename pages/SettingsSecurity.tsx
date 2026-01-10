
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Key, Loader2, Save } from 'lucide-react';
import { userService } from '../services/userService';

export const SettingsSecurity: React.FC = () => {
  const [updating, setUpdating] = useState(false);
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });

  const handleUpdate = async () => {
    if (passwords.new !== passwords.confirm) return alert('Senhas não coincidem');
    setUpdating(true);
    await userService.updatePassword(passwords.new);
    setUpdating(false);
  };

  return (
    <Layout title="Segurança" showBack hideNav>
      <div className="p-4 space-y-4">
        <input type="password" placeholder="Nova Senha" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <input type="password" placeholder="Confirmar Senha" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <button onClick={handleUpdate} className="w-full bg-primary h-12 rounded-xl font-bold">{updating ? <Loader2 className="animate-spin" /> : <Save size={20} />} Atualizar</button>
      </div>
    </Layout>
  );
};
