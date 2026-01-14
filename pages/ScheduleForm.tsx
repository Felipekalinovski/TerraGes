
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Clock, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { scheduleService } from '../services/scheduleService';

export const ScheduleForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: '' as 'excavation' | 'transport' | 'maintenance' | 'other' | '',
    start_time: '',
    end_time: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    notes: ''
  });

  useEffect(() => {
    if (isEditing && id) {
      loadSchedule(id);
    }
  }, [isEditing, id]);

  const loadSchedule = async (scheduleId: string) => {
    try {
      setLoading(true);
      const schedule = await scheduleService.getById(scheduleId);
      if (schedule) {
        // Convert ISO datetime to datetime-local format
        const formatDateTimeLocal = (isoString: string) => {
          const date = new Date(isoString);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        setFormData({
          title: schedule.title,
          type: schedule.type,
          start_time: formatDateTimeLocal(schedule.start_time),
          end_time: schedule.end_time ? formatDateTimeLocal(schedule.end_time) : '',
          priority: schedule.priority,
          notes: schedule.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      alert('Erro ao carregar agendamento.');
      navigate('/schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.type || !formData.start_time) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setSaving(true);

      const scheduleData = {
        title: formData.title,
        type: formData.type as 'excavation' | 'transport' | 'maintenance' | 'other',
        start_time: new Date(formData.start_time).toISOString(),
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : undefined,
        priority: formData.priority,
        notes: formData.notes || undefined
      };

      if (isEditing && id) {
        await scheduleService.update(id, scheduleData);
        alert('Agendamento atualizado com sucesso!');
      } else {
        await scheduleService.create(scheduleData);
        alert('Agendamento criado com sucesso!');
      }

      navigate('/schedule');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Erro ao salvar agendamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    if (!confirm('Tem certeza que deseja excluir este agendamento?')) {
      return;
    }

    try {
      setSaving(true);
      await scheduleService.delete(id);
      alert('Agendamento excluído com sucesso!');
      navigate('/schedule');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Erro ao excluir agendamento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title={isEditing ? "Editar Serviço" : "Agendar Serviço"} showBack hideNav={false}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? "Editar Serviço" : "Agendar Serviço"} showBack hideNav={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24">

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Nome do Serviço/Tarefa *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="Ex: Escavação do Lote 12"
            className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Tipo de Serviço *</label>
          <div className="relative">
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="" disabled>Selecione o tipo</option>
              <option value="excavation">Escavação</option>
              <option value="transport">Transporte</option>
              <option value="maintenance">Manutenção</option>
              <option value="other">Outros</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Data e Hora de Início *</label>
            <div className="relative">
              <input
                type="datetime-local"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Data e Hora de Término <span className="text-gray-500 font-normal">(Opcional)</span></label>
            <div className="relative">
              <input
                type="datetime-local"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50"
              />
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
            </div>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Prioridade</label>
          <div className="relative">
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-gold">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Observações</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="w-full h-32 p-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-text-gold/50 resize-none"
            placeholder="Adicione detalhes importantes sobre o serviço..."
          ></textarea>
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
                <AlertCircle size={20} />
                {isEditing ? 'Atualizar Serviço' : 'Agendar Serviço'}
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
              Excluir Agendamento
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
