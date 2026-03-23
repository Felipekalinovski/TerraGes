import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Calendar as CalendarIcon, MoreHorizontal, Edit2, Loader2, Sparkles, Filter, BarChart2, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { scheduleService, type Schedule as SupabaseSchedule } from '../services/scheduleService';
import { useAuth } from '../contexts/AuthContext';

// --- Types & Helpers ---

interface CalendarEvent {
  id: string;
  title: string;
  category: 'Escavação' | 'Transporte' | 'Manutenção' | 'Outros';
  start: Date;
  end: Date;
  location: string;
  responsible: string;
  color: string;
  bg: string;
}

// Gera eventos baseados na data atual para que o calendário sempre tenha dados visíveis
const generateMockEvents = (baseDate: Date): CalendarEvent[] => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const today = baseDate.getDate();

  return [
    {
      id: '1',
      title: 'Terraplanagem Lote 12',
      category: 'Escavação',
      start: new Date(year, month, today, 8, 0),
      end: new Date(year, month, today, 12, 0),
      location: 'Cond. Sol Nascente',
      responsible: 'Equipe Alpha',
      color: 'text-primary',
      bg: 'bg-primary',
    },
    {
      id: '2',
      title: 'Manutenção Preventiva',
      category: 'Manutenção',
      start: new Date(year, month, today, 14, 0),
      end: new Date(year, month, today, 16, 30),
      location: 'Oficina Central',
      responsible: 'Mec. João',
      color: 'text-blue-400',
      bg: 'bg-blue-500',
    },
    {
      id: '3',
      title: 'Transporte de Material',
      category: 'Transporte',
      start: new Date(year, month, today + 1, 9, 0),
      end: new Date(year, month, today + 1, 11, 0),
      location: 'Setor Norte',
      responsible: 'Caminhão 05',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500',
    },
    {
      id: '4',
      title: 'Reunião de Segurança',
      category: 'Outros',
      start: new Date(year, month, today - 2, 7, 30),
      end: new Date(year, month, today - 2, 8, 30),
      location: 'Sede',
      responsible: 'Téc. Segurança',
      color: 'text-positive',
      bg: 'bg-positive',
    },
    {
      id: '5',
      title: 'Compactação de Solo',
      category: 'Escavação',
      start: new Date(year, month, today + 3, 10, 0),
      end: new Date(year, month, today + 3, 15, 0),
      location: 'Rodovia BR-101',
      responsible: 'Equipe Beta',
      color: 'text-primary',
      bg: 'bg-primary',
    },
  ];
};

type ViewType = 'month' | 'week' | 'day';

