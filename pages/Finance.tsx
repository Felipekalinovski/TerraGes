
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Plus, FileText, ArrowUpRight, ArrowDownLeft, Sparkles, X, Loader2, Copy, Check, Calendar, DollarSign, Tag, Pencil, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { generateReport, analyzeDocument } from '../services/geminiService';
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
    <Layout title="Financeiro" hideNav={false}>
      {/* Actions */}
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            onClick={openAddModal}
            className="flex-1 bg-primary hover:bg-primary-hover transition-colors text-black h-12 rounded-lg font-bold flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Transação
          </button>
          <button
            onClick={() => alert("Funcionalidade de exportação de PDF em desenvolvimento.")}
            className="flex-1 bg-surface-dark border border-white/10 h-12 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
          >
            <FileText size={18} /> Relatório
          </button>
          <label className="flex-1 bg-surface-dark border border-white/10 h-12 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={isAnalyzing}
            />
            {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {isAnalyzing ? "Analisando..." : "Analisar Doc"}
          </label>
        </div>
        <button
          onClick={handleGenerateAIReport}
          disabled={isGenerating}
          className="w-full bg-brand-gradient text-white h-12 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70 transition-all hover:brightness-110"
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Gerando Análise...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Gerar Relatório com IA
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
          <p className="text-xs text-gray-400">Saldo Atual</p>
          <p className="text-xl font-bold mt-1 text-white">
            R$ {(stats.balance / 1000).toFixed(1)}k
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${stats.balance >= 0 ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'}`}>
            {stats.balance >= 0 ? '+' : ''}{((stats.balance / stats.totalIncome) * 100 || 0).toFixed(1)}%
          </span>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
          <p className="text-xs text-gray-400">Lucro (Total)</p>
          <p className="text-xl font-bold mt-1 text-white">
            R$ {(stats.balance / 1000).toFixed(1)}k
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${stats.balance >= 0 ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'}`}>
            {stats.totalIncome > 0 ? ((stats.balance / stats.totalIncome) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 mb-6">
        <div className="bg-surface-dark rounded-xl p-4 border border-white/5 flex items-center">
          <div className="w-1/2 h-32 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-xs text-gray-500">Total</span>
              <span className="font-bold text-white">
                {((stats.totalIncome + stats.totalExpense) / 1000).toFixed(0)}k
              </span>
            </div>
          </div>
          <div className="w-1/2 space-y-2 pl-4">
            {chartData.slice(0, 3).map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-gray-300">
                <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-4 pb-6">
        <h3 className="font-bold mb-3 flex justify-between items-center text-white">
          Últimas Transações
          <span className="text-primary text-xs cursor-pointer hover:underline">Ver Tudo</span>
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400">Nenhuma transação registrada.</p>
            <button
              onClick={openAddModal}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Adicionar primeira transação
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="bg-surface-dark p-3 rounded-xl border border-white/5 flex items-center gap-3 group">
                <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'}`}>
                  {t.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-white">{t.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`font-bold text-sm ${t.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className={`text-[10px] capitalize ${t.status === 'paid' ? 'text-gray-500' : 'text-yellow-500'}`}>{t.status === 'paid' ? 'Pago' : 'Pendente'}</p>
                  </div>

                  {/* Edit/Delete Actions */}
                  <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(t)} className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1 rounded bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-dark rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary" size={20} />
                <h2 className="font-bold text-white">Relatório Financeiro Inteligente</h2>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
              {report}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-surface-dark border border-white/10 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
              >
                {copied ? <Check size={18} className="text-positive" /> : <Copy size={18} />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 bg-primary text-black py-3 rounded-lg font-bold hover:bg-primary-hover transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Result Modal */}
      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-dark rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary" size={20} />
                <h2 className="font-bold text-white">Análise de Documento</h2>
              </div>
              <button onClick={() => setShowAnalysisModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
              {analysisResult}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="flex-1 bg-primary text-black py-3 rounded-lg font-bold hover:bg-primary-hover transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-dark rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white text-lg">{editingId ? 'Editar Transação' : 'Nova Transação'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-white/30"
                    placeholder="Ex: Compra de Cimento"
                  />
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-white/30"
                    placeholder="Ex: Materiais, Combustível"
                  />
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Data</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none"
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Valor (R$)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none placeholder:text-white/30"
                    placeholder="0,00"
                  />
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'expense' })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${formData.type === 'expense' ? 'bg-negative text-white' : 'text-gray-400'}`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income' })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${formData.type === 'income' ? 'bg-positive text-white' : 'text-gray-400'}`}
                    >
                      Receita
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="paid" className="bg-surface-dark">Pago / Recebido</option>
                    <option value="pending" className="bg-surface-dark">Pendente</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-primary text-black h-12 rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editingId ? 'Atualizar Transação' : 'Salvar Transação'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};
