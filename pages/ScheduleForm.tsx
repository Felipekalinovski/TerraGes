
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Clock, Save, Loader2, Trash2 } from 'lucide-react';
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
    type: '' as any,
    start_time: '',
    end_time: '',
    priority: 'medium' as any,
    notes: ''
  });

  useEffect(() => {
    if (isEditing && id) loadSchedule(id);
  }, [isEditing, id]);

  const loadSchedule = async (sid: string) => {
    try {
      setLoading(true);
      const s = await scheduleService.getById(sid);
      if (s) setFormData({ title: s.title, type: s.type, start_time: s.start_time.slice(0,16), end_time: s.end_time?.slice(0,16) || '', priority: s.priority, notes: s.notes || '' });
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (isEditing && id) await scheduleService.update(id, formData);
      else await scheduleService.create(formData);
      navigate('/schedule');
    } finally { setSaving(false); }
  };

  return (
    <Layout title={isEditing ? "Editar" : "Novo Agendamento"} showBack hideNav={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <input type="text" placeholder="Título" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4">
          <option value="excavation">Escavação</option>
          <option value="transport">Transporte</option>
        </select>
        <input type="datetime-local" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full h-12 bg-[#4b3220] rounded-xl px-4" />
        <button type="submit" className="w-full bg-primary h-12 rounded-xl font-bold">{saving ? <Loader2 className="animate-spin" /> : <Save size={20}/>} Salvar</button>
      </form>
    </Layout>
  );
};