export const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente' || profile?.role === 'proprietario';

  useEffect(() => {
    if (profile) {
      loadSchedules();
    }
  }, [profile]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      let schedules = await scheduleService.getAll();

      // RBAC Filter: If not admin, show only own schedules
      if (!isAdmin && profile?.id) {
          schedules = schedules.filter(s => s.operator_id === profile.id);
      }

      // Convert Supabase schedules to CalendarEvent format
      const calendarEvents: CalendarEvent[] = schedules.map(schedule => {
        const categoryMap: Record<string, CalendarEvent['category']> = {
          'excavation': 'Escavação',
          'transport': 'Transporte',
          'maintenance': 'Manutenção',
          'other': 'Outros'
        };

        const colorMap: Record<string, { color: string; bg: string }> = {
          'excavation': { color: 'text-primary', bg: 'bg-primary' },
          'transport': { color: 'text-yellow-400', bg: 'bg-yellow-500' },
          'maintenance': { color: 'text-blue-400', bg: 'bg-blue-500' },
          'other': { color: 'text-positive', bg: 'bg-positive' }
        };

        const colors = colorMap[schedule.type] || colorMap['other'];

        return {
          id: schedule.id,
          title: schedule.title,
          category: categoryMap[schedule.type] || 'Outros',
          start: new Date(schedule.start_time),
          end: schedule.end_time ? new Date(schedule.end_time) : new Date(schedule.start_time),
          location: 'Local não especificado',
          responsible: 'Não atribuído',
          color: colors.color,
          bg: colors.bg,
        };
      });

      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error loading schedules:', error);
      alert('Erro ao carregar agendamentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers de Data ---

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0 = Domingo

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Começa no Domingo
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

  // --- Handlers de Navegação ---

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
    if (view === 'day') setSelectedDate(newDate);
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
    if (view === 'day') setSelectedDate(newDate);
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  // --- Título do Cabeçalho ---

  const getHeaderTitle = () => {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    if (view === 'day') {
      return `${currentDate.getDate()} de ${monthNames[currentDate.getMonth()]}`;
    }
    if (view === 'week') {
      const weekDays = getWeekDays(currentDate);
      const first = weekDays[0];
      const last = weekDays[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} - ${last.getDate()} de ${monthNames[first.getMonth()]}`;
      }
      return `${first.getDate()} ${monthNames[first.getMonth()].substr(0, 3)} - ${last.getDate()} ${monthNames[last.getMonth()].substr(0, 3)}`;
    }
    return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  // --- Renderizadores ---

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Espaços vazios antes do dia 1
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-12 w-full" />);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const dateToCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isSelected = isSameDay(dateToCheck, selectedDate);
      const isToday = isSameDay(dateToCheck, new Date());

      const dayEvents = events.filter(e => isSameDay(e.start, dateToCheck));
      const hasEvents = dayEvents.length > 0;

      days.push(
        <div key={day} className="h-12 w-full flex items-center justify-center relative group">
          <button
            onClick={() => handleDateClick(day)}
            className={`
              relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
              ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/40' :
                isToday ? 'bg-surface-dark border border-primary text-primary' :
                  'text-gray-300 hover:bg-white/10'}
            `}
          >
            {day}
            {hasEvents && !isSelected && (
              <div className="absolute bottom-1 flex gap-0.5">
                {dayEvents.slice(0, 3).map((ev, i) => (
                  <div key={i} className={`w-1 h-1 rounded-full ${ev.bg}`} />
                ))}
              </div>
            )}
          </button>
        </div>
      );
    }
    return days;
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const weekDaysNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
      <div className="flex flex-col gap-3">
        {weekDays.map((day, index) => {
          const dayEvents = events.filter(e => isSameDay(e.start, day));
          const isToday = isSameDay(day, new Date());

          return (
            <div key={index} className={`flex gap-3 p-3 rounded-xl border transition-colors ${isToday ? 'bg-surface-dark border-primary/50' : 'bg-surface-dark/50 border-transparent hover:bg-surface-dark'}`}>
              <div className="flex flex-col items-center justify-center min-w-[50px] border-r border-white/5 pr-3">
                <span className="text-[10px] text-gray-500 uppercase font-bold">{weekDaysNames[day.getDay()]}</span>
                <span className={`text-xl font-bold ${isToday ? 'text-primary' : 'text-white'}`}>{day.getDate()}</span>
              </div>

              <div className="flex-1 space-y-2 py-1">
                {dayEvents.length === 0 ? (
                  <div className="h-full flex items-center text-xs text-gray-600 italic">Sem eventos</div>
                ) : (
                  dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="bg-black/20 border-l-2 border-primary/50 p-2 rounded flex items-center gap-2 cursor-pointer hover:bg-black/30 group"
                      onClick={() => navigate(`/schedule/edit/${ev.id}`)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${ev.bg}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{ev.title}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={8} />
                          {ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                          {ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Edit2 size={12} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 13 }, (_, i) => i + 6); // 06:00 to 18:00
    const dayEvents = events.filter(e => isSameDay(e.start, currentDate));

    return (
      <div className="flex flex-col relative pb-4">
        {hours.map(hour => {
          const hourEvents = dayEvents.filter(e => e.start.getHours() === hour);

          return (
            <div key={hour} className="flex gap-4 group min-h-[60px]">
              <div className="w-12 text-right text-xs text-gray-500 -mt-2 transform translate-y-2 font-mono">
                {hour}:00
              </div>

              <div className="flex-1 relative border-t border-white/5 group-last:border-b">
                {hourEvents.map(ev => (
                  <div
                    key={ev.id}
                    className={`absolute left-0 right-0 mx-1 p-2 rounded border-l-2 ${ev.bg.replace('bg-', 'border-')} bg-surface-dark shadow-lg z-10 cursor-pointer hover:brightness-110`}
                    style={{ top: `${(ev.start.getMinutes() / 60) * 100}%` }}
                    onClick={() => navigate(`/schedule/edit/${ev.id}`)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-xs">{ev.title}</h4>
                        <p className="text-[10px] text-gray-400">{ev.category}</p>
                      </div>
                      <span className="text-[10px] bg-black/30 px-1 rounded text-gray-300">
                        {ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                      <span className="flex items-center gap-0.5"><MapPin size={10} /> {ev.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {/* Linha do tempo atual (se for hoje) */}
        {isSameDay(currentDate, new Date()) && (
          <div
            className="absolute left-16 right-0 border-t-2 border-red-500 z-20 flex items-center pointer-events-none"
            style={{ top: `${((new Date().getHours() - 6) * 60 + new Date().getMinutes())}px` }}
          >
            <div className="size-2 bg-red-500 rounded-full -ml-1"></div>
          </div>
        )}
      </div>
    );
  };

  const renderSelectedDayEvents = () => {
    if (view !== 'month') return null; // Só mostra na visão mensal

    const dayEvents = events.filter(e => isSameDay(e.start, selectedDate));
    const isToday = isSameDay(selectedDate, new Date());

    return (
      <div className="space-y-3 mt-2">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            {isToday ? 'Hoje' : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}
          </h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{dayEvents.length} Eventos</span>
        </div>

        {dayEvents.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center text-gray-600 bg-surface-dark/30 rounded-xl border border-white/5 border-dashed">
            <CalendarIcon className="mb-2 opacity-30" size={32} />
            <p className="text-sm">Nenhum serviço agendado para este dia.</p>
            <button onClick={() => navigate('/schedule/new')} className="mt-2 text-primary text-xs font-bold hover:underline">Agendar Agora</button>
          </div>
        ) : (
          dayEvents.map(ev => (
            <div key={ev.id} className={`bg-surface-dark p-3 rounded-xl border-l-4 ${ev.bg.replace('bg-', 'border-')} shadow-sm border-y border-r border-white/5 flex flex-col gap-2 relative group`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-sm">{ev.title}</h4>
                  <p className="text-xs text-gray-400">{ev.category}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded bg-black/20 text-gray-300`}>
                  {ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-white/5 pt-2 mt-1">
                <span className="flex items-center gap-1"><MapPin size={12} /> {ev.location}</span>
                <span className="flex items-center gap-1 ml-auto">
                  <div className={`w-1.5 h-1.5 rounded-full ${ev.bg}`}></div>
                  {ev.responsible}
                </span>
              </div>

              <button
                onClick={() => navigate(`/schedule/edit/${ev.id}`)}
                className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <Edit2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <Layout>
      <Layout.Header 
        title="Agenda Operacional" 
        subTitle="Gestão de prazos e alocação de recursos"
      >
        <button
          onClick={() => { setView('day'); setCurrentDate(new Date()); }}
          className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-white/5 active:scale-95 shadow-glass-sm"
          title="Hoje"
        >
          <CalendarIcon size={20} />
        </button>
      </Layout.Header>

      <Layout.Content>
        <div className="flex flex-col h-full animate-in fade-in duration-700">
          {/* Custom Segmented Control */}
          <div className="px-4 py-6">
            <div className="flex h-12 w-full rounded-2xl bg-surface-dark/40 backdrop-blur-md p-1.5 border border-white/5 shadow-glass">
              {(['month', 'week', 'day'] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 italic ${
                    view === v 
                      ? 'bg-primary text-black shadow-neon-sm translate-y-[-1px]' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
                </button>
              ))}
            </div>
          </div>

          {/* Premium Calendar Navigation */}
          <div className="flex items-center justify-between px-4 pb-6">
            <button 
              onClick={handlePrev} 
              className="size-11 bg-surface-dark/40 backdrop-blur-md rounded-2xl text-gray-400 hover:text-primary transition-all border border-white/5 active:scale-90 flex items-center justify-center group shadow-glass-sm"
            >
              <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            
            <div className="flex flex-col items-center">
              <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] italic font-heading">
                {getHeaderTitle()}
              </h2>
              {view === 'month' && (
                <div className="w-12 h-1 bg-primary/20 rounded-full mt-1.5 overflow-hidden">
                   <div className="h-full bg-primary w-1/3 animate-pulse"></div>
                </div>
              )}
            </div>

            <button 
              onClick={handleNext} 
              className="size-11 bg-surface-dark/40 backdrop-blur-md rounded-2xl text-gray-400 hover:text-primary transition-all border border-white/5 active:scale-90 flex items-center justify-center group shadow-glass-sm"
            >
              <ChevronRight size={22} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Dynamic Content Area */}
          <div className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="relative">
                  <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={24} />
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando Escopos...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {view === 'month' && (
                  <div className="bg-surface-dark/20 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass">
                    {/* Days Header */}
                    <div className="grid grid-cols-7 mb-4">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day, idx) => (
                        <div key={idx} className="text-center text-[9px] font-black text-gray-500 uppercase tracking-widest italic">
                          {day}
                        </div>
                      ))}
                    </div>
                    {/* Month Grid */}
                    <div className="grid grid-cols-7 gap-y-1">
                      {renderMonthView()}
                    </div>
                    {/* Selected Day Context */}
                    <div className="mt-10 animate-in slide-in-from-top-4 duration-500">
                      {renderSelectedDayEvents()}
                    </div>
                  </div>
                )}

                {view === 'week' && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    {renderWeekView()}
                  </div>
                )}

                {view === 'day' && (
                  <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 shadow-glass animate-in zoom-in-95 duration-500">
                    {renderDayView()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Floating Action Button (FAB) */}
          <div className="fixed bottom-28 right-6 z-40 group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 animate-pulse"></div>
            <button
              onClick={() => navigate('/schedule/new')}
              className="relative flex items-center justify-center size-16 bg-primary text-black rounded-full shadow-neon border border-white/10 hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
