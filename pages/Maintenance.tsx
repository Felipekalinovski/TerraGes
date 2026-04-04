
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Wrench, AlertTriangle, CheckCircle, Clock, Plus, Filter, ChevronRight, AlertOctagon, Edit2, Loader2, Sparkles } from 'lucide-react';
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
    <Layout>
      <Layout.Header 
        title="Gestão de Manutenção" 
        subTitle="Controle preventivo e corretivo da frota"
        actions={
          <button
            onClick={() => navigate('/maintenance/new')}
            className="bg-primary text-black p-2.5 rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Nova Manutenção</span>
          </button>
        }
      />

      <Layout.Content>
        <div className="px-4 space-y-6 pb-32">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 shadow-glass group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-8 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                  <Wrench size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-warning transition-colors">Em Curso</span>
              </div>
              <p className="text-3xl font-black text-white italic font-heading tracking-tighter">{stats.inMaintenance.toString().padStart(2, '0')}</p>
            </div>
            
            <div className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 shadow-glass group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-8 rounded-xl bg-negative/10 flex items-center justify-center text-negative">
                  <AlertOctagon size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-negative transition-colors">Críticas</span>
              </div>
              <p className="text-3xl font-black text-white italic font-heading tracking-tighter">{stats.overdue.toString().padStart(2, '0')}</p>
            </div>

            <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[40px] border border-white/5 shadow-glass group hover:border-primary/20 transition-all col-span-2 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle size={80} strokeWidth={1} />
              </div>
              <div className="relative z-10 text-center py-2">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Investimento este Mês</p>
                <p className="text-4xl font-black text-white italic font-heading tracking-tight drop-shadow-neon-sm">
                  {formatCurrency(stats.totalCost)}
                </p>
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex items-center justify-between px-1 mb-6">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic font-heading flex items-center gap-2">
                <Clock size={14} className="text-primary" />
                Manutenções Recentes
              </h3>
              <button className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/10">
                <Filter size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-primary gap-4">
                  <Loader2 size={48} className="animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando Dados...</span>
                </div>
              ) : maintenances.length === 0 ? (
                <div className="bg-surface-dark/20 border-2 border-dashed border-white/5 rounded-[40px] py-20 flex flex-col items-center justify-center text-center px-6">
                  <div className="p-4 bg-white/5 rounded-full mb-4">
                    <Wrench size={40} className="text-gray-600" />
                  </div>
                  <h4 className="text-white font-black italic uppercase tracking-widest mb-2">Zero Manutenções</h4>
                  <p className="text-gray-500 text-xs mb-8">Sua frota está em dia. Nenhuma atividade registrada recentemente.</p>
                  <button
                    onClick={() => navigate('/maintenance/new')}
                    className="text-primary text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-4 transition-all"
                  >
                    Registrar Primeira <ChevronRight size={16} />
                  </button>
                </div>
              ) : (
                maintenances.map((item) => (
                  <div
                    key={item.id}
                    className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 flex items-center gap-4 hover:border-primary/20 transition-all group relative overflow-hidden shadow-glass"
                  >
                    <div className="absolute top-0 right-0 h-full w-1.5 bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
                    
                    <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-glass-sm border border-white/5 transition-transform group-hover:scale-110 ${
                      item.type === 'corrective' ? 'bg-negative/10 text-negative' : 
                      item.type === 'preventive' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      <Wrench size={24} strokeWidth={2} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1.5">
                        <h4 className="font-black text-white text-sm truncate uppercase tracking-tight italic font-heading">
                          {machines.get(item.machine_id) || 'Máquina não encontrada'}
                        </h4>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-white/5 border border-white/10 text-gray-500 tracking-widest">
                          {formatDate(item.date)}
                        </span>
                      </div>
                      
                        <div className={`flex items-center gap-3`}>
                          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${
                            item.type === 'corrective' ? 'bg-negative/10 border-negative/30 text-negative' : 
                            item.type === 'preventive' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          } text-[8px] font-black uppercase tracking-widest`}>
                             {getTypeLabel(item.type)}
                          </div>
                           <button 
                             onClick={(e) => { e.stopPropagation(); navigate('/chat'); }}
                             className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[8px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all font-heading italic"
                           >
                             <Sparkles size={10} /> IA Chat
                           </button>
                          {item.cost > 0 && (
                            <span className="text-[10px] font-bold text-gray-400 italic">
                              {formatCurrency(item.cost)}
                            </span>
                          )}
                        </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/maintenance/edit/${item.id}`); }}
                      className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
