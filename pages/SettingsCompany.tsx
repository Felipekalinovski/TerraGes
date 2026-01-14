
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
      <Layout title="Dados da Empresa" showBack hideNav>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dados da Empresa" showBack hideNav>
      <div className="p-4 space-y-6 pb-24">

        <div className="bg-surface-dark p-6 rounded-2xl border border-white/5 flex flex-col items-center gap-4">
          <div className="size-20 bg-white/10 rounded-2xl flex items-center justify-center text-primary border border-white/10">
            <Building size={40} />
          </div>
          <p className="text-gray-400 text-sm text-center">Logo da Empresa</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Razão Social</label>
            <div className="relative">
              <input
                type="text"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Nome da empresa"
              />
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">CNPJ</label>
            <div className="relative">
              <input
                type="text"
                value={company.cnpj}
                onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="00.000.000/0000-00"
              />
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Endereço</label>
            <div className="relative">
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="Endereço completo"
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Site</label>
            <div className="relative">
              <input
                type="text"
                value={company.website}
                onChange={(e) => setCompany({ ...company, website: e.target.value })}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
                placeholder="www.exemplo.com.br"
              />
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 bg-primary text-black font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Salvando...
            </>
          ) : (
            <>
              <Save size={20} />
              Salvar Dados
            </>
          )}
        </button>
      </div>
    </Layout>
  );
};
