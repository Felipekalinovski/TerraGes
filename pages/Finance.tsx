import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Plus, FileText, ArrowUpRight, ArrowDownLeft, Sparkles, X, Loader2, Copy, Check, Calendar, DollarSign, Tag, Pencil, Trash2, Upload } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { generateReport, analyzeDocument } from '../services/geminiService';
import { transactionService, type Transaction as SupabaseTransaction } from '../services/transactionService';

const COLORS = ['#ff6a00', '#39FF14', '#555'];

export const Finance: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const [transactions, setTransactions] = useState<SupabaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    byCategory: {} as Record<string, number>
  });

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
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white h-12 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 disabled:opacity-70 transition-all"
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

      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
          <p className="text-xs text-gray-400">Saldo Atual</p>
          <p className="text-xl font-bold mt-1 text-white">
            R$ {(stats.balance / 1000).toFixed(1)}k
          </p>
        </div>
        <div className="bg-surface-dark p-3 rounded-xl border border-white/5">
          <p className="text-xs text-gray-400">Lucro (Total)</p>
          <p className="text-xl font-bold mt-1 text-white">
            R$ {(stats.balance / 1000).toFixed(1)}k
          </p>
        </div>
      </div>

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

      <div className="px-4 pb-6">
        <h3 className="font-bold mb-3 flex justify-between items-center text-white">
          Últimas Transações
          <span className="text-primary text-xs cursor-pointer hover:underline">Ver Tudo</span>
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="bg-surface-dark p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'}`}>
                  {t.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-white">{t.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${t.type === 'income' ? 'text-positive' : 'text-negative'}`}>
                    {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-dark rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary" size={20} />
                <h2 className="font-bold text-white">Relatório Financeiro</h2>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {report}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button onClick={() => setShowReportModal(false)} className="flex-1 bg-primary text-black py-3 rounded-lg font-bold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
