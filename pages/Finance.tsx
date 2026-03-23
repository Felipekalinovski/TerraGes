
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Plus, FileText, ArrowUpRight, ArrowDownLeft, Sparkles, X, Loader2, Copy, Check, Calendar, DollarSign, Tag, Pencil, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { generateReport, analyzeDocument } from '../services/aiService';
import { Upload } from 'lucide-react';
import { transactionService, type Transaction as SupabaseTransaction } from '../services/transactionService';

const COLORS = ['#9E3D07', '#256611', '#404040'];

export const Finance: React.FC = () => {
  // State for AI Report
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // State for Document Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // State for Transactions
  const [transactions, setTransactions] = useState<SupabaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    byCategory: {} as Record<string, number>
  });

  // State for Transaction Modal (Add/Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    status: 'paid' as 'paid' | 'pending',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionService.getAll();
      setTransactions(data);

      const statsData = await transactionService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading transactions:', error);
      alert('Erro ao carregar transações.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIReport = async () => {
    setIsGenerating(true);

    const chartData = Object.entries(stats.byCategory).map(([name, value]) => ({
      name,
      value
    }));

    const financialData = {
      resumo: {
        saldoAtual: `R$ ${stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalReceitas: `R$ ${stats.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalDespesas: `R$ ${stats.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        lucroLiquido: `R$ ${stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      },
      distribuicaoReceita: chartData,
      historicoTransacoes: transactions.slice(0, 10)
    };

    const result = await generateReport(financialData, 'financial');
    setReport(result || "Não foi possível gerar o relatório no momento.");
    setIsGenerating(false);
    setShowReportModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64String.split(',')[1];
      const mimeType = file.type;

      const result = await analyzeDocument(base64Content, mimeType);
      setAnalysisResult(result || "Não foi possível analisar o documento.");
      setIsAnalyzing(false);
      setShowAnalysisModal(true);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Open Modal for New Transaction
  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      amount: '',
      type: 'expense',
      status: 'paid',
      category: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  // Open Modal for Editing
  const openEditModal = (t: SupabaseTransaction) => {
    setEditingId(t.id);
    setFormData({
      title: t.title,
      amount: t.amount.toString(),
      type: t.type,
      status: t.status,
      category: t.category,
      date: t.date.split('T')[0]
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) {
      return;
    }

    try {
      await transactionService.delete(id);
      await loadTransactions();
      alert('Transação excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Erro ao excluir transação.');
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;

    try {
      setSaving(true);

      const transactionData = {
        title: formData.title,
        amount: parseFloat(formData.amount),
        type: formData.type,
        status: formData.status,
        category: formData.category || 'Outros',
        date: formData.date
      };

      if (editingId) {
        await transactionService.update(editingId, transactionData);
        alert('Transação atualizada com sucesso!');
      } else {
        await transactionService.create(transactionData);
        alert('Transação criada com sucesso!');
      }

      await loadTransactions();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Erro ao salvar transação.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  const chartData = Object.entries(stats.byCategory).slice(0, 5).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <Layout>
      <Layout.Header 
        title="Financeiro" 
        subTitle="Fluxo de Caixa & IA"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAIReport}
              disabled={isGenerating}
              className="bg-brand-gradient text-white p-2 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              title="Gerar Relatório IA"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            </button>
            <button
              onClick={openAddModal}
              className="bg-primary text-black p-2 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all"
              title="Nova Transação"
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        }
      />

      <Layout.Content>
        {/* Quick Actions / AI Analysis */}
        <div className="px-4 py-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex gap-3 mb-4">
             <label className="flex-1 bg-surface-dark/40 backdrop-blur-md border border-white/5 h-12 rounded-2xl font-black uppercase tracking-tighter text-[10px] flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer text-gray-400 hover:text-white">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isAnalyzing}
              />
              {isAnalyzing ? <Loader2 size={16} className="animate-spin text-primary" /> : <Upload size={16} />}
              {isAnalyzing ? "Analisando..." : "Analisar Comprovante"}
            </label>
            <button
              onClick={() => alert("Exportação em breve.")}
              className="bg-surface-dark/40 border border-white/5 h-12 px-5 rounded-2xl font-black uppercase tracking-tighter text-[10px] flex items-center justify-center gap-2 hover:bg-white/10 border-white/10 transition-all text-gray-400 hover:text-white"
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        </div>

        {/* Summary Summary */}
        <div className="px-4 grid grid-cols-2 gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="bg-surface-dark/50 p-5 rounded-[32px] border border-white/5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign size={40} className="text-white" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Saldo em Caixa</p>
            <p className="text-2xl font-black text-white">
              R$ {(stats.balance / 1000).toFixed(1)}k
            </p>
            <div className="mt-2 flex items-center gap-1.5">
               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${stats.balance >= 0 ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'}`}>
                {stats.balance >= 0 ? 'Positivo' : 'Negativo'}
              </span>
              <span className="text-[9px] font-bold text-gray-600">MTD</span>
            </div>
          </div>
          
          <div className="bg-surface-dark/50 backdrop-blur-xl p-5 rounded-[32px] border border-white/5 shadow-lg relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <ArrowUpRight size={40} className="text-positive" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Receita Total</p>
            <p className="text-2xl font-black text-positive">
              R$ {(stats.totalIncome / 1000).toFixed(1)}k
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-tighter">
              Aproveitamento: <span className="text-white">{((stats.balance / stats.totalIncome) * 100 || 0).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Chart Analysis */}
        <div className="px-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-surface-dark/30 rounded-[40px] p-8 border border-white/5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] italic">Distribuição de Gastos</h3>
               <div className="flex items-center gap-1 text-gray-500 text-[10px] font-bold uppercase">
                  Top 5 Categorias
               </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="relative size-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={42} outerRadius={56} paddingAngle={8} dataKey="value" stroke="none">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Total</span>
                  <span className="text-lg font-black text-white">
                    {((stats.totalIncome + stats.totalExpense) / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
              
              <div className="flex-1 space-y-3">
                {chartData.slice(0, 3).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full shadow-neon-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-white italic">
                       {stats.totalExpense > 0 ? (((item.value as number) / stats.totalExpense) * 100).toFixed(0) : '0'}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="px-4 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex justify-between items-end mb-6 px-2">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] font-heading italic">Fluxo Recente</h3>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer hover:brightness-125 transition-all">Ver Histórico</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sincronizando transações...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20 bg-surface-dark/10 rounded-[48px] border border-dashed border-white/5">
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest italic">Caixa vazio.</p>
              <button
                onClick={openAddModal}
                className="mt-6 text-primary font-black uppercase tracking-tighter text-[10px] hover:brightness-125 transition-all"
              >
                Lançar Transação Inicial +
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="bg-surface-dark/40 backdrop-blur-md p-5 rounded-[28px] border border-white/5 flex items-center gap-4 group hover:border-white/10 transition-all shadow-md">
                  <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 ${t.type === 'income' ? 'bg-positive/10 text-positive shadow-sm' : 'bg-negative/10 text-negative'}`}>
                    {t.type === 'income' ? <ArrowUpRight size={22} strokeWidth={2.5} /> : <ArrowDownLeft size={22} strokeWidth={2.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-black text-sm uppercase italic tracking-tighter text-white truncate mb-0.5 group-hover:text-primary transition-colors">{t.title}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{formatDate(t.date)}</span>
                       <span className="opacity-20 text-white text-[8px]">•</span>
                       <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{t.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-sm font-black italic tracking-tighter ${t.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                        {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${t.status === 'paid' ? 'text-gray-600' : 'text-warning'}`}>
                        {t.status === 'paid' ? 'Liquidado' : 'Pendente'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                      <button onClick={() => openEditModal(t)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <Pencil size={12} strokeWidth={3} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg bg-negative/5 hover:bg-negative/20 text-negative/60 hover:text-negative transition-colors">
                        <Trash2 size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout.Content>

      {/* AI Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-surface-dark/80 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-neon-sm">
                  <Sparkles size={20} strokeWidth={2.5} />
                </div>
                <h2 className="font-heading font-black text-xl text-white uppercase italic tracking-tighter">Análise Antigravity IA</h2>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-gray-500 hover:text-white transition-colors p-2">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 text-sm text-gray-300 leading-relaxed italic whitespace-pre-wrap font-sans selection:bg-primary selection:text-black">
              {report}
            </div>
            <div className="p-6 border-t border-white/5 flex gap-4">
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-surface-dark border border-white/10 text-white py-4 rounded-[20px] font-black uppercase italic tracking-tighter text-xs flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
              >
                {copied ? <Check size={18} className="text-positive" /> : <Copy size={18} />}
                {copied ? "Copiado!" : "Copiar Texto"}
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 bg-primary text-black py-4 rounded-[20px] font-black uppercase italic tracking-tighter text-xs hover:scale-[1.02] active:scale-95 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Result Modal */}
      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-surface-dark/80 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-neon-sm">
                  <FileText size={20} strokeWidth={2.5} />
                </div>
                <h2 className="font-heading font-black text-xl text-white uppercase italic tracking-tighter">Documento Analisado</h2>
              </div>
              <button onClick={() => setShowAnalysisModal(false)} className="text-gray-500 hover:text-white transition-colors p-2">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 text-sm text-gray-300 leading-relaxed italic whitespace-pre-wrap font-sans">
              {analysisResult}
            </div>
            <div className="p-6 border-t border-white/5">
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="w-full bg-primary text-black py-4 rounded-[20px] font-black uppercase italic tracking-tighter text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-neon"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-surface-dark/90 backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-20 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="font-heading font-black text-xl text-white uppercase italic tracking-tighter">{editingId ? 'Editar Registro' : 'Lançamento'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors p-2">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Descrição do Item</label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none placeholder:text-white/20 transition-all"
                    placeholder="Ex: Nota Fiscal de Insumo"
                  />
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors" size={18} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Natureza</label>
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 h-14">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'expense' })}
                      className={`flex-1 py-1 text-[9px] font-black uppercase tracking-tighter rounded-xl transition-all ${formData.type === 'expense' ? 'bg-negative text-white shadow-neon-sm' : 'text-gray-500 hover:text-white'}`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income' })}
                      className={`flex-1 py-1 text-[9px] font-black uppercase tracking-tighter rounded-xl transition-all ${formData.type === 'income' ? 'bg-positive text-white shadow-neon-sm' : 'text-gray-500 hover:text-white'}`}
                    >
                      Receita
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full h-14 px-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black text-white uppercase tracking-widest focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all appearance-none italic"
                  >
                    <option value="paid" className="bg-surface-dark">Liquidado</option>
                    <option value="pending" className="bg-surface-dark">Agendado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Data</label>
                  <div className="relative group">
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all appearance-none"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors" size={18} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Valor (BRL)</label>
                  <div className="relative group">
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm font-black text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none placeholder:text-white/20 transition-all font-mono"
                      placeholder="0.00"
                    />
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors" size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary text-black h-16 rounded-[24px] font-heading font-black uppercase italic tracking-tighter hover:brightness-110 active:scale-95 transition-all shadow-neon disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <>
                      <Loader2 size={24} strokeWidth={3} className="animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      {editingId ? <Check size={24} strokeWidth={3} /> : <ArrowUpRight size={24} strokeWidth={3} />}
                      {editingId ? 'Confirmar Edição' : 'Efetivar Lançamento'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};
