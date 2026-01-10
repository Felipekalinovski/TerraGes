import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Plus, Calendar, MapPin, User, Eye, Edit2, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { rdoService, RDO as RDOType } from '../services/rdoService';

export const RDO: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRDOs();
  }, []);

  const fetchRDOs = async () => {
    try {
      const data = await rdoService.getAll();
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
    <Layout title="Diário de Obra" hideNav={false} actions={
      <button
        onClick={() => navigate('/rdo/new')}
        className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 active:scale-95 transition-transform"
      >
        <Plus size={16} /> Novo
      </button>
    }>
      <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        {['Data', 'Obra', 'Operador', 'Atividade'].map(filter => (
          <button key={filter} className="flex items-center gap-2 px-3 py-1.5 bg-surface-dark rounded-lg text-xs whitespace-nowrap border border-white/5 hover:bg-white/5 transition-colors">
            {filter === 'Data' && <Calendar size={12} />}
            {filter === 'Obra' && <MapPin size={12} />}
            {filter === 'Operador' && <User size={12} />}
            {filter}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4 mt-2 pb-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : logs.length > 0 ? logs.map(log => (
          <div key={log.id} className="bg-surface-dark rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg text-white">{log.projects?.name || 'Obra não identificada'}</h3>
                <p className="text-xs text-gray-400">{new Date(log.date).toLocaleString('pt-BR')}</p>
              </div>
              <div className="flex gap-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary`}>
                  #{log.weather === 'sunny' ? 'Ensolarado' : log.weather === 'rainy' ? 'Chuvoso' : 'Nublado'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-sm text-gray-300 mb-4">
              <p><span className="text-gray-500 font-medium">Atividades:</span> {log.activities}</p>
              <p><span className="text-gray-500 font-medium">Máquinas:</span> {log.machines?.join(', ') || 'Nenhuma'}</p>
              {log.occurrences && <p><span className="text-gray-500 font-medium">Obs:</span> {log.occurrences}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
              <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><Eye size={18} /></button>
              <button
                onClick={() => handleDelete(log.id)}
                className="p-2 hover:bg-white/5 rounded-lg text-negative/80 hover:text-negative transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        )) : (
          <p className="text-center text-gray-500 py-10">Nenhum diário de obra encontrado.</p>
        )}
      </div>
    </Layout>
  );
};
