import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Layout } from '../components/Layout';
import { companyService } from '../services/companyService';
import { useAuth } from '../contexts/AuthContext';

export const SettingsCompany: React.FC = () => {
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState({ name: '', cnpj: '', address: '', website: '' });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true); setError('');
    const company = await companyService.getCompanyProfile();
    if (company) {
      setForm({ name: company.name || '', cnpj: company.cnpj || '', address: company.address || '', website: company.website || '' });
      setLoaded(true);
    } else setError('Não foi possível carregar os dados da empresa. Tente novamente.');
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!form.name.trim()) { setError('Informe o nome da empresa.'); return; }
    setBusy(true);
    try {
      const result = await companyService.updateCompanyProfile({ ...form, name: form.name.trim() });
      if (!result.success) throw new Error(result.error);
      await refreshProfile(); setSuccess('Dados da empresa salvos.');
    } catch { setError('Não foi possível salvar. Seus dados continuam no formulário; tente novamente.'); }
    finally { setBusy(false); }
  }

  return <Layout><Layout.Header title="Minha empresa" subTitle="Dados usados nos serviços e orçamentos" showBack /><Layout.Content>
    <div className="tg-page"><form className="tg-card tg-stack" onSubmit={save}>
      <h2>Dados da empresa</h2><p className="tg-muted">Só o nome é obrigatório. Complete os outros dados quando precisar.</p>
      {loading ? <p role="status">Carregando…</p> : loaded && <>
        <div className="tg-field"><label htmlFor="company-name">Nome da empresa</label><input id="company-name" required autoComplete="organization" maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="tg-field"><label htmlFor="company-cnpj">CNPJ (opcional)</label><input id="company-cnpj" inputMode="numeric" value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
        <div className="tg-field"><label htmlFor="company-address">Endereço (opcional)</label><input id="company-address" autoComplete="street-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        <div className="tg-field"><label htmlFor="company-website">Site (opcional)</label><input id="company-website" autoComplete="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="www.suaempresa.com.br" /></div>
      </>}
      {error && <p role="alert" className="tg-error">{error}</p>}
      {success && <p role="status" className="tg-success">{success}</p>}
      {!loaded && !loading && <button className="tg-button tg-secondary" type="button" onClick={load}>Tentar novamente</button>}
      {loaded && <button disabled={busy} className="tg-button tg-primary" type="submit">{busy ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{busy ? 'Salvando…' : 'Salvar dados'}</button>}
    </form></div>
  </Layout.Content></Layout>;
};
