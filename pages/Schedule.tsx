
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Calendar as CalendarIcon, Edit2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { scheduleService } from '../services/scheduleService';

interface CalendarEvent {
  id: string;
  title: string;
  category: string;
  start: Date;
  end: Date;
  location: string;
  responsible: string;
  color: string;
  bg: string;
}

export const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const schedules = await scheduleService.getAll();
      const calendarEvents: CalendarEvent[] = schedules.map(s => ({
        id: s.id,
        title: s.title,
        category: s.type,
        start: new Date(s.start_time),
        end: s.end_time ? new Date(s.end_time) : new Date(s.start_time),
        location: 'Local base',
        responsible: 'Equipe',
        color: 'text-primary',
        bg: 'bg-primary'
      }));
      setEvents(calendarEvents);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

  return (
    <Layout title="Agenda" hideNav={false}>
      <div className="flex flex-col h-full px-4 pt-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setView('month')} className={`flex-1 py-2 rounded-lg ${view === 'month' ? 'bg-primary' : 'bg-surface-dark'}`}>Mês</button>
          <button onClick={() => setView('day')} className={`flex-1 py-2 rounded-lg ${view === 'day' ? 'bg-primary' : 'bg-surface-dark'}`}>Dia</button>
        </div>
        
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            <div className="grid grid-cols-7 gap-1">
              {/* Basic grid render placeholder */}
              {Array.from({ length: 31 }).map((_, i) => (
                <div key={i} className="h-10 flex items-center justify-center border border-white/5 rounded-lg">{i + 1}</div>
              ))}
            </div>
            <button onClick={() => navigate('/schedule/new')} className="w-full bg-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Plus size={20}/> Novo Agendamento</button>
          </div>
        )}
      </div>
    </Layout>
  );
};
