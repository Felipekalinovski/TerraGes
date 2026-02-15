
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serviceOrderService, ServiceOrder } from '../services/serviceOrderService';
import { Loader2, Printer, ArrowLeft, Download } from 'lucide-react';

export const ServiceOrderReceipt: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<ServiceOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadOrder();
        }
    }, [id]);

    const loadOrder = async () => {
        try {
            const data = await serviceOrderService.getById(id!);
            setOrder(data);
        } catch (error) {
            console.error('Error loading order:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white text-black">
                <Loader2 className="animate-spin" size={40} />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white text-black">
                <p>Ordem de serviço não encontrada.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:p-0 print:bg-white">
            {/* Toolbar - Hidden when printing */}
            <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
                >
                    <ArrowLeft size={20} />
                    Voltar
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handlePrint}
                        className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-primary/20"
                    >
                        <Printer size={18} />
                        Imprimir / PDF
                    </button>
                </div>
            </div>

            {/* Receipt Content */}
            <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none">
                {/* Header */}
                <div className="bg-brand-dark p-8 text-white border-b-4 border-primary">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-black italic tracking-tighter text-primary">TERRAGES</h1>
                            <p className="text-gray-400 text-sm mt-1">Gestão Inteligente de Terraplanagem</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold">RECIBO DE SERVIÇO</h2>
                            <p className="text-primary text-sm font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-8 border-b border-gray-100 pb-8">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Cliente / Obra</h3>
                            <p className="text-lg font-bold text-gray-800">{order.client}</p>
                            <p className="text-sm text-gray-500 mt-1">{order.location || 'Local não informado'}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Data do Serviço</h3>
                            <p className="text-lg font-bold text-gray-800">{new Date(order.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>

                    {/* Technical Details */}
                    <div className="grid grid-cols-2 gap-8 border-b border-gray-100 pb-8">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Recursos Utilizados</h3>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-gray-700">Máquina: <span className="text-gray-900">{order.machine?.name || 'N/A'}</span></p>
                                <p className="text-sm font-semibold text-gray-700">Operador: <span className="text-gray-900">{order.operator?.name || 'N/A'}</span></p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Métricas de Trabalho</h3>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-gray-700">Horas: <span className="text-gray-900">{order.total_hours.toFixed(1)}h</span></p>
                                <p className="text-sm font-semibold text-gray-700">({order.start_hour}h - {order.end_hour}h)</p>
                            </div>
                        </div>
                    </div>

                    {/* Financial Table */}
                    <div>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-gray-800">
                                    <th className="py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição do Serviço</th>
                                    <th className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Qtd (Hrs)</th>
                                    <th className="py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Preço Unit.</th>
                                    <th className="py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="py-4">
                                        <p className="text-sm font-bold text-gray-800">Locação de Maquinário com Operador</p>
                                        <p className="text-xs text-gray-500 mt-1">{order.description || 'Nenhuma observação adicional.'}</p>
                                    </td>
                                    <td className="py-4 text-center text-sm text-gray-700">{order.total_hours.toFixed(1)}</td>
                                    <td className="py-4 text-right text-sm text-gray-700">R$ {order.hourly_rate.toFixed(2)}</td>
                                    <td className="py-4 text-right text-sm font-bold text-gray-900">R$ {(order.total_hours * order.hourly_rate).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end pt-4">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Meio de Pagamento</span>
                                <span className="font-bold text-gray-800">{order.payment_method}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Status</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {order.status === 'completed' ? 'PAGO' : 'AGUARDANDO'}
                                </span>
                            </div>
                            <div className="border-t-2 border-gray-800 pt-3 flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-800">TOTAL</span>
                                <span className="text-2xl font-black text-gray-900 tracking-tighter">R$ {order.total_value.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-16 pt-16">
                        <div className="text-center">
                            <div className="border-t border-gray-300 pt-3">
                                <p className="text-xs font-bold text-gray-400 uppercase">Assinatura do Operador</p>
                                <p className="text-sm text-gray-700 mt-1">{order.operator?.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="border-t border-gray-300 pt-3">
                                <p className="text-xs font-bold text-gray-400 uppercase">Assinatura do Cliente</p>
                                <p className="text-sm text-gray-700 mt-1">{order.client}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-loose">
                        Este documento é um comprovante de execução de serviço.<br />
                        Gerado automaticamente pelo sistema TerraGes em {new Date().toLocaleString('pt-BR')}
                    </p>
                </div>
            </div>

            {/* Custom Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body { background: white !important; margin: 0; padding: 0; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { shadow: none !important; }
                    .print\\:rounded-none { border-radius: 0 !important; }
                    @page { margin: 1.5cm; }
                }
            `}} />
        </div>
    );
};
