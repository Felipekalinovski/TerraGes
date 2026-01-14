
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Truck, Hash, Calendar, Clock, FileText, Camera, Save, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { machineService } from '../services/machineService';

export const FleetForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    hours: 0,
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    next_maintenance: '',
    last_maintenance: '',
    image_url: '',
  });

  useEffect(() => {
    if (isEditing && id) {
      loadMachine(id);
    }
  }, [isEditing, id]);

  const loadMachine = async (machineId: string) => {
    try {
      setLoading(true);
      const machine = await machineService.getById(machineId);
      if (machine) {
        setFormData({
          name: machine.name,
          type: machine.type,
          hours: machine.hours,
          status: machine.status,
          next_maintenance: machine.next_maintenance ? machine.next_maintenance.split('T')[0] : '',
          last_maintenance: machine.last_maintenance ? machine.last_maintenance.split('T')[0] : '',
          image_url: machine.image_url || '',
        });
        if (machine.image_url) {
          setImagePreview(machine.image_url);
        }
      }
    } catch (error) {
      console.error('Error loading machine:', error);
      alert('Erro ao carregar máquina.');
      navigate('/fleet');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'hours' ? Number(value) : value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setFormData(prev => ({ ...prev, image_url: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setSaving(true);

      const machineData = {
        name: formData.name,
        type: formData.type,
        hours: formData.hours,
        status: formData.status,
        next_maintenance: formData.next_maintenance || undefined,
        last_maintenance: formData.last_maintenance || undefined,
        image_url: formData.image_url || undefined,
      };

      if (isEditing && id) {
        await machineService.update(id, machineData);
        alert('Máquina atualizada com sucesso!');
      } else {
        await machineService.create(machineData);
        alert('Máquina cadastrada com sucesso!');
      }

      navigate('/fleet');
    } catch (error) {
      console.error('Error saving machine:', error);
      alert('Erro ao salvar máquina. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    if (!confirm('Tem certeza que deseja excluir esta máquina?')) {
      return;
    }

    try {
      setSaving(true);
      await machineService.delete(id);
      alert('Máquina excluída com sucesso!');
      navigate('/fleet');
    } catch (error) {
      console.error('Error deleting machine:', error);
      alert('Erro ao excluir máquina.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title={isEditing ? "Editar Máquina" : "Adicionar Máquina"} showBack hideNav={false}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? "Editar Máquina" : "Adicionar Máquina"} showBack hideNav={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24">

        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-3 py-4">
          <input
            type="file"
            id="machine-photo"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <label
            htmlFor="machine-photo"
            className="size-28 rounded-2xl bg-surface-dark border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors cursor-pointer group overflow-hidden"
            style={imagePreview ? { backgroundImage: `url(${imagePreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {!imagePreview && <Camera size={32} className="group-hover:scale-110 transition-transform" />}
          </label>
          <label htmlFor="machine-photo" className="text-sm text-primary font-medium cursor-pointer hover:underline">
            {imagePreview ? 'Alterar Foto' : 'Adicionar Foto'}
          </label>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Informações Básicas</h3>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Nome / Modelo *</label>
            <div className="relative">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
                placeholder="Ex: Escavadeira CAT 320D"
              />
              <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Tipo de Máquina *</label>
            <div className="relative">
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full h-12 pl-4 pr-10 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
              >
                <option value="" disabled>Selecione o tipo</option>
                <option value="Escavadeira">Escavadeira</option>
                <option value="Retroescavadeira">Retroescavadeira</option>
                <option value="Pá Carregadeira">Pá Carregadeira</option>
                <option value="Motoniveladora">Motoniveladora</option>
                <option value="Rolo Compactador">Rolo Compactador</option>
                <option value="Trator de Esteiras">Trator de Esteiras</option>
                <option value="Caminhão Basculante">Caminhão Basculante</option>
                <option value="Caminhão Pipa">Caminhão Pipa</option>
                <option value="Caminhão Munck">Caminhão Munck</option>
                <option value="Guindaste">Guindaste</option>
                <option value="Miniescavadeira">Miniescavadeira</option>
                <option value="Skid Steer">Skid Steer (Bob Cat)</option>
                <option value="Vibro Acabadora">Vibro Acabadora</option>
                <option value="Fresadora">Fresadora</option>
                <option value="Perfuratriz">Perfuratriz</option>
                <option value="Compressor">Compressor</option>
                <option value="Gerador">Gerador</option>
                <option value="Bomba de Concreto">Bomba de Concreto</option>
                <option value="Betoneira">Betoneira</option>
                <option value="Outros">Outros</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>



        {/* Operational Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">Dados Operacionais</h3>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Horímetro Atual</label>
            <div className="relative">
              <input
                type="number"
                name="hours"
                value={formData.hours}
                onChange={handleChange}
                min="0"
                step="0.1"
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
                placeholder="0.0"
              />
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Status</label>
            <div className="relative">
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
              >
                <option value="active">Ativa</option>
                <option value="maintenance">Em Manutenção</option>
                <option value="inactive">Inativa</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Próxima Manutenção</label>
              <input
                type="date"
                name="next_maintenance"
                value={formData.next_maintenance}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Última Manutenção</label>
              <input
                type="date"
                name="last_maintenance"
                value={formData.last_maintenance}
                onChange={handleChange}
                className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>

      </form>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur-sm border-t border-white/5 z-20">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-black font-bold rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Save size={20} />
                {isEditing ? 'Atualizar Máquina' : 'Salvar Máquina'}
              </>
            )}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="w-full h-12 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={20} />
              Excluir Máquina
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="w-full h-12 bg-transparent hover:bg-white/5 text-primary font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>


    </Layout>
  );
};
