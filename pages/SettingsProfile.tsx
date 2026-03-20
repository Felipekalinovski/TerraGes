
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    avatar_url: 'https://picsum.photos/200'
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await userService.getCurrentProfile();

      if (profile) {
        setFormData({
          name: profile.name || '',
          email: profile.email || user?.email || '',
          role: profile.role || 'Usuário',
          phone: profile.phone || '',
          avatar_url: profile.avatar_url || 'https://picsum.photos/200'
        });
      } else if (user) {
        // If no profile exists, use auth user data
        setFormData(prev => ({
          ...prev,
          email: user.email || ''
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const result = await userService.uploadAvatar(file);

      if (result.success && result.url) {
        setFormData(prev => ({ ...prev, avatar_url: result.url! }));
        alert('Foto de perfil atualizada com sucesso!');
      } else {
        alert(`Erro ao fazer upload: ${result.error}`);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Erro ao fazer upload da foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await userService.updateProfile({
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
      });

      if (result.success) {
        alert('Perfil atualizado com sucesso!');
        navigate('/settings');
      } else {
        alert(`Erro ao atualizar perfil: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="Perfil do Usuário" showBack />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title="Perfil do Usuário" 
        subTitle="Mantenha seus dados de contato e foto atualizados"
        showBack 
      />

      <Layout.Content>
        <div className="p-4 space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4 py-8 relative">
            <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full -z-10" />
            <div className="relative group">
              <div
                className="size-32 rounded-full bg-surface-dark/80 bg-cover bg-center border-2 border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${formData.avatar_url}')` }}
              >
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute bottom-1 right-1 p-3 bg-primary text-black rounded-2xl shadow-neon hover:bg-primary-hover transition-all disabled:opacity-50 active:scale-90"
              >
                <Camera size={18} strokeWidth={2.5} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tight">{formData.name || 'Usuário'}</h2>
              <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 inline-block">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">{formData.role}</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Nome Completo</label>
              <div className="relative group">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                  placeholder="Nome completo"
                />
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">E-mail Corporativo</label>
              <div className="relative group">
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-white/[0.02] border border-white/5 text-gray-500 outline-none cursor-not-allowed italic"
                />
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={20} />
              </div>
              <p className="text-[9px] font-medium text-gray-600 ml-4 uppercase tracking-tighter">O e-mail não pode ser alterado por segurança</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Telefone de Contato</label>
              <div className="relative group">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                  placeholder="(00) 00000-0000"
                />
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-16 bg-primary text-black font-black uppercase tracking-widest text-[11px] rounded-3xl shadow-neon flex items-center justify-center gap-3 hover:bg-primary-hover transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Save size={20} strokeWidth={2.5} />
                  Salvar Perfil
                </>
              )}
            </button>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
