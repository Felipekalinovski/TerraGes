
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Wrench, DollarSign, Clock, FileText, User, Loader2, Trash2, Save, ChevronDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { maintenanceService } from '../services/maintenanceService';
import { machineService } from '../services/machineService';

export const MaintenanceForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    machine_id: '',
    date: '',
    type: '' as 'preventive' | 'corrective' | 'predictive' | '',
    hour_meter: 0,
    description: '',
    technician: '',
    cost: 0,
  });

  useEffect(() => {
    loadMachines();
    if (isEditing && id) {
      loadMaintenance(id);
    }
  }, [isEditing, id]);

  const loadMachines = async () => {
    try {
      const data = await machineService.getAll();
      setMachines(data.map(m => ({ id: m.id, name: m.name })));
    } catch (error) {
      console.error('Error loading machines:', error);
    }
  };

  const loadMaintenance = async (maintenanceId: string) => {
    try {
      setLoading(true);
      const maintenance = await maintenanceService.getById(maintenanceId);
      if (maintenance) {
        setFormData({
          machine_id: maintenance.machine_id,
          date: maintenance.date.split('T')[0],
          type: maintenance.type,
          hour_meter: maintenance.hour_meter,
          description: maintenance.description,
          technician: maintenance.technician,
          cost: maintenance.cost,
        });
      }
    } catch (error) {
      console.error('Error loading maintenance:', error);
      alert('Erro ao carregar manutenção.');
      navigate('/maintenance');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'hour_meter' || name === 'cost' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.machine_id || !formData.date || !formData.type || !formData.description) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setSaving(true);

      const maintenanceData = {
        machine_id: formData.machine_id,
        date: formData.date,
        type: formData.type as 'preventive' | 'corrective' | 'predictive',
        hour_meter: formData.hour_meter,
        description: formData.description,
        technician: formData.technician,
        cost: formData.cost,
      };

      if (isEditing && id) {
        await maintenanceService.update(id, maintenanceData);
        alert('Manutenção atualizada com sucesso!');
      } else {
        await maintenanceService.create(maintenanceData);
        alert('Manutenção registrada com sucesso!');
      }

      navigate('/maintenance');
    } catch (error) {
      console.error('Error saving maintenance:', error);
      alert('Erro ao salvar manutenção. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    if (!confirm('Tem certeza que deseja excluir esta manutenção?')) {
      return;
    }

    try {
      setSaving(true);
      await maintenanceService.delete(id);
      alert('Manutenção excluída com sucesso!');
      navigate('/maintenance');
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      alert('Erro ao excluir manutenção.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Layout.Header title={isEditing ? "Editar Manutenção" : "Nova Manutenção"} showBack />
        <Layout.Content>
          <div className="flex flex-col items-center justify-center h-[60vh] text-primary gap-4">
            <Loader2 size={48} className="animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Carregando dados da manutenção...</p>
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title={isEditing ? "Editar Registro" : "Registrar Manutenção"} 
        subTitle={isEditing ? `ID: ${id?.slice(0, 8)}` : "Adicione uma nova intervenção técnica"}
        showBack 
      />

      <Layout.Content>
        <form onSubmit={handleSubmit} className="px-4 space-y-8 pb-40 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Machine Selection Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Equipamento & Cronologia</h3>
            
            <div className="space-y-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Máquina Correspondente *</label>
                <div className="relative">
                  <select
                    name="machine_id"
                    value={formData.machine_id}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="" disabled className="bg-surface-dark">Selecione o equipamento</option>
                    {machines.map(machine => (
                      <option key={machine.id} value={machine.id} className="bg-surface-dark">{machine.name}</option>
                    ))}
                  </select>
                  <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Data do Serviço *</label>
                  <div className="relative">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      required
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm [color-scheme:dark]"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Horímetro Atual</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="hour_meter"
                      value={formData.hour_meter}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      placeholder="0000.0"
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-700 transition-all shadow-glass-sm"
                    />
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Especificações Técnicas</h3>
            
            <div className="space-y-4">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Classificação da Intervenção *</label>
                <div className="relative">
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-12 pr-10 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                  >
                    <option value="" disabled className="bg-surface-dark">Tipo de manutenção</option>
                    <option value="preventive" className="bg-surface-dark">Preventiva</option>
                    <option value="corrective" className="bg-surface-dark">Corretiva</option>
                    <option value="predictive" className="bg-surface-dark">Preditiva</option>
                  </select>
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Técnico Responsável</label>
                <div className="relative">
                  <input
                    type="text"
                    name="technician"
                    value={formData.technician}
                    onChange={handleChange}
                    placeholder="Nome completo do executor"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-700 transition-all shadow-glass-sm"
                  />
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={2.5} />
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Custo Total (R$)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="cost"
                    value={formData.cost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-primary font-black text-base focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-700 transition-all shadow-glass-sm"
                  />
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} strokeWidth={3} />
                </div>
              </div>
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass space-y-4">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Relatório de Serviço *</h3>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              className="w-full p-5 rounded-2xl bg-white/5 border border-white/5 text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-700 transition-all shadow-glass-sm resize-none"
              placeholder="Descreva detalhadamente as peças substituídas e o trabalho realizado..."
            ></textarea>
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
            {isEditing ? 'Sincronizar Histórico' : 'Finalizar Registro'}
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate(-1)}
              type="button"
              className="h-12 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[10px] rounded-[24px] transition-all"
            >
              Cancelar
            </button>
            
            {isEditing && (
              <button
                onClick={handleDelete}
                type="button"
                className="h-12 bg-negative/5 hover:bg-negative/10 text-negative font-black uppercase tracking-widest text-[10px] rounded-[24px] border border-negative/10 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} strokeWidth={3} /> Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
