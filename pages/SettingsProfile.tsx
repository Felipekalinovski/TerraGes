
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { User, Mail, Phone, Camera, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';

export const SettingsProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: '', phone: '', avatar_url: '' });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const p = await userService.getCurrentProfile();
      if (p) setFormData({ name: p.name || '', email: p.email || user?.email || '', role: p.role || 'Usuário', phone: p.phone || '', avatar_url: p.avatar_url || '' });
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    await userService.updateProfile(formData);
    setSaving(false);
  };

  if (loading) return <Layout title="Perfil" showBack hideNav><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title="Perfil" showBack hideNav>
      <div className="p-4 space-y-4">
        <div className="size-24 rounded-full bg-gray-700 mx-auto bg-cover" style={{ backgroundImage: `url(${formData.avatar_url})` }} />
        <input type="text" placeholder="Nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <button onClick={handleSave} className="w-full bg-primary h-12 rounded-xl font-bold">{saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Salvar</button>
      </div>
    </Layout>
  );
};
