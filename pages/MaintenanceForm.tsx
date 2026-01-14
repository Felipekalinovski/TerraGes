
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Wrench, DollarSign, Clock, FileText, User, Loader2, Trash2, Save } from 'lucide-react';
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
      <Layout title={isEditing ? "Editar Manutenção" : "Adicionar Manutenção"} showBack hideNav={false}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? "Editar Manutenção" : "Adicionar Manutenção"} showBack hideNav={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24">

        {/* Máquina */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Máquina *</label>
          <div className="relative">
            <select
              name="machine_id"
              value={formData.machine_id}
              onChange={handleChange}
              required
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="" disabled>Selecione a máquina</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>{machine.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Data da Manutenção *</label>
          <div className="relative">
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
            />
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
          </div>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Tipo de Manutenção *</label>
          <div className="relative">
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none pl-12"
            >
              <option value="" disabled>Selecione o tipo</option>
              <option value="preventive">Preventiva</option>
              <option value="corrective">Corretiva</option>
              <option value="predictive">Preditiva</option>
            </select>
            <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Horímetro */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Horímetro no Momento da Manutenção</label>
          <div className="relative">
            <input
              type="number"
              name="hour_meter"
              value={formData.hour_meter}
              onChange={handleChange}
              min="0"
              step="0.1"
              placeholder="Ex: 1500"
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
            />
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Descrição do Serviço Realizado *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full h-32 p-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50 resize-none"
            placeholder="Detalhe o serviço realizado..."
          ></textarea>
        </div>

        {/* Técnico */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Técnico Responsável</label>
          <div className="relative">
            <input
              type="text"
              name="technician"
              value={formData.technician}
              onChange={handleChange}
              placeholder="Nome do técnico"
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
            />
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
          </div>
        </div>

        {/* Custo */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Custo Total</label>
          <div className="relative">
            <input
              type="number"
              name="cost"
              value={formData.cost}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
            />
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
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
                {isEditing ? 'Atualizar Manutenção' : 'Salvar Manutenção'}
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
              Excluir Manutenção
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
