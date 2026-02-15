
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Search, Plus, Filter, FileText, ChevronRight, Activity, Calendar, User, Clock, DollarSign, Download, Upload, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { serviceOrderService, ServiceOrder } from '../services/serviceOrderService';

export const ServiceOrderList: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const data = await serviceOrderService.getAll();
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
        <Layout title="Ordens de Serviço" hideNav={false}>
            {/* KPI Cards */}
            <div className="px-4 py-4 grid grid-cols-2 gap-3">
                <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
                    <FileText size={20} className="text-primary mb-1" />
                    <p className="text-2xl font-bold text-white">{orders.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total O.S.</p>
                </div>
                <div className="bg-surface-dark p-3 rounded-xl border border-white/5 flex flex-col items-center">
                    <Activity size={20} className="text-positive mb-1" />
                    <p className="text-2xl font-bold text-white">
                        {orders.filter(o => o.status === 'completed').length}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Concluídas</p>
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-4 mb-4 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar O.S..."
                        className="w-full bg-surface-dark border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
                <button className="bg-surface-dark border border-white/5 w-10 h-10 rounded-lg flex items-center justify-center text-gray-300">
                    <Filter size={20} />
                </button>
                <button
                    onClick={() => navigate('/service-orders/new')}
                    className="bg-primary w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20"
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* Service Order List */}
            <div className="px-4 pb-6 space-y-3">
                {loading ? (
                    <div className="text-center text-gray-500 py-8">Carregando...</div>
                ) : orders.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">Nenhuma ordem de serviço encontrada.</div>
                ) : (
                    orders.map((order) => (
                        <div
                            key={order.id}
                            onClick={() => navigate(`/service-orders/${order.id}`)}
                            className="bg-surface-dark p-4 rounded-xl border border-white/5 active:scale-[0.98] transition-transform cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col">
                                    <span className="font-bold text-white">#{order.id.slice(0, 8)}</span>
                                    <span className="text-xs text-gray-400">{order.client}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(order.status)}`}>
                                    {getStatusLabel(order.status)}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 mt-3">
                                <div className="flex justify-between items-center text-xs text-gray-300">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={12} className="text-text-gold" />
                                        <span>{new Date(order.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} className="text-text-gold" />
                                        <span>{order.total_hours.toFixed(1)}h</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-300">
                                    <div className="flex items-center gap-1.5">
                                        <User size={12} className="text-gray-500" />
                                        <span className="truncate max-w-[120px]">{order.operator?.name || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-medium text-positive">
                                        <DollarSign size={12} />
                                        <span>R$ {order.total_value.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/service-orders/${order.id}/receipt`);
                                    }}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors border border-white/5"
                                >
                                    <Download size={14} className="text-primary" />
                                    Gerar Recibo PDF
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/service-orders/${order.id}`);
                                    }}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors border border-white/5"
                                >
                                    <Edit2 size={14} className="text-text-gold" />
                                    Editar O.S.
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    );
};

