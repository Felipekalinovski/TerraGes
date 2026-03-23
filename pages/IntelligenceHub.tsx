
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { 
  Zap, 
  Search, 
  MessageSquare, 
  BarChart3, 
  ShieldCheck, 
  Activity, 
  Terminal,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock
} from 'lucide-react';
import { intelligenceAssistantService } from '../services/intelligenceAssistantService';
import { machineService } from '../services/machineService';

export const IntelligenceHub: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  const [healthStats, setHealthStats] = useState({
    avgScore: 0,
    criticalCount: 0,
    optimizations: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const machines = await machineService.getAll();
      const avg = machines.reduce((acc, m) => acc + (m.health_score || 0), 0) / (machines.length || 1);
      const critical = machines.filter(m => (m.health_score || 0) < 40).length;
      
      setHealthStats({
        avgScore: Math.round(avg),
        criticalCount: critical,
        optimizations: Math.floor(machines.length / 3) // Mock optimization count
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSmartQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await intelligenceAssistantService.generateReportData(query);
      setReportResult(result);
    } catch (error) {
      console.error(error);
      alert('Erro ao processar consulta inteligente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Layout.Header 
        title="Intelligence Hub" 
        subTitle="Análise preditiva e assistente tático"
      />

      <Layout.Content>
        <div className="px-6 space-y-10 pb-20 max-w-7xl mx-auto">
          
          {/* Hero Section: Search & Command */}
          <div className="relative group animate-in fade-in slide-in-from-top-10 duration-1000">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-surface-dark/60 backdrop-blur-2xl p-10 rounded-[2px] border-l-4 border-primary shadow-2xl">
              <h2 className="text-4xl font-black text-white italic tracking-tighter mb-8 flex items-center gap-4">
                <Terminal className="text-primary hidden sm:block" size={40} />
                COMMAND CENTER
              </h2>
              
              <form onSubmit={handleSmartQuery} className="relative">
                <input 
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: 'Listar máquinas em estado crítico' ou 'Diagnóstico de manutenção do mês'"
                  className="w-full bg-black/40 border border-white/5 p-6 pr-16 rounded-[2px] text-white placeholder-gray-600 focus:border-primary/50 outline-none transition-all font-mono text-sm shadow-inner"
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="absolute right-4 top-1/2 -translate-y-1/2 size-12 bg-primary text-black rounded-[0px] flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  {loading ? <RefreshCw className="animate-spin" /> : <Search />}
                </button>
              </form>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Col: Stats & Insights (90 style) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Insight Summary Result */}
              {reportResult && (
                <div className="bg-white/5 border border-white/10 p-8 rounded-[4px] animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="text-primary" size={24} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Insight da IA</span>
                  </div>
                  <p className="text-xl text-gray-200 leading-relaxed font-medium italic">
                    "{reportResult.insight}"
                  </p>
                  
                  <div className="mt-8 overflow-x-auto border border-white/5 rounded-sm">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-white/5 text-gray-500 uppercase tracking-widest border-b border-white/10">
                        <tr>
                          <th className="p-4 font-black">ID</th>
                          <th className="p-4 font-black">ENTIDADE</th>
                          <th className="p-4 font-black text-right">VALOR/STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportResult.data.slice(0, 5).map((row: any, i: number) => (
                           <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4 text-gray-400">#{row.id.substring(0, 8)}</td>
                              <td className="p-4 text-white font-bold">{row.name || row.title || row.type}</td>
                              <td className="p-4 text-right">
                                <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
                                  {row.status || (row.amount ? `R$ ${row.amount}` : row.type)}
                                </span>
                              </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Maintenance Health Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface-dark/40 border-t-2 border-white/5 p-6 flex items-center justify-between group hover:bg-white/5 transition-all">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Health Score Médio</p>
                    <p className="text-3xl font-black text-white italic">{healthStats.avgScore}%</p>
                  </div>
                  <Activity size={32} className="text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="bg-surface-dark/40 border-t-2 border-white/5 p-6 flex items-center justify-between group hover:bg-white/5 transition-all">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Casos Críticos</p>
                    <p className="text-3xl font-black text-negative italic">{healthStats.criticalCount.toString().padStart(2, '0')}</p>
                  </div>
                  <ShieldCheck size={32} className="text-negative opacity-20 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Tactical Cards */}
              <div className="grid grid-cols-1 gap-4">
                 <div className="bg-black/40 border border-white/5 p-8 rounded-[2px] flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-6 text-center sm:text-left">
                       <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <BarChart3 size={32} />
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-white uppercase italic tracking-tight">Otimização de Custos</h4>
                          <p className="text-xs text-gray-500">IA detectou {healthStats.optimizations} oportunidades de economia na manutenção preventiva.</p>
                       </div>
                    </div>
                    <button className="bg-white text-black px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors flex items-center gap-2">
                       VER DETALHES <ArrowRight size={14} />
                    </button>
                 </div>
              </div>
            </div>

            {/* Right Col: Tutor (10 style) - Sidebar assistant */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-brand-dark/80 p-6 border border-white/5 rounded-[4px] sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="text-primary" size={20} />
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic">Virtual Tutor</h3>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="bg-white/5 p-4 rounded-xl text-[11px] text-gray-400 italic border-l-2 border-primary">
                    "Olá! Sou seu assistente 24/7. Pode me perguntar sobre manutenção ou uso do sistema."
                  </div>
                  {/* Mock Chat History could go here */}
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Sua dúvida técnica..."
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 size-8 bg-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all">
                    <Zap size={14} />
                  </button>
                </div>

                <div className="mt-8 space-y-2">
                   <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-4">Destaques da IA</p>
                   <div className="flex items-center gap-3 text-xs text-gray-300 p-3 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
                      <Clock size={16} className="text-primary opacity-50" />
                      <span>Plano de Manutenção Sugerido p/ Retro-01</span>
                      <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div className="flex items-center gap-3 text-xs text-gray-300 p-3 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
                      <ShieldCheck size={16} className="text-warning opacity-50" />
                      <span>Alerta de Risco: Clima em Itaboraí</span>
                      <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </Layout.Content>
    </Layout>
  );
};
