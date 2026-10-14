import React, { useRef, useState } from 'react';
import { Camera, Loader2, Save } from 'lucide-react';
import { Layout } from '../components/Layout';
import { WhatsAppConnection } from '../components/WhatsAppConnection';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { getRoleLabel } from '../services/roleService';

export const SettingsProfile: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [avatar, setAvatar] = useState(profile?.avatar_url || '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!name.trim()) { setError('Informe seu nome.'); return; }
    setBusy(true);
    try {
      const result = await userService.updateProfile({ name: name.trim() });
      if (!result.success) throw new Error(result.error);
      await refreshProfile(); setSuccess('Dados salvos.');
    } catch { setError('Não foi possível salvar. Seus dados continuam no formulário; tente novamente.'); }
    finally { setBusy(false); }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setSuccess('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Escolha uma foto JPG, PNG ou WebP de até 5 MB.'); return;
    }
    setUploading(true);
    try {
      const result = await userService.uploadAvatar(file);
      if (!result.success || !result.url) throw new Error(result.error);
      setAvatar(result.url); await refreshProfile(); setSuccess('Foto atualizada.');
    } catch { setError('Não foi possível atualizar a foto. Tente novamente.'); }
    finally { setUploading(false); }
  }

  return <Layout>
    <Layout.Header title="Meu perfil" subTitle="Seus dados e sua conexão" showBack />
    <Layout.Content><div className="tg-page tg-stack">
      <form className="tg-card tg-stack" onSubmit={save}>
        <div className="tg-row">
          <button type="button" className="tg-avatar" aria-label="Alterar foto de perfil" onClick={() => fileInput.current?.click()} disabled={uploading || busy}>
            {avatar ? <img src={avatar} alt="Sua foto" onError={() => setAvatar('')} /> : <span>{(profile?.name || 'U').trim().slice(0, 1).toUpperCase()}</span>}
            <span className="tg-avatar-badge">{uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}</span>
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
          <div className="tg-grow"><h2>Dados pessoais</h2><p className="tg-muted">{getRoleLabel(profile?.role)} · Foto opcional</p></div>
        </div>
        <div className="tg-field"><label htmlFor="profile-name">Seu nome</label><input id="profile-name" autoComplete="name" maxLength={120} required value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="tg-field"><label htmlFor="profile-email">E-mail de acesso</label><input id="profile-email" type="email" readOnly value={profile?.email || user?.email || ''} aria-describedby="email-help" /><p id="email-help" className="tg-muted">Este é o e-mail usado para entrar na sua conta.</p></div>
        {error && <p className="tg-error" role="alert">{error}</p>}
        {success && <p className="tg-success" role="status">{success}</p>}
        <button disabled={busy || uploading} className="tg-button tg-primary" type="submit">{busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{busy ? 'Salvando…' : 'Salvar alterações'}</button>
      </form>
      <WhatsAppConnection />
    </div></Layout.Content>
  </Layout>;
};
