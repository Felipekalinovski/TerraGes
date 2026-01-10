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
    if (!confirm('Tem certeza que deseja excluir esta manutenção?')) return;
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
        <div>
          <label className="block text-sm font-medium text-white mb-2">Máquina *</label>
          <select name="machine_id" value={formData.machine_id} onChange={handleChange} required className="w-full h-12 px-4 rounded-xl bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="" disabled>Selecione a máquina</option>
            {machines.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">Data *</label>
          <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full h-12 px-4 rounded-xl bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">Tipo *</label>
          <select name="type" value={formData.type} onChange={handleChange} required className="w-full h-12 px-4 rounded-xl bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="" disabled>Selecione o tipo</option>
            <option value="preventive">Preventiva</option>
            <option value="corrective">Corretiva</option>
            <option value="predictive">Preditiva</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">Descrição *</label>
          <textarea name="description" value={formData.description} onChange={handleChange} required className="w-full h-32 p-4 rounded-xl bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none" />
        </div>
      </form>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur-sm border-t border-white/5 z-20">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <button onClick={handleSubmit} disabled={saving} className="w-full h-12 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {isEditing ? 'Atualizar' : 'Salvar'}
          </button>
          {isEditing && (
            <button onClick={handleDelete} disabled={saving} className="w-full h-12 bg-red-500/10 text-red-500 font-bold rounded-xl flex items-center justify-center gap-2">
              <Trash2 size={20} /> Excluir
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
};
