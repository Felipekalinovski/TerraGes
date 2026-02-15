
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { serviceOrderService, ServiceOrderFormData } from '../services/serviceOrderService';
import { machineService, Machine } from '../services/machineService';
import { employeeService, Employee } from '../services/employeeService';
import { analyzeReceipt } from '../services/aiService';
import { ArrowLeft, Save, Loader2, Camera, Upload, ScanLine, CheckCircle2, Download } from 'lucide-react';

export const ServiceOrderForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    const [formData, setFormData] = useState<ServiceOrderFormData>({
        date: new Date().toISOString().split('T')[0],
        client: '',
        machine_id: '',
        operator_id: '',
        start_hour: 0,
        end_hour: 0,
        hourly_rate: 0,
        payment_method: 'Pix',
        status: 'pending',
        location: '',
        description: '',
        receipt_url: ''
    });

    useEffect(() => {
        loadDependencies();
        if (isEditing) {
            loadOrder();
        }
    }, [id]);

    const loadDependencies = async () => {
        try {
            const [machinesData, employeesData] = await Promise.all([
                machineService.getAll(),
                employeeService.getAll()
            ]);
            setMachines(machinesData);
            setEmployees(employeesData);
        } catch (error) {
            console.error('Error loading dependencies:', error);
        }
    };

    const loadOrder = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const order = await serviceOrderService.getById(id);
            if (order) {
                setFormData({
                    date: order.date,
                    client: order.client,
                    machine_id: order.machine_id,
                    operator_id: order.operator_id,
                    start_hour: order.start_hour,
                    end_hour: order.end_hour,
                    hourly_rate: order.hourly_rate,
                    payment_method: order.payment_method,
                    status: order.status,
                    location: order.location || '',
                    description: order.description || '',
                    receipt_url: order.receipt_url || ''
                });
            }
        } catch (error) {
            console.error('Error loading order:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setAnalyzing(true);

        try {
            // 1. Upload
            const publicUrl = await serviceOrderService.uploadReceipt(file);
            if (!publicUrl) throw new Error("Falha no upload");

            setFormData(prev => ({ ...prev, receipt_url: publicUrl }));

            // 2. Analyze with AI
            const extractedData = await analyzeReceipt(publicUrl);

            if (extractedData) {
                console.log("AI Extracted:", extractedData);
                setFormData(prev => ({
                    ...prev,
                    client: extractedData.client || prev.client,
                    date: extractedData.date || prev.date,
                    start_hour: extractedData.start_hour || prev.start_hour,
                    end_hour: extractedData.end_hour || prev.end_hour,
                    // calculate total hours if start/end exist?
                    // AI might return it or we calculate
                }));
                alert("Dados extraídos do comprovante com sucesso!");
            }
        } catch (error) {
            console.error("Error processing receipt:", error);
            alert("Erro ao processar o comprovante.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEditing && id) {
                await serviceOrderService.update(id, formData);
            } else {
                await serviceOrderService.create(formData);
            }
            navigate('/service-orders');
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Erro ao salvar Ordem de Serviço.');
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = () => {
        const hours = (Number(formData.end_hour) || 0) - (Number(formData.start_hour) || 0);
        return (hours * (Number(formData.hourly_rate) || 0)).toFixed(2);
    };

    return (
        <Layout title={isEditing ? 'Editar O.S.' : 'Nova Ordem de Serviço'} hideNav={false}>
            <div className="p-4 pb-24">
                <button
                    onClick={() => navigate('/service-orders')}
                    className="flex items-center text-gray-400 mb-6 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} className="mr-2" />
                    Voltar
                </button>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* OCR / Receipt Upload */}
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <ScanLine size={20} className="text-primary" />
                            Digitalizar Comprovante
                        </h3>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all text-gray-400 hover:text-primary"
                        >
                            {analyzing ? (
                                <>
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <span className="text-sm">Analisando imagem com IA...</span>
                                </>
                            ) : formData.receipt_url ? (
                                <>
                                    <img src={formData.receipt_url} alt="Comprovante" className="h-32 object-contain rounded-lg border border-white/10" />
                                    <span className="text-xs text-positive flex items-center gap-1 mt-2">
                                        <CheckCircle2 size={12} /> Imagem salva (Clique para alterar)
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Camera size={32} />
                                    <span className="text-sm font-medium">Tirar foto ou carregar imagem</span>
                                    <span className="text-xs text-gray-500">A IA preencherá os dados automaticamente</span>
                                </>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                    </div>


                    {/* Header: Client & Date */}
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
                        <h3 className="text-lg font-bold text-white mb-2">Dados do Serviço</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Cliente / Obra</label>
                                <input
                                    type="text"
                                    name="client"
                                    required
                                    value={formData.client}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Ex: Fazenda Santa Cruz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Data</label>
                                <input
                                    type="date"
                                    name="date"
                                    required
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Resources: Machine & Operator */}
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
                        <h3 className="text-lg font-bold text-white mb-2">Recursos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Máquina</label>
                                <select
                                    name="machine_id"
                                    required
                                    value={formData.machine_id}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} - {m.type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Operador</label>
                                <select
                                    name="operator_id"
                                    required
                                    value={formData.operator_id}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Metrics & Finance */}
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
                        <h3 className="text-lg font-bold text-white mb-2">Horímetro e Valores</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Início (Horímetro)</label>
                                <input
                                    type="number"
                                    name="start_hour"
                                    step="0.1"
                                    required
                                    value={formData.start_hour}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Fim (Horímetro)</label>
                                <input
                                    type="number"
                                    name="end_hour"
                                    step="0.1"
                                    required
                                    value={formData.end_hour}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Valor Hora (R$)</label>
                                <input
                                    type="number"
                                    name="hourly_rate"
                                    step="0.01"
                                    required
                                    value={formData.hourly_rate}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Total Calculado</label>
                                <div className="w-full bg-brand-dark/50 border border-white/10 rounded-lg p-2.5 text-positive font-bold text-right">
                                    R$ {calculateTotal()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment & Status */}
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Forma de Pagamento</label>
                                <select
                                    name="payment_method"
                                    required
                                    value={formData.payment_method}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="Pix">Pix</option>
                                    <option value="Cartão">Cartão</option>
                                    <option value="Boleto">Boleto</option>
                                    <option value="Faturado">Faturado</option>
                                    <option value="Dinheiro">Dinheiro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Status da O.S.</label>
                                <select
                                    name="status"
                                    required
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="pending">Pendente</option>
                                    <option value="completed">Concluída</option>
                                    <option value="cancelled">Cancelada</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Observações</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            className="w-full bg-surface-dark border border-white/10 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none resize-none"
                            placeholder="Detalhes adicionais do serviço..."
                        />
                    </div>

                    <div className="pt-4 pb-8 flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={loading || analyzing}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                            {isEditing ? 'Atualizar Ordem de Serviço' : 'Gerar Ordem de Serviço'}
                        </button>

                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => navigate(`/service-orders/${id}/receipt`)}
                                className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-4 rounded-xl flex items-center justify-center transition-all border border-white/5"
                            >
                                <Download className="mr-2 text-primary" />
                                Visualizar / Imprimir Recibo
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </Layout>
    );
};
