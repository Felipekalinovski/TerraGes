
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Truck, Hash, Calendar, Clock, FileText, Camera, Save, AlertCircle, Loader2, Trash2, ChevronDown } from 'lucide-react';
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
      <Layout>
        <Layout.Header title={isEditing ? "Editar Máquina" : "Nova Máquina"} showBack />
        <Layout.Content>
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-primary" />
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title={isEditing ? "Editar Equipamento" : "Novo Equipamento"} 
        subTitle={isEditing ? formData.name : "Cadastre novo recurso na frota"}
        showBack
      />

      <Layout.Content>
        <form onSubmit={handleSubmit} className="px-4 space-y-8 pb-48 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Photo Upload Section */}
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative group">
              <input
                type="file"
                id="machine-photo"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="machine-photo"
                className="size-32 rounded-[32px] bg-surface-dark/40 backdrop-blur-md border-2 border-dashed border-white/10 flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-all cursor-pointer overflow-hidden shadow-glass group-hover:shadow-neon-sm"
                style={imagePreview ? { backgroundImage: `url(${imagePreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
              >
                {!imagePreview && <Camera size={40} className="group-hover:scale-110 transition-transform opacity-50" />}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Camera size={24} className="text-white" />
                </div>
              </label>
              
              {imagePreview && (
                <button 
                  type="button"
                  onClick={() => { setImagePreview(''); setFormData(p => ({ ...p, image_url: '' })); }}
                  className="absolute -top-2 -right-2 size-8 bg-negative rounded-full flex items-center justify-center text-white shadow-lg border-2 border-black hover:scale-110 transition-transform"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <label htmlFor="machine-photo" className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic cursor-pointer hover:brightness-125 transition-all">
              {imagePreview ? 'Atualizar Identidade Visual' : 'Vincular Imagem Real'}
            </label>
          </div>

          {/* Basic Info Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Especificações Técnicas</h3>
            
            <div className="space-y-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Identificação / Modelo *</label>
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                    placeholder="Ex: Escavadeira CAT 320D"
                  />
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Categoria de Equipamento *</label>
                <div className="relative">
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="" disabled className="bg-surface-dark">Selecione o tipo</option>
                    <option value="Escavadeira" className="bg-surface-dark">Escavadeira</option>
                    <option value="Retroescavadeira" className="bg-surface-dark">Retroescavadeira</option>
                    <option value="Pá Carregadeira" className="bg-surface-dark">Pá Carregadeira</option>
                    <option value="Motoniveladora" className="bg-surface-dark">Motoniveladora</option>
                    <option value="Rolo Compactador" className="bg-surface-dark">Rolo Compactador</option>
                    <option value="Trator de Esteiras" className="bg-surface-dark">Trator de Esteiras</option>
                    <option value="Caminhão Basculante" className="bg-surface-dark">Caminhão Basculante</option>
                    <option value="Outros" className="bg-surface-dark">Outros</option>
                  </select>
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Data Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Métricas & Status</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Horímetro Atual</label>
                <div className="relative">
                  <input
                    type="number"
                    name="hours"
                    value={formData.hours}
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                    placeholder="0.0"
                  />
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Estado Operacional</label>
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full h-14 pl-4 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="active" className="bg-surface-dark">Ativa</option>
                    <option value="maintenance" className="bg-surface-dark">Manutenção</option>
                    <option value="inactive" className="bg-surface-dark">Inativa</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Próximo Checklist Preventivo</label>
                <div className="relative">
                  <input
                    type="date"
                    name="next_maintenance"
                    value={formData.next_maintenance}
                    onChange={handleChange}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                  />
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

        </form>
      </Layout.Content>

      {/* Action Persistence Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-40">
        <div className="max-w-md mx-auto space-y-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-14 bg-primary hover:brightness-110 active:scale-[0.98] text-black font-black uppercase tracking-[0.2em] italic text-xs rounded-[24px] transition-all shadow-neon-sm flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} strokeWidth={3} />}
            {isEditing ? 'Confirmar Alterações' : 'Finalizar Cadastro'}
          </button>
          
          <div className="flex gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 h-12 bg-negative/10 hover:bg-negative/20 text-negative font-black uppercase tracking-widest text-[10px] rounded-[24px] transition-all border border-negative/20 flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            )}
            
            <button
              onClick={() => navigate(-1)}
              disabled={saving}
              className="flex-[2] h-12 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[10px] rounded-[24px] transition-all border border-white/5 flex items-center justify-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
