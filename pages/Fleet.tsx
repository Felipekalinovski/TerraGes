import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Search, Filter, Plus, Clock, Wrench, Calendar, ChevronRight, PenTool, History, Edit2, Loader2 } from 'lucide-react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import { FleetForm } from './FleetForm';
import { machineService, type Machine as SupabaseMachine } from '../services/machineService';

const FleetList: React.FC = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<SupabaseMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ active: 0, maintenance: 0, inactive: 0, total: 0 });

  useEffect(() => {
    loadMachines();
    loadStats();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const data = await machineService.getAll();
      setMachines(data);
    } catch (error) {
      console.error('Error loading machines:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await machineService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredMachines = machines.filter(machine =>
    machine.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout title="Minha Frota" hideNav={false}>
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="bg-surface-dark p-3 rounded-xl text-center">
          <p className="text-[10px] text-gray-400">Ativas</p>
          <p className="text-2xl font-bold text-positive">{stats.active}</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl text-center">
          <p className="text-[10px] text-gray-400">Manutenção</p>
          <p className="text-2xl font-bold text-warning">{stats.maintenance}</p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl text-center">
          <p className="text-[10px] text-gray-400">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
      </div>

      <div className="px-4 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-dark border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white"
          />
        </div>
      </div>

      <div className="px-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-primary" />
          </div>
        ) : (
          filteredMachines.map(machine => (
            <div
              key={machine.id}
              onClick={() => navigate(`/fleet/${machine.id}`)}
              className="bg-surface-dark p-4 rounded-xl border border-white/5 flex gap-3 items-center cursor-pointer"
            >
              {machine.image_url && (
                <div className="size-16 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${machine.image_url})` }} />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate">{machine.name}</h3>
                <p className="text-xs text-gray-400">{machine.type}</p>
              </div>
              <ChevronRight size={18} className="text-gray-600" />
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-24 right-4 animate-bounce">
        <button onClick={() => navigate('/fleet/add')} className="bg-primary text-white p-4 rounded-full shadow-lg">
          <Plus size={24} />
        </button>
      </div>
    </Layout>
  );
};

export const Fleet: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<FleetList />} />
      <Route path="/add" element={<FleetForm />} />
      <Route path="/edit/:id" element={<FleetForm />} />
      <Route path="/:id" element={<div>Detalhes em breve</div>} />
    </Routes>
  );
};
