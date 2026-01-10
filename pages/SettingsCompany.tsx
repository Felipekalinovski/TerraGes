
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Building, MapPin, Globe, FileText, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';

export const SettingsCompany: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({ name: '', cnpj: '', address: '', website: '' });

  useEffect(() => { loadCompanyProfile(); }, []);

  const loadCompanyProfile = async () => {
    try {
      setLoading(true);
      const profile = await companyService.getCompanyProfile();
      if (profile) setCompany({ name: profile.name || '', cnpj: profile.cnpj || '', address: profile.address || '', website: profile.website || '' });
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await companyService.updateCompanyProfile(company);
      if (result.success) navigate('/settings');
    } finally { setSaving(false); }
  };

  if (loading) return <Layout title="Dados da Empresa" showBack hideNav><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title="Dados da Empresa" showBack hideNav>
      <div className="p-4 space-y-4">
        <input type="text" placeholder="Razão Social" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <input type="text" placeholder="CNPJ" value={company.cnpj} onChange={e => setCompany({...company, cnpj: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <button onClick={handleSave} className="w-full bg-primary h-12 rounded-xl font-bold">{saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Salvar</button>
      </div>
    </Layout>
  );
};
