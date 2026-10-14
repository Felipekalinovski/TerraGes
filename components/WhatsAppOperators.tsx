import React, { useEffect, useState } from 'react';
import { MessageCircle, Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

type Operator = { id: string; name: string; phone: string; state: 'pending' | 'active' | 'revoked' | 'expired' };
const status = { pending: 'Aguardando o primeiro oi', active: 'Acesso ativo', revoked: 'Acesso bloqueado', expired: 'Prazo encerrado' };
const errors: Record<string, string> = {
  manager_whatsapp_required: 'Conecte seu WhatsApp ao TerraGes antes de liberar operadores.',
  invalid_operator_phone: 'Confira o WhatsApp e inclua o DDD. Para outro país, comece com + e o código do país.',
  invalid_operator_name: 'Informe o nome do operador, com 2 a 100 caracteres.',
  phone_already_registered: 'Esse número já tem um cadastro. Confira o número; o acesso não pode ser transferido entre empresas.',
  manager_required: 'Somente o gestor ou administrador pode liberar acessos.'
};

export function WhatsAppOperators() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Operator[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [review, setReview] = useState(false);
  const [blocking, setBlocking] = useState<string | null>(null);
  const manager = profile?.role === 'admin' || profile?.role === 'gestor';

  async function refresh() {
    setLoading(true); setError('');
    const { data, error } = await supabase.rpc('list_whatsapp_operators');
    if (error) setError('Não conseguimos carregar os acessos. Tente atualizar.');
    else setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => { if (manager) void refresh(); }, [profile?.id, manager]);
  if (!manager) return null;

  async function authorize(operatorName = name, operatorPhone = phone) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error } = await supabase.rpc('authorize_whatsapp_operator', { p_name: operatorName.trim(), p_phone: operatorPhone.trim() });
      if (error) throw error;
      setName(''); setPhone(''); setReview(false);
      await refresh();
      setMessage(data?.state === 'active' ? 'Esse operador já tem acesso.' : `${operatorName.trim()} foi liberado! Peça que envie um oi para o WhatsApp do TerraGes em até 7 dias. O vínculo com sua empresa é automático.`);
    } catch (e: any) { setError(errors[e?.message] || 'Não foi possível liberar o acesso. Confira os dados e tente novamente.'); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.rpc('revoke_whatsapp_operator', { p_id: id });
      if (error) throw error;
      setBlocking(null); await refresh(); setMessage('Acesso bloqueado. Esse número não pode mais usar o agente pela sua empresa.');
    } catch { setError('Não foi possível bloquear o acesso. Tente novamente.'); }
    finally { setBusy(false); }
  }

  return <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-dark/50 p-5 space-y-4" aria-labelledby="whatsapp-operators-title">
    <div className="flex items-start gap-3"><MessageCircle className="text-primary shrink-0 mt-1" size={24} /><div>
      <h2 id="whatsapp-operators-title" className="text-lg font-bold text-white">Acessos pelo WhatsApp</h2>
      <p className="mt-1 text-sm text-gray-400">Libere o operador com nome e número. Ele só precisa enviar um oi ao TerraGes. Sem senha nem código.</p>
    </div></div>
    <div className="rounded-xl bg-primary/10 p-3 text-sm text-gray-200">Prefere conversar? Envie <strong className="text-primary">Cadastrar operador</strong> ao agente no WhatsApp. Ele pergunta os dados e confirma com você.</div>
    <form onSubmit={e => { e.preventDefault(); if (review) void authorize(); else setReview(true); }} className="space-y-3">
      {!review ? <>
        <label className="block text-sm text-gray-200">Nome do operador<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: João da Silva" className="mt-1 block w-full rounded-xl border border-white/15 bg-black/20 p-3 text-base text-white focus:ring-2 focus:ring-primary outline-none" /></label>
        <label className="block text-sm text-gray-200">WhatsApp com DDD<input required type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(41) 99999-9999" className="mt-1 block w-full rounded-xl border border-white/15 bg-black/20 p-3 text-base text-white focus:ring-2 focus:ring-primary outline-none" /></label>
      </> : <div className="rounded-xl border border-white/15 p-4 text-sm text-gray-200 space-y-2"><p className="font-bold text-white">Confira antes de liberar</p><p className="break-words">{name} · {phone}</p><p>Empresa: {profile?.company_name || 'Sua empresa'}. Acesso de operador para enviar registros de campo.</p><button type="button" disabled={busy} onClick={() => setReview(false)} className="text-primary underline py-1">Corrigir dados</button></div>}
      <button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-black flex justify-center items-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}{review ? 'Confirmar e liberar operador' : 'Continuar'}</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-400">{error} {error === errors.manager_whatsapp_required && <Link to="/settings/whatsapp" className="underline">Conectar meu WhatsApp</Link>}</p>}
    {message && <p role="status" className="rounded-xl bg-green-500/10 p-3 text-sm text-green-300">{message}</p>}
    <div className="flex items-center justify-between gap-3 pt-2"><h3 className="font-semibold text-white">Operadores autorizados</h3><button type="button" disabled={loading || busy} onClick={() => void refresh()} aria-label="Atualizar acessos" className="p-2 text-primary"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div>
    {!loading && rows.length === 0 && <p className="text-sm text-gray-400">Nenhum acesso liberado ainda. Comece pelo nome e WhatsApp acima.</p>}
    <ul className="space-y-3">{rows.map(row => <li key={row.id} className="rounded-xl border border-white/10 p-3 space-y-2">
      <p className="font-medium text-white break-words">{row.name}</p><p className="text-sm text-gray-400">+{row.phone} · {status[row.state]}</p>
      {blocking === row.id ? <div className="text-sm space-y-2"><p className="text-gray-200">Bloquear o acesso de {row.name} ao agente?</p><div className="flex gap-4"><button disabled={busy} onClick={() => void revoke(row.id)} className="text-red-400 py-2">Sim, bloquear</button><button disabled={busy} onClick={() => setBlocking(null)} className="text-gray-300 py-2">Cancelar</button></div></div> : row.state === 'active' || row.state === 'pending' ? <button disabled={busy} onClick={() => setBlocking(row.id)} className="text-sm text-red-400 py-2">Bloquear acesso</button> : <button disabled={busy} onClick={() => { setName(row.name); setPhone('+' + row.phone); setReview(true); document.getElementById('whatsapp-operators-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="text-sm text-primary py-2">Liberar novamente</button>}
    </li>)}</ul>
  </section>;
}
