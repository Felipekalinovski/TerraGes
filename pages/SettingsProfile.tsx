
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
      <Layout title="Perfil do Usuário" showBack hideNav>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Perfil do Usuário" showBack hideNav>
      <div className="p-4 space-y-6 pb-24">

        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <div
              className="size-28 rounded-full bg-gray-700 bg-cover bg-center border-4 border-[#4b3220] shadow-xl"
              style={{ backgroundImage: `url('${formData.avatar_url}')` }}
            >
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-white" size={24} />
                </div>
              )}
            </div>
            <button
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 p-2 bg-primary text-black rounded-full shadow-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{formData.name || 'Usuário'}</h2>
            <p className="text-sm text-primary">{formData.role}</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nome Completo</label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Digite seu nome"
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">E-mail</label>
            <div className="relative">
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-gray-400 outline-none cursor-not-allowed"
              />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
            <p className="text-xs text-gray-500 mt-1">O e-mail não pode ser alterado</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Telefone</label>
            <div className="relative">
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="(00) 00000-0000"
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 bg-primary text-black font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Salvando...
            </>
          ) : (
            <>
              <Save size={20} />
              Salvar Alterações
            </>
          )}
        </button>
      </div>
    </Layout>
  );
};
