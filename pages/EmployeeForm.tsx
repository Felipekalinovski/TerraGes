
import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, CheckCircle, Loader2, Camera, Upload } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeService, Employee } from '../services/employeeService';

export const EmployeeForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    cpf: '',
    birth_date: '',
    contact: '',
    email: '',
    address: '',
    role: '',
    admission_date: '',
    certifications: [],
    status: 'active'
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing) {
      loadEmployee();
    }
  }, [id]);

  const loadEmployee = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getById(id!);
      if (data) {
        setFormData(data);
        if (data.image_url) setPreviewUrl(data.image_url);
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCertChange = (cert: string) => {
    setFormData(prev => {
      const certs = prev.certifications || [];
      if (certs.includes(cert)) {
        return { ...prev, certifications: certs.filter(c => c !== cert) };
      } else {
        return { ...prev, certifications: [...certs, cert] };
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      setUploading(true);
      const publicUrl = await employeeService.uploadAvatar(file);
      if (publicUrl) {
        setFormData(prev => ({ ...prev, image_url: publicUrl }));
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!formData.name || !formData.role) {
        alert('Por favor, preencha os campos obrigatórios (Nome, Cargo).');
        setLoading(false);
        return;
      }

      const dataToSave = {
        name: formData.name!,
        role: formData.role!,
        status: formData.status as any || 'active',
        contact: formData.contact || '',
        email: formData.email || '',
        cpf: formData.cpf || '',
        birth_date: formData.birth_date || '',
        address: formData.address || '',
        admission_date: formData.admission_date || '',
        certifications: formData.certifications || [],
        image_url: formData.image_url || ''
      };

      if (isEditing) {
        await employeeService.update(id!, dataToSave);
      } else {
        await employeeService.create(dataToSave);
      }

      navigate('/employees');
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Erro ao salvar colaborador.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditing && !formData.name) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-primary">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title={isEditing ? "Editar Registro" : "Novo Colaborador"} 
        subTitle="Gestão de Capital Humano"
        showBack
      />

      <Layout.Content>
        <div className="px-4 py-8 space-y-10 pb-40 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Photo Upload Section */}
          <div className="flex flex-col items-center gap-4 group">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative cursor-pointer transition-all active:scale-95"
            >
              <div className="absolute inset-0 bg-primary/20 rounded-[40px] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div 
                className="size-32 rounded-[40px] bg-surface-dark border-2 border-dashed border-white/10 flex items-center justify-center text-gray-500 hover:border-primary/50 hover:text-primary transition-all relative overflow-hidden shadow-glass group-hover:shadow-neon-sm"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} strokeWidth={1.5} />
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-[2px]">
                  <Camera className="text-white drop-shadow-lg" size={32} />
                </div>
              </div>
            </div>
            <div className="text-center">
              <span 
                className="text-[10px] font-black text-primary uppercase tracking-[0.2em] cursor-pointer hover:brightness-125 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                {isEditing ? 'Substituir Identidade Visual' : 'Definir Identidade Visual'}
              </span>
              <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">PNG, JPG ou WEBP • Máx 2MB</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>

          {/* Form Grid */}
          <div className="space-y-12">
            
            {/* Personal Data Selection */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-1 mb-6">
                 <div className="h-[2px] w-8 bg-primary shadow-neon-sm"></div>
                 <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic font-heading">Dados Biométricos</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Nome Completo</label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      type="text"
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium placeholder:text-gray-700"
                      placeholder="Identificação do colaborador..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">CPF (Fiscal)</label>
                  <input
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    type="text"
                    className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] px-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium placeholder:text-gray-700"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Nascimento</label>
                  <div className="relative group">
                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleChange}
                      type="date"
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Workplace Info */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-1 mb-6">
                 <div className="h-[2px] w-8 bg-primary shadow-neon-sm"></div>
                 <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic font-heading">Estrutura Operacional</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Cargo / Nível</label>
                  <div className="relative group">
                    <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-12 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium appearance-none"
                    >
                      <option value="" disabled>Selecione a função...</option>
                      <option value="Operador de Máquinas">Operador de Máquinas</option>
                      <option value="Engenheiro">Engenheiro</option>
                      <option value="Mecânico Chefe">Mecânico Chefe</option>
                      <option value="Motorista">Motorista</option>
                      <option value="Assistente Adm.">Assistente Adm.</option>
                      <option value="Ajudante Geral">Ajudante Geral</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Status do Vínculo</label>
                  <div className="relative group">
                    <CheckCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-12 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium appearance-none"
                    >
                      <option value="active">Ativo (Em Operação)</option>
                      <option value="vacation">Férias (Descanso)</option>
                      <option value="leave">Afastado (Médico/Outros)</option>
                      <option value="inactive">Inativo (Desligado)</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Admissão</label>
                  <div className="relative group">
                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      name="admission_date"
                      value={formData.admission_date}
                      onChange={handleChange}
                      type="date"
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Communication & Location Selection */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-1 mb-6">
                 <div className="h-[2px] w-8 bg-primary shadow-neon-sm"></div>
                 <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic font-heading">Comunicação & Localização</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Telefone / WhatsApp</label>
                  <div className="relative group">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      name="contact"
                      value={formData.contact}
                      onChange={handleChange}
                      type="text"
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium placeholder:text-gray-700"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">E-mail Corporativo</label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      type="email"
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium placeholder:text-gray-700"
                      placeholder="email@empresa.com"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Endereço Residencial</label>
                  <div className="relative group">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      type="text"
                      className="w-full bg-surface-dark/40 border border-white/5 rounded-[24px] pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-glass font-medium placeholder:text-gray-700"
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Certifications Badge Selection */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-1 mb-6">
                 <div className="h-[2px] w-8 bg-primary shadow-neon-sm"></div>
                 <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic font-heading">Competências & Cursos</h3>
              </div>

              <div className="flex flex-wrap gap-3">
                {['NR-10', 'NR-12', 'NR-35', 'CNH C', 'CNH D', 'CNH E'].map(cert => (
                  <button 
                    key={cert} 
                    type="button"
                    onClick={() => handleCertChange(cert)}
                    className={`px-5 py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                      formData.certifications?.includes(cert) 
                      ? 'bg-primary/20 border-primary shadow-neon-sm text-primary' 
                      : 'bg-surface-dark/40 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                    }`}
                  >
                    <div className={`size-1.5 rounded-full ${formData.certifications?.includes(cert) ? 'bg-primary' : 'bg-gray-700'}`}></div>
                    {cert}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </Layout.Content>

      {/* Persistence Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-surface-dark/80 backdrop-blur-xl border-t border-white/5 z-50">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || uploading}
            className="w-full h-14 bg-primary hover:brightness-110 active:scale-[0.98] text-black font-black uppercase tracking-[0.2em] italic text-xs rounded-[24px] transition-all shadow-neon-sm flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} strokeWidth={3} />}
            {isEditing ? 'Sincronizar Alterações' : 'Finalizar Cadastro'}
          </button>
          
          <button
            onClick={() => navigate(-1)}
            type="button"
            className="w-full h-12 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[10px] rounded-[24px] transition-all"
          >
            Descartar Edição
          </button>
        </div>
      </div>
    </Layout>
  );
};