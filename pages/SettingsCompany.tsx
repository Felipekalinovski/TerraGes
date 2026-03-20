
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Building, MapPin, Globe, FileText, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';

export const SettingsCompany: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState({
    name: '',
    cnpj: '',
    address: '',
    website: ''
  });

  useEffect(() => {
    loadCompanyProfile();
  }, []);

  const loadCompanyProfile = async () => {
    try {
      setLoading(true);
      const profile = await companyService.getCompanyProfile();

      if (profile) {
        setCompany({
          name: profile.name || '',
          cnpj: profile.cnpj || '',
          address: profile.address || '',
          website: profile.website || ''
        });
      }
    } catch (error) {
      console.error('Error loading company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await companyService.updateCompanyProfile(company);

      if (result.success) {
        alert('Dados da empresa atualizados com sucesso!');
        navigate('/settings');
      } else {
        alert(`Erro ao atualizar dados: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving company profile:', error);
      alert('Erro ao salvar dados');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="Dados da Empresa" showBack />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title="Dados da Empresa" 
        subTitle="Informações corporativas e identidade visual"
        showBack
      />

      <Layout.Content>
        <div className="p-4 space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">

          <div className="relative group p-8 rounded-[40px] bg-surface-dark/40 backdrop-blur-md border border-white/5 flex flex-col items-center gap-4 shadow-glass transition-all duration-500 hover:border-primary/20">
            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full opacity-50" />
            <div className="size-24 bg-white/5 rounded-3xl flex items-center justify-center text-primary border border-white/10 relative z-10 group-hover:scale-110 transition-transform duration-500 shadow-neon">
              <Building size={48} strokeWidth={1.5} />
            </div>
            <div className="text-center relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Branding</p>
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-widest mt-1">Logo da Corporação</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Razão Social</label>
              <div className="relative group">
                <input
                  type="text"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                  placeholder="Nome da empresa"
                />
                <Building className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">CNPJ / Documentação</label>
              <div className="relative group">
                <input
                  type="text"
                  value={company.cnpj}
                  onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                  placeholder="00.000.000/0000-00"
                />
                <FileText className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Endereço Principal</label>
              <div className="relative group">
                <input
                  type="text"
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                  placeholder="Endereço completo"
                />
                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Website Corporativo</label>
              <div className="relative group">
                <input
                  type="text"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  className="w-full h-14 pl-14 pr-4 rounded-3xl bg-surface-dark/40 backdrop-blur-md border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
                  placeholder="www.exemplo.com.br"
                />
                <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
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
                  Atualizando SGBD...
                </>
              ) : (
                <>
                  <Save size={20} strokeWidth={2.5} />
                  Salvar Dados Corporativos
                </>
              )}
            </button>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
