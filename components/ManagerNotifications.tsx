import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  managerNotificationService,
  type ManagerNotification,
} from '../services/managerNotificationService';

export const ManagerNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ManagerNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setItems(await managerNotificationService.getRecent());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const unsubscribe = managerNotificationService.subscribe(() => void load());
    return unsubscribe;
  }, []);

  const unread = useMemo(() => items.filter(item => !item.read_at).length, [items]);

  const openItem = async (item: ManagerNotification) => {
    if (!item.read_at) {
      try {
        await managerNotificationService.markRead(item.id);
        setItems(current => current.map(value => value.id === item.id ? { ...value, read_at: new Date().toISOString() } : value));
      } catch {}
    }
    setOpen(false);
    navigate('/field-entries');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(value => !value)}
        className="relative size-9 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white flex items-center justify-center"
        title="Notificações do gestor"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-warning text-black text-[9px] font-black flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[min(88vw,380px)] bg-surface-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Gestor</p>
              <p className="text-sm font-black text-white">Notificações</p>
            </div>
            {loading && <Loader2 size={15} className="animate-spin text-primary" />}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-xs text-gray-600 text-center">Nenhuma notificação.</p>
            ) : items.map(item => (
              <button
                key={item.id}
                onClick={() => void openItem(item)}
                className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/[0.03] transition-colors ${!item.read_at ? 'bg-primary/[0.03]' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${!item.read_at ? 'bg-primary/10 text-primary' : 'bg-white/5 text-gray-600'}`}>
                    {!item.read_at ? <Bell size={14} /> : <Check size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white">{item.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{item.message}</p>
                    <p className="text-[8px] text-gray-600 mt-2">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/field-entries'); }}
            className="w-full h-11 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
          >
            Abrir registros de campo
          </button>
        </div>
      )}
    </div>
  );
};
