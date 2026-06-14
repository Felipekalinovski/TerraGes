
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { serviceOrderService, ServiceOrderFormData } from '../services/serviceOrderService';
import { machineService, Machine } from '../services/machineService';
import { employeeService, Employee } from '../services/employeeService';
import { analyzeReceipt } from '../services/aiService';
import { ArrowLeft, Save, Loader2, Camera, Upload, ScanLine, CheckCircle2, Download, Sparkles } from 'lucide-react';

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
    <Layout>
      <Layout.Header 
        title={isEditing ? 'Editar O.S.' : 'Nova Ordem de Serviço'} 
        subTitle="Módulo de faturamento e registro operacional de campo"
        showBack={true}
        onBackClick={() => navigate('/service-orders')}
      />

      <Layout.Content>
        <div className="p-4 pb-32 animate-in slide-in-from-bottom-4 duration-700">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* AI HUB: Digitalização Inteligente */}
            <div className="bg-surface-dark/40 backdrop-blur-xl p-6 rounded-[32px] border border-white/5 shadow-glass relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                    <ScanLine size={120} className="text-primary rotate-12" />
                </div>
                
                <h3 className="text-lg font-black text-white italic uppercase tracking-widest mb-6 flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles size={18} />
                  </div>
                  TerraScan <span className="text-primary/50 text-xs ml-1 font-medium">Digitalização AI</span>
                </h3>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative z-10 border-2 border-dashed rounded-[24px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-500 overflow-hidden ${
                    analyzing ? 'border-primary/50 bg-primary/5' : 
                    formData.receipt_url ? 'border-positive/30 bg-positive/5' : 
                    'border-white/5 hover:border-primary/30 hover:bg-white/[0.02]'
                  }`}
                >
                  {analyzing ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-primary uppercase tracking-[0.2em] animate-pulse">Processando Neuronios...</span>
                        <span className="text-[10px] text-gray-500 font-medium italic mt-1">Extraindo dados técnicos da imagem</span>
                      </div>
                    </div>
                  ) : formData.receipt_url ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="relative group/img shadow-2xl rounded-2xl overflow-hidden border-2 border-primary/20">
                        <img src={formData.receipt_url} alt="Comprovante" className="h-48 object-cover transition-transform group-hover/img:scale-105" />
                        <div className="absolute inset-0 bg-primary/20 mix-blend-overlay opacity-0 group-hover/img:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-black text-positive uppercase tracking-widest flex items-center gap-2 px-4 py-2 bg-positive/10 rounded-full border border-positive/20">
                          <CheckCircle2 size={12} /> Digitalização Analisada
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Clique para substituir imagem</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center py-6">
                      <div className="size-20 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/5 group-hover:scale-110 group-hover:shadow-neon transition-all duration-500">
                        <Camera size={38} strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-white uppercase tracking-widest">Carregar Comprovante</span>
                        <span className="text-[10px] text-gray-500 font-bold italic">A IA preencherá os campos automaticamente</span>
                      </div>
                    </div>
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

            {/* FORM SECTIONS: Grid Design */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Seção: Identificação */}
              <div className="bg-surface-dark/40 backdrop-blur-md p-7 rounded-[32px] border border-white/5 shadow-glass space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="size-1.5 rounded-full bg-primary shadow-neon"></div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Identificação do Serviço</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Cliente / Local</label>
                      <input
                        type="text"
                        name="client"
                        required
                        value={formData.client}
                        onChange={handleChange}
                        className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all placeholder:text-gray-700"
                        placeholder="Ex: Condomínio Terras Altas"
                      />
                    </div>
                    
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Data de Execução</label>
                      <input
                        type="date"
                        name="date"
                        required
                        value={formData.date}
                        onChange={handleChange}
                        className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                      />
                    </div>
                  </div>
              </div>

              {/* Seção: Recursos */}
              <div className="bg-surface-dark/40 backdrop-blur-md p-7 rounded-[32px] border border-white/5 shadow-glass space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="size-1.5 rounded-full bg-primary shadow-neon"></div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Alocação de Recursos</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Equipamento Utilizado</label>
                      <select
                        name="machine_id"
                        required
                        value={formData.machine_id}
                        onChange={handleChange}
                        className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all appearance-none"
                      >
                        <option value="" className="bg-brand-dark">Selecionar Máquina...</option>
                        {machines.map(m => (
                          <option key={m.id} value={m.id} className="bg-brand-dark">{m.name} - {m.type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Operador Responsável</label>
                      <select
                        name="operator_id"
                        required
                        value={formData.operator_id}
                        onChange={handleChange}
                        className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all appearance-none"
                      >
                        <option value="" className="bg-brand-dark">Selecionar Colaborador...</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id} className="bg-brand-dark">{e.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
              </div>

              {/* Seção: Horímetro & Performance */}
              <div className="md:col-span-2 bg-surface-dark/40 backdrop-blur-md p-7 rounded-[32px] border border-white/5 shadow-glass">
                <div className="flex items-center gap-3 mb-8">
                  <div className="size-1.5 rounded-full bg-primary shadow-neon"></div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Métricas de Produção & Faturamento</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="group">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Horímetro Inicial</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="start_hour"
                        step="0.1"
                        required
                        value={formData.start_hour}
                        onChange={handleChange}
                        className="w-full h-14 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-lg text-white font-black italic tracking-tighter focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">INÍCIO</span>
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Horímetro Final</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="end_hour"
                        step="0.1"
                        required
                        value={formData.end_hour}
                        onChange={handleChange}
                        className="w-full h-14 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-lg text-white font-black italic tracking-tighter focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">TÉRMINO</span>
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Valor/Hora (BRL)</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="hourly_rate"
                        step="0.01"
                        required
                        value={formData.hourly_rate}
                        onChange={handleChange}
                        className="w-full h-14 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-lg text-primary font-black italic tracking-tighter focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-primary opacity-0 group-focus-within:opacity-100 transition-opacity">R$</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="h-14 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col items-center justify-center p-2 relative group overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-[1px] bg-primary animate-pulse"></div>
                       <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total Consolidado</span>
                       <div className="text-xl font-black text-white italic tracking-tighter">
                         R$ {calculateTotal()}
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Pagamento e Status */}
              <div className="md:col-span-2 bg-surface-dark/40 backdrop-blur-md p-7 rounded-[32px] border border-white/5 shadow-glass space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Método de Liquidação</label>
                    <select
                      name="payment_method"
                      required
                      value={formData.payment_method}
                      onChange={handleChange}
                      className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all appearance-none"
                    >
                      <option value="Pix" className="bg-brand-dark">Pix (Imediato)</option>
                      <option value="Cartão" className="bg-brand-dark">Cartão Débito/Crédito</option>
                      <option value="Boleto" className="bg-brand-dark">Boleto Bancário</option>
                      <option value="Faturado" className="bg-brand-dark">Faturamento Mensal</option>
                      <option value="Dinheiro" className="bg-brand-dark">Espécie</option>
                    </select>
                  </div>

                  <div className="group">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Fluxo da Ordem</label>
                    <select
                      name="status"
                      required
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all appearance-none"
                    >
                      <option value="pending" className="bg-brand-dark text-warning">Aguardando Aprovação / Pendente</option>
                      <option value="completed" className="bg-brand-dark text-positive">Finalizada / Entregue</option>
                      <option value="cancelled" className="bg-brand-dark text-red-500">Cancelada / Abortada</option>
                    </select>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Relatórios / Observações</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-white/[0.03] border border-white/5 rounded-[24px] p-5 text-sm text-white font-medium focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none placeholder:text-gray-700 italic"
                    placeholder="Incluir detalhes técnicos, ocorrências ou anomalias durante o serviço..."
                  />
                </div>
              </div>
            </div>

            {/* Persistent Control Bar */}
            <div className="fixed bottom-10 left-4 right-4 z-50 flex flex-col gap-3 max-w-md mx-auto">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => navigate(`/service-orders/${id}/receipt`)}
                  className="h-16 bg-white/5 backdrop-blur-xl border border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-[24px] flex items-center justify-center gap-3 transition-all hover:bg-white/10 active:scale-95 shadow-glass"
                >
                  <Download className="text-primary" size={20} />
                  Emitir / Visualizar Folha OS
                </button>
              )}

              <button
                type="submit"
                disabled={loading || analyzing}
                className="h-18 bg-primary text-black font-black uppercase tracking-[0.2em] text-sm rounded-[24px] shadow-neon flex items-center justify-center gap-4 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} strokeWidth={2.5} />}
                {isEditing ? 'Sincronizar Protocolo' : 'Gerar Ordem de Serviço'}
              </button>
            </div>
          </form>
        </div>
      </Layout.Content>
    </Layout>
  );
};
