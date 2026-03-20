
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Clock, AlertCircle, Loader2, Trash2, Sparkles } from 'lucide-react';
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
      <Layout>
        <Layout.Header title={isEditing ? "Editar Operação" : "Nova Operação"} showBack />
        <Layout.Content>
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={24} />
            </div>
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title={isEditing ? "Editar Operação" : "Programação Técnica"} 
        subTitle="Parametrização de cronograma e prioridades"
        showBack 
      />

      <Layout.Content>
        <form onSubmit={handleSubmit} className="px-4 space-y-10 pb-40 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Main Info Section */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Identificação do Escopo</h3>
            
            <div className="group">
              <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Título da Atividade</label>
              <div className="relative">
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Escavação do Setor Alpha"
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-surface-dark/40 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-600 transition-all shadow-glass-sm"
                />
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
              </div>
            </div>

            <div className="group">
              <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Classificação Técnica</label>
              <div className="relative">
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="w-full h-14 pl-12 pr-10 rounded-2xl bg-surface-dark/40 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                >
                  <option value="" disabled>Selecione a categoria</option>
                  <option value="excavation" className="bg-surface-dark">Escavação Operacional</option>
                  <option value="transport" className="bg-surface-dark">Logística & Transporte</option>
                  <option value="maintenance" className="bg-surface-dark">Manutenção Sistêmica</option>
                  <option value="other" className="bg-surface-dark">Outros Serviços</option>
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                  <AlertCircle size={20} />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Temporal Section */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Janela Temporal</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Start (Início)</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-surface-dark/40 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                  />
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
                </div>
              </div>

              <div className="group">
                <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Deadline Final (Opcional)</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-surface-dark/40 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-glass-sm"
                  />
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Info */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading px-1">Alocação & Complexidade</h3>
            
            <div className="group">
              <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Nível de Prioridade</label>
              <div className="relative">
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full h-14 pl-12 pr-10 rounded-2xl bg-surface-dark/40 border border-white/5 text-white font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none appearance-none transition-all shadow-glass-sm"
                >
                  <option value="low" className="bg-surface-dark">Fila de Espera (Baixa)</option>
                  <option value="medium" className="bg-surface-dark">Fluxo Normal (Média)</option>
                  <option value="high" className="bg-surface-dark">Prioridade Técnica (Alta)</option>
                  <option value="urgent" className="bg-surface-dark">Resposta Imediata (Urgente)</option>
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                  <Loader2 size={20} />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1 group-focus-within:text-primary transition-colors">Memória Operacional</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full h-32 p-4 rounded-2xl bg-surface-dark/40 border border-white/5 text-white font-medium text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-gray-600 transition-all shadow-glass-sm resize-none"
                placeholder="Detalhes críticos, condições climáticas ou requisitos de pessoal..."
              ></textarea>
            </div>
          </div>
        </form>

        {/* Action Bar (Glass Persistence) */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-surface-dark/60 backdrop-blur-xl border-t border-white/5 z-50">
          <div className="max-w-md mx-auto flex flex-col gap-4">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full h-14 bg-primary text-black font-black uppercase tracking-[0.2em] italic text-xs rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-neon flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {saving ? (
                <div className="size-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <Sparkles size={18} />
                  {isEditing ? 'Atualizar Atividade' : 'Confirmar Programação'}
                </>
              )}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="w-full h-14 bg-red-500/10 text-red-500 font-black uppercase tracking-[0.2em] italic text-[10px] rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Trash2 size={18} />
                Excluir Registro
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={saving}
              className="w-full h-10 text-gray-500 font-black uppercase tracking-widest text-[9px] hover:text-white transition-colors"
            >
              Abortar Operação
            </button>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
