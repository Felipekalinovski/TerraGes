import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Plus, Calendar, MapPin, User, Eye, Edit2, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { rdoService, RDO as RDOType } from '../services/rdoService';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../services/roleService';

export const RDO: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = isAdminUser(profile?.role);

  useEffect(() => {
    if (profile) {
      fetchRDOs();
    }
  }, [profile]);

  const fetchRDOs = async () => {
    try {
      let data = await rdoService.getAll();
      
      // RBAC Filter: If not admin, show only own RDOs
      if (!isAdmin && profile?.id) {
        data = data.filter(log => log.operator_id === profile.id);
      }
      
      setLogs(data);
    } catch (error) {
      console.error('Erro ao carregar RDOs:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este Diário de Obra?')) {
      try {
        await rdoService.delete(id);
        fetchRDOs();
      } catch (error) {
        alert('Erro ao excluir RDO.');
      }
    }
  };

  return (
    <Layout>
      <Layout.Header 
        title="Diário de Obra" 
        subTitle="Relatórios de Campo"
        actions={
          <button
            onClick={() => navigate('/rdo/new')}
            className="bg-primary text-black px-4 py-2 rounded-xl text-xs font-black uppercase italic tracking-tighter flex items-center gap-2 shadow-neon active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={3} /> Novo RDO
          </button>
        }
      />
      
      <Layout.Content>
        {/* Filters */}
        <div className="px-4 py-4 flex gap-3 overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-top-4 duration-500">
          {[
            { label: 'Data', icon: <Calendar size={14} /> },
            { label: 'Obra', icon: <MapPin size={14} /> },
            { label: 'Operador', icon: <User size={14} /> },
            { label: 'Atividade', icon: null }
          ].map(filter => (
            <button key={filter.label} className="flex items-center gap-2 px-4 py-2 bg-surface-dark/40 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-gray-400 hover:text-white">
              {filter.icon}
              {filter.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="px-4 space-y-5 mt-2 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-primary" size={40} />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sincronizando relatórios...</p>
            </div>
          ) : logs.length > 0 ? logs.map(log => (
            <div key={log.id} className="bg-surface-dark/40 backdrop-blur-md rounded-[32px] p-6 border border-white/5 shadow-glass group hover:border-primary/20 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="font-heading font-black text-xl text-white uppercase italic tracking-tight group-hover:text-primary transition-colors">
                    {log.projects?.name || 'Obra não identificada'}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <Calendar size={12} className="text-primary/60" />
                    {new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    <span className="opacity-30">|</span>
                    <span className="text-white/40">{new Date(log.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                    log.weather === 'sunny' ? 'bg-positive/10 border-positive/20 text-positive shadow-neon-sm' : 
                    log.weather === 'rainy' ? 'bg-negative/10 border-negative/20 text-negative' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                  }`}>
                    {log.weather === 'sunny' ? 'Céu Limpo' : log.weather === 'rainy' ? 'Chuvoso' : 'Nublado'}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Atividades Realizadas</p>
                  <p className="text-sm text-gray-200 leading-relaxed italic">"{log.activities}"</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {log.machines?.map((m: string) => (
                    <span key={m} className="bg-surface-dark/60 px-3 py-1.5 rounded-xl border border-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      {m}
                    </span>
                  ))}
                </div>

                {log.occurrences && (
                  <div className="flex gap-2 items-start border-l-2 border-warning/30 pl-3">
                    <p className="text-xs text-gray-400 italic"><span className="text-warning/80 font-black uppercase text-[9px] tracking-widest not-italic mr-2">Obs:</span>{log.occurrences}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all">
                  <Eye size={16} /> Ver Tudo
                </button>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="flex items-center justify-center size-10 bg-negative/10 hover:bg-negative/20 rounded-xl text-negative transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-20 bg-surface-dark/20 rounded-[40px] border border-dashed border-white/5">
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Nenhum RDO sincronizado.</p>
              <button 
                onClick={() => navigate('/rdo/new')}
                className="mt-6 text-primary font-black uppercase italic tracking-tighter text-xs hover:brightness-125 transition-all"
              >
                Criar Primeiro Relatório +
              </button>
            </div>
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};
