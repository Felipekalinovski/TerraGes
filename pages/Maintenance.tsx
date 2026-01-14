
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Wrench, AlertTriangle, CheckCircle, Clock, Plus, Filter, ChevronRight, AlertOctagon, Edit2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { maintenanceService, type MaintenanceRecord as SupabaseMaintenanceRecord } from '../services/maintenanceService';
import { machineService } from '../services/machineService';

export const Maintenance: React.FC = () => {
  const navigate = useNavigate();
  const [maintenances, setMaintenances] = useState<SupabaseMaintenanceRecord[]>([]);
  const [machines, setMachines] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    inMaintenance: 0,
    overdue: 0,
    totalCost: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load maintenances
      const maintenanceData = await maintenanceService.getAll();
      setMaintenances(maintenanceData);

      // Load machines for display
      const machineData = await machineService.getAll();
      const machineMap = new Map();
      machineData.forEach(machine => {
        machineMap.set(machine.id, machine.name);
      });
      setMachines(machineMap);

      // Calculate stats
      const machinesInMaintenance = machineData.filter(m => m.status === 'maintenance').length;

      // Get this month's cost
      const thisMonthRecords = await maintenanceService.getThisMonth();
      const monthlyCost = thisMonthRecords.reduce((sum, record) => sum + (record.cost || 0), 0);

      // Count overdue (machines with next_maintenance in the past)
      const today = new Date();
      const overdueCount = machineData.filter(m => {
        if (!m.next_maintenance) return false;
        const nextDate = new Date(m.next_maintenance);
        return nextDate < today && m.status !== 'maintenance';
      }).length;

      setStats({
        inMaintenance: machinesInMaintenance,
        overdue: overdueCount,
        totalCost: monthlyCost
      });

    } catch (error) {
      console.error('Error loading maintenance data:', error);
      alert('Erro ao carregar dados de manutenção.');
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'preventive': 'Preventiva',
      'corrective': 'Corretiva',
      'predictive': 'Preditiva'
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Layout title="Gestão de Manutenção" hideNav={false}>

      {/* Overview Cards */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <span className="p-2 bg-warning/10 rounded-lg text-warning">
              <Wrench size={20} />
            </span>
            <span className="text-2xl font-bold text-white">{stats.inMaintenance}</span>
          </div>
          <p className="text-xs text-gray-400">Máquinas em Manutenção</p>
        </div>

        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <span className="p-2 bg-negative/10 rounded-lg text-negative">
              <AlertOctagon size={20} />
            </span>
            <span className="text-2xl font-bold text-white">{stats.overdue}</span>
          </div>
          <p className="text-xs text-gray-400">Atrasadas / Críticas</p>
        </div>

        <div className="bg-surface-dark p-4 rounded-xl border border-white/5 shadow-sm col-span-2">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-gray-400">Custo Total (Mês)</p>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(stats.totalCost)}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-4 mb-6">
        <button
          onClick={() => navigate('/maintenance/new')}
          className="w-full h-14 bg-primary text-black font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors"
        >
          <Plus size={22} /> Nova Manutenção
        </button>
      </div>

      {/* List Header */}
      <div className="px-4 flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg text-white">Manutenções Recentes</h3>
        <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
          <Filter size={18} />
        </button>
      </div>

      {/* Maintenance List */}
      <div className="px-4 space-y-3 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-primary" />
          </div>
        ) : maintenances.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400">Nenhuma manutenção registrada.</p>
            <button
              onClick={() => navigate('/maintenance/new')}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Registrar primeira manutenção
            </button>
          </div>
        ) : (
          maintenances.map((item) => (
            <div
              key={item.id}
              className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors group relative"
            >
              <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 
                ${item.type === 'corrective' ? 'bg-negative/20 text-negative' : 'bg-blue-500/20 text-blue-400'}`}>
                <Wrench size={24} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-white text-sm truncate pr-2">
                    {machines.get(item.machine_id) || 'Máquina não encontrada'}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-surface-dark border border-white/10 text-gray-400">
                    {formatDate(item.date)}
                  </span>
                </div>
                <p className="text-xs text-text-gold">{getTypeLabel(item.type)}</p>
                {item.cost > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{formatCurrency(item.cost)}</p>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/maintenance/edit/${item.id}`); }}
                className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <Edit2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
};
