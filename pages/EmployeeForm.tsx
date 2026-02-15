
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
        email: formData.email,
        cpf: formData.cpf,
        birth_date: formData.birth_date,
        address: formData.address,
        admission_date: formData.admission_date,
        certifications: formData.certifications,
        image_url: formData.image_url
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
    <Layout title={isEditing ? "Editar Colaborador" : "Novo Colaborador"} showBack hideNav={false}>
      <div className="p-4 space-y-6 pb-24">

        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="size-24 rounded-full bg-surface-dark border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors cursor-pointer relative overflow-hidden group"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <User size={32} />
            )}

            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            )}

            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          </div>
          <span className="text-sm text-primary font-medium cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {isEditing ? 'Alterar Foto' : 'Adicionar Foto'}
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
        </div>

        {/* Personal Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Dados Pessoais</h3>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Nome Completo</label>
            <div className="relative">
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                type="text"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
                placeholder="Ex: Carlos Silva"
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">CPF</label>
            <input
              name="cpf"
              value={formData.cpf}
              onChange={handleChange}
              type="text"
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Data de Nascimento</label>
            <div className="relative">
              <input
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                type="date"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Contato</h3>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Telefone / WhatsApp</label>
            <div className="relative">
              <input
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                type="tel"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
                placeholder="(00) 00000-0000"
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">E-mail</label>
            <div className="relative">
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                type="email"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
                placeholder="email@exemplo.com"
              />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Endereço</label>
            <div className="relative">
              <input
                name="address"
                value={formData.address}
                onChange={handleChange}
                type="text"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
                placeholder="Rua, Número, Bairro"
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        {/* Job Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Dados Contratuais</h3>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Cargo / Função</label>
            <div className="relative">
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
              >
                <option value="" disabled>Selecione o cargo</option>
                <option value="Operador de Máquinas">Operador de Máquinas</option>
                <option value="Engenheiro">Engenheiro</option>
                <option value="Engenheira Civil">Engenheira Civil</option>
                <option value="Mecânico">Mecânico</option>
                <option value="Mecânico Chefe">Mecânico Chefe</option>
                <option value="Motorista">Motorista</option>
                <option value="Assistente Adm.">Assistente Adm.</option>
                <option value="Ajudante Geral">Ajudante Geral</option>
              </select>
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Status</label>
            <div className="relative">
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
              >
                <option value="active">Ativo</option>
                <option value="vacation">Férias</option>
                <option value="leave">Afastado</option>
                <option value="inactive">Inativo</option>
              </select>
              <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Data de Admissão</label>
            <div className="relative">
              <input
                name="admission_date"
                value={formData.admission_date}
                onChange={handleChange}
                type="date"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Certificações (NRs)</label>
            <div className="flex flex-wrap gap-2">
              {['NR-10', 'NR-12', 'NR-35', 'CNH C', 'CNH D', 'CNH E'].map(cert => (
                <label key={cert} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer select-none transition-colors ${formData.certifications?.includes(cert) ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-dark border-white/10 text-gray-300 hover:border-primary/50'}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.certifications?.includes(cert)}
                    onChange={() => handleCertChange(cert)}
                  />
                  <span className="text-sm">{cert}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur-sm border-t border-white/5 z-20">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={loading || uploading}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            {isEditing ? 'Atualizar Colaborador' : 'Salvar Colaborador'}
          </button>
          <button
            onClick={() => navigate(-1)}
            disabled={loading}
            className="w-full h-12 bg-transparent hover:bg-white/5 text-primary font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Layout>
  );
};