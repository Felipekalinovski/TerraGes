import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Search, Plus, Filter, FileText, ChevronRight, Activity, Calendar, User, Clock, DollarSign, Download, Upload, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { serviceOrderService, ServiceOrder } from '../services/serviceOrderService';
import { useAuth } from '../contexts/AuthContext';

export const ServiceOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente' || profile?.role === 'proprietario';

    useEffect(() => {
        if (profile) {
            loadOrders();
        }
    }, [profile]);

    const loadOrders = async () => {
        try {
            let data = await serviceOrderService.getAll();
            
            // RBAC Filter: If not admin, show only own orders
            if (!isAdmin && profile?.id) {
                // In a real app, this should be filtered on the server (RLS)
                // For now, we perform frontend filtering as a first layer
                data = data.filter(order => order.operator_id === profile.id);
            }
            
            setOrders(data);
        } catch (error) {
            console.error('Error loading service orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-positive bg-positive/20';
            case 'pending': return 'text-warning bg-warning/20';
            case 'cancelled': return 'text-red-400 bg-red-400/20';
            default: return 'text-gray-400 bg-gray-400/20';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Concluído';
            case 'pending': return 'Pendente';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

  return (
    <Layout>
      <Layout.Header 
        title="Ordens de Serviço" 
        subTitle="Gestão de faturamento e entregas operacionais"
      />

      <Layout.Content>
        <div className="flex flex-col h-full animate-in fade-in duration-700">
          
          {/* Advanced KPI Section */}
          <div className="px-4 py-6 grid grid-cols-2 gap-4">
            <div className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 shadow-glass flex flex-col items-center group hover:border-primary/20 transition-all">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary mb-3 group-hover:scale-110 transition-transform">
                  <FileText size={22} />
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-black text-white italic tracking-tighter">{orders.length}</p>
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">Total de Ordens</p>
                </div>
            </div>
            
            <div className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[32px] border border-white/5 shadow-glass flex flex-col items-center group hover:border-positive/20 transition-all">
                <div className="p-2.5 rounded-2xl bg-positive/10 text-positive mb-3 group-hover:scale-110 transition-transform">
                  <Activity size={22} />
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-black text-white italic tracking-tighter">
                    {orders.filter(o => o.status === 'completed').length}
                  </p>
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">O.S. Liquidadas</p>
                </div>
            </div>
          </div>

          {/* Intelligent Search Hub */}
          <div className="px-4 mb-8 flex gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={20} />
              <input
                type="text"
                placeholder="Localizar protocolo ou cliente..."
                className="w-full h-14 bg-surface-dark/40 backdrop-blur-md border border-white/5 rounded-2xl pl-12 pr-4 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-600 transition-all shadow-glass-sm"
              />
            </div>
            <button className="size-14 bg-surface-dark/40 backdrop-blur-md border border-white/5 rounded-2xl flex items-center justify-center text-gray-400 hover:text-primary transition-all active:scale-95 shadow-glass-sm">
              <Filter size={22} />
            </button>
            <button
              onClick={() => navigate('/service-orders/new')}
              className="size-14 bg-primary rounded-2xl flex items-center justify-center text-black shadow-neon transition-all hover:brightness-110 active:scale-90"
            >
              <Plus size={26} strokeWidth={3} />
            </button>
          </div>

          {/* Dynamic Order Table/List */}
          <div className="px-4 pb-32 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Sincronizando faturas...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center bg-surface-dark/20 rounded-[32px] border border-white/5 border-dashed">
                 <FileText size={48} className="text-gray-700 mb-4" />
                 <p className="text-sm font-bold text-gray-500 italic uppercase tracking-widest">Nenhuma ordem detectada</p>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/service-orders/${order.id}`)}
                  className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 hover:border-white/10 active:scale-[0.98] transition-all cursor-pointer group shadow-glass"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                       <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary border border-white/5 font-black italic group-hover:bg-primary/10 transition-colors">
                          OS
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Protocolo</span>
                          <span className="font-bold text-white group-hover:text-primary transition-colors tracking-tighter">#{order.id.slice(0, 8).toUpperCase()}</span>
                       </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] italic border shadow-sm ${
                      order.status === 'completed' ? 'bg-positive/10 text-positive border-positive/20' : 
                      order.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' : 
                      'bg-gray-500/10 text-gray-400 border-white/10'
                    }`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                       <User size={16} className="text-primary" />
                       <span className="text-xs font-bold text-white truncate">{order.client}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-gray-500" />
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">{new Date(order.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3 justify-end">
                        <Clock size={14} className="text-gray-500" />
                        <span className="text-[11px] font-black text-white italic tracking-tighter">{order.total_hours.toFixed(1)}H ACUMULADAS</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-primary animate-pulse"></div>
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{order.operator?.name || 'OPERADOR N/A'}</span>
                       </div>
                       <div className="flex items-center gap-1 font-black text-lg text-primary italic tracking-tight">
                          <span className="text-xs mr-1 not-italic opacity-50 font-medium">BRL</span>
                          {order.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                       </div>
                    </div>
                  </div>

                  {/* Actions Footer - Premium Hidden Actions */}
                  <div className="mt-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/service-orders/${order.id}/receipt`);
                      }}
                      className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-3 border border-white/5 transition-all"
                    >
                      <Download size={16} className="text-primary" />
                      Digitalizar Recibo
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/service-orders/${order.id}`);
                      }}
                      className="size-12 bg-white/5 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center border border-white/5 transition-all"
                    >
                      <Edit2 size={16} className="text-primary" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};

