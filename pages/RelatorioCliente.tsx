import React, { useEffect, useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import {
  FileText, Share2, Loader2, Clock, DollarSign,
  Wrench, Calendar, ChevronDown, CheckCircle2,
  TrendingUp, User, MapPin, Copy,
} from 'lucide-react';
import { horaMaquinaService, formatHours } from '../services/horaMaquinaService';
import { generateAIResponse } from '../services/aiService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectSummary {
  project_name: string;
  client_name: string;
  total_hours: number;
  total_value: number;
  machine_count: number;
  last_date: string;
  records: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateLong(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ─── Report Content ───────────────────────────────────────────────────────────

const ReportView: React.FC<{
  project: ProjectSummary;
  aiSummary: string | null;
  loadingAi: boolean;
  onShare: () => void;
  onCopy: () => void;
  copied: boolean;
}> = ({ project, aiSummary, loadingAi, onShare, onCopy, copied }) => {
  // Group records by machine for the detail table
  const byMachine = project.records.reduce((acc, r) => {
    if (!acc[r.machine_name]) acc[r.machine_name] = { hours: 0, value: 0, days: new Set<string>() };
    acc[r.machine_name].hours += r.total_hours;
    acc[r.machine_name].value += r.total_value;
    acc[r.machine_name].days.add(r.date);
    return acc;
  }, {} as Record<string, { hours: number; value: number; days: Set<string> }>);

  const datesSorted = [...new Set(project.records.map((r: any) => r.date))].sort();
  const firstDate = datesSorted[0];
  const lastDate  = datesSorted[datesSorted.length - 1];

  return (
    <div className="space-y-4">

      {/* ── Report Header Card ── */}
      <div
        className="rounded-[28px] p-6 border border-white/5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,5,5,0.98) 70%)' }}
      >
        <div className="absolute -top-6 -right-6 size-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.25em] mb-1">Relatório de Serviço</p>
            <h2 className="text-lg font-black text-white leading-tight">{project.project_name}</h2>
          </div>
          <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <FileText size={20} />
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {project.client_name && (
            <div className="flex items-center gap-2 text-gray-300">
              <User size={13} className="text-gray-500" />
              <span className="font-medium">{project.client_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar size={13} className="text-gray-500" />
            <span className="font-medium">
              {firstDate === lastDate
                ? formatDateLong(firstDate)
                : `${formatDateBR(firstDate)} a ${formatDateBR(lastDate)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
          <Clock size={16} className="text-primary mx-auto mb-1.5" />
          <p className="text-lg font-black text-white">{formatHours(project.total_hours)}</p>
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Total horas</p>
        </div>
        <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
          <Wrench size={16} className="text-primary mx-auto mb-1.5" />
          <p className="text-lg font-black text-white">{project.machine_count}</p>
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Máquinas</p>
        </div>
        <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 text-center">
          <DollarSign size={16} className="text-positive mx-auto mb-1.5" />
          <p className="text-lg font-black text-positive">
            {project.total_value > 0
              ? `${(project.total_value / 1000).toFixed(0)}K`
              : '—'}
          </p>
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Valor total</p>
        </div>
      </div>

      {/* ── Machine Detail Table ── */}
      <div className="bg-surface-dark/50 rounded-[24px] border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Detalhamento por Máquina</h3>
        </div>
        <div className="divide-y divide-white/5">
          {Object.entries(byMachine).map(([machineName, data]) => (
            <div key={machineName} className="flex items-center gap-4 px-5 py-4">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Wrench size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{machineName}</p>
                <p className="text-[9px] text-gray-500 font-bold">{data.days.size} dia{data.days.size !== 1 ? 's' : ''} trabalhado{data.days.size !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black text-white">{formatHours(data.hours)}</p>
                {data.value > 0 && (
                  <p className="text-[10px] font-bold text-positive">{formatCurrency(data.value)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Total footer */}
        <div className="flex items-center justify-between px-5 py-4 bg-black/30 border-t border-white/5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
          <div className="text-right">
            <p className="text-base font-black text-white">{formatHours(project.total_hours)}</p>
            {project.total_value > 0 && (
              <p className="text-sm font-black text-positive">{formatCurrency(project.total_value)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Summary ── */}
      <div
        className="rounded-[24px] p-5 border border-white/5"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(0,0,0,0.5))' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-primary" />
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Resumo Executivo</h3>
        </div>
        {loadingAi ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-3">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="italic">Gerando resumo profissional...</span>
            </div>
            <div className="h-2.5 bg-white/5 rounded-full w-full animate-pulse" />
            <div className="h-2.5 bg-white/5 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="h-2.5 bg-white/5 rounded-full w-3/5 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        ) : aiSummary ? (
          <p className="text-gray-200 text-sm leading-relaxed font-medium">{aiSummary}</p>
        ) : (
          <p className="text-gray-600 text-sm italic">Resumo não disponível. Verifique a conexão com a IA.</p>
        )}
      </div>

      {/* ── Apontamentos ── */}
      <div className="bg-surface-dark/40 rounded-[24px] border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Apontamentos Detalhados</h3>
        </div>
        <div className="divide-y divide-white/5">
          {project.records
            .sort((a: any, b: any) => b.date.localeCompare(a.date))
            .map((r: any) => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-gray-600 uppercase">{formatDateBR(r.date)}</p>
                    <p className="text-[9px] font-black text-gray-600">{r.start_time}–{r.end_time}</p>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{r.machine_name}</p>
                  {r.observations && (
                    <p className="text-[9px] text-gray-600 italic truncate">{r.observations}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-black text-white">{formatHours(r.total_hours)}</p>
                  {r.total_value > 0 && (
                    <p className="text-[9px] font-bold text-positive">{formatCurrency(r.total_value)}</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Share Buttons ── */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        <button
          onClick={onCopy}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-surface-dark/60 text-gray-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-white/20 active:scale-[0.97] transition-all"
        >
          {copied ? <CheckCircle2 size={14} className="text-positive" /> : <Copy size={14} />}
          {copied ? 'Copiado!' : 'Copiar Texto'}
        </button>
        <button
          onClick={onShare}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:bg-primary/90 active:scale-[0.97] transition-all"
        >
          <Share2 size={14} /> Compartilhar
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RelatorioCliente: React.FC = () => {
  const [projects, setProjects]         = useState<ProjectSummary[]>([]);
  const [selected, setSelected]         = useState<ProjectSummary | null>(null);
  const [loading, setLoading]           = useState(true);
  const [loadingAi, setLoadingAi]       = useState(false);
  const [aiSummary, setAiSummary]       = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);
  const [showPicker, setShowPicker]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await horaMaquinaService.getSummaryByProject();
      setProjects(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, []);

  // Generate AI summary when project changes
  useEffect(() => {
    if (!selected) return;
    setAiSummary(null);
    setLoadingAi(true);

    const prompt = `
Gere um breve resumo executivo profissional (máximo 3 frases) sobre este serviço de terraplanagem/máquinas pesadas para apresentar ao cliente.
Tom: profissional, objetivo e positivo.

Dados do serviço:
- Obra/Projeto: ${selected.project_name}
- Cliente: ${selected.client_name || 'Não informado'}
- Total de horas trabalhadas: ${selected.total_hours.toFixed(1)}h
- Número de máquinas: ${selected.machine_count}
- Valor total: ${selected.total_value > 0 ? formatCurrency(selected.total_value) : 'a definir'}
- Máquinas utilizadas: ${[...new Set(selected.records.map((r: any) => r.machine_name))].join(', ')}

Inicie com "Referente ao serviço de..." e finalize com uma frase de encerramento profissional.
Responda apenas em português do Brasil.
    `.trim();

    generateAIResponse(
      prompt,
      'Você é um assistente especializado em relatórios do setor de construção pesada e terraplanagem no Brasil. Seja conciso e profissional.',
    )
      .then(text => setAiSummary(text))
      .catch(() => setAiSummary(null))
      .finally(() => setLoadingAi(false));
  }, [selected]);

  // Share via Web Share API or WhatsApp
  const handleShare = () => {
    if (!selected) return;
    const text = buildShareText(selected, aiSummary);

    if (navigator.share) {
      navigator.share({ title: `Relatório – ${selected.project_name}`, text });
    } else {
      const encoded = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleCopy = async () => {
    if (!selected) return;
    const text = buildShareText(selected, aiSummary);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="Relatório" subTitle="Para o cliente" showBack />
        <Layout.Content>
          <div className="flex justify-center py-24">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  if (projects.length === 0) {
    return (
      <Layout>
        <Layout.Header title="Relatório" subTitle="Para o cliente" showBack />
        <Layout.Content>
          <div className="flex flex-col items-center justify-center py-24 gap-4 px-8 text-center">
            <div className="size-16 rounded-2xl bg-surface-dark/60 flex items-center justify-center text-gray-600 border border-white/5">
              <FileText size={28} />
            </div>
            <p className="text-white font-bold">Nenhum apontamento encontrado</p>
            <p className="text-gray-500 text-sm">
              Registre horas de máquina primeiro para gerar um relatório para o cliente.
            </p>
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header
        title="Relatório"
        subTitle="Para o cliente"
        showBack
      />

      <Layout.Content>
        <div className="px-4 pb-24 pt-4 space-y-4 animate-in fade-in duration-500">

          {/* ── Project Picker ── */}
          <button
            onClick={() => setShowPicker(v => !v)}
            className="w-full flex items-center justify-between bg-surface-dark/60 border border-white/5 rounded-2xl px-5 py-4 text-left hover:border-primary/20 transition-all"
          >
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Obra selecionada</p>
              <p className="text-sm font-bold text-white">{selected?.project_name ?? 'Selecionar...'}</p>
              {selected?.client_name && (
                <p className="text-[10px] text-gray-500 font-medium">{selected.client_name}</p>
              )}
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-500 transition-transform ${showPicker ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Project Picker Dropdown */}
          {showPicker && (
            <div className="bg-surface-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {projects.map(p => (
                <button
                  key={p.project_name}
                  onClick={() => {
                    setSelected(p);
                    setShowPicker(false);
                  }}
                  className={`w-full flex items-center justify-between px-5 py-4 border-b border-white/5 last:border-0 text-left transition-all ${
                    selected?.project_name === p.project_name
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-white/5 text-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{p.project_name}</p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {p.client_name || 'Cliente não informado'} · {formatHours(p.total_hours)}
                    </p>
                  </div>
                  {selected?.project_name === p.project_name && (
                    <CheckCircle2 size={16} className="text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Report ── */}
          {selected && (
            <ReportView
              project={selected}
              aiSummary={aiSummary}
              loadingAi={loadingAi}
              onShare={handleShare}
              onCopy={handleCopy}
              copied={copied}
            />
          )}
        </div>
      </Layout.Content>
    </Layout>
  );
};

// ─── Text for sharing ─────────────────────────────────────────────────────────

function buildShareText(project: ProjectSummary, aiSummary: string | null): string {
  const datesSorted = [...new Set(project.records.map((r: any) => r.date))].sort();
  const firstDate   = datesSorted[0];
  const lastDate    = datesSorted[datesSorted.length - 1];
  const period      = firstDate === lastDate
    ? formatDateBR(firstDate)
    : `${formatDateBR(firstDate)} a ${formatDateBR(lastDate)}`;

  const machineLines = Object.entries(
    project.records.reduce((acc: any, r: any) => {
      acc[r.machine_name] = (acc[r.machine_name] || 0) + r.total_hours;
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([name, hours]: any) => `   • ${name}: ${formatHours(hours)}`)
    .join('\n');

  return [
    `📋 *RELATÓRIO DE SERVIÇO*`,
    ``,
    `🏗️ *Obra:* ${project.project_name}`,
    project.client_name ? `👤 *Cliente:* ${project.client_name}` : '',
    `📅 *Período:* ${period}`,
    ``,
    `⏱️ *Total de Horas:* ${formatHours(project.total_hours)}`,
    project.total_value > 0 ? `💰 *Valor Total:* ${formatCurrency(project.total_value)}` : '',
    ``,
    `🚜 *Máquinas utilizadas:*`,
    machineLines,
    aiSummary ? `\n📝 *Resumo:*\n${aiSummary}` : '',
    ``,
    `_Relatório gerado pelo TerraGes_`,
  ].filter(Boolean).join('\n');
}
