import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../services/supabaseClient';

export const WhatsAppPairing: React.FC = () => {
  const [binding, setBinding] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setBusy(true);
      setError('');
      const { data, error } = await supabase.rpc('my_whatsapp_status');
      if (error) throw error;
      setBinding(Boolean(data));
    } catch {
      setError('Não foi possível consultar o vínculo do seu próprio WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pair = async () => {
    try {
      setBusy(true);
      setError('');
      const { data, error } = await supabase.rpc('create_whatsapp_pairing');
      if (error) throw error;
      setCode(String(data || ''));
    } catch {
      setError('Não foi possível gerar o código de vínculo. Confira seu cadastro com o gestor.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Layout>
      <Layout.Header title="Meu WhatsApp" subTitle="Vínculo seguro para envio de dados" showBack />
      <Layout.Content>
        <div className="max-w-xl mx-auto p-4 pb-32 space-y-5">
          <div className="rounded-[28px] border border-primary/15 bg-primary/5 p-5 flex gap-4">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="font-black text-white">Vínculo pessoal e restrito</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Esta tela serve somente para vincular o seu número. Ela não mostra conversas,
                histórico operacional, máquinas, faturamento ou qualquer dado da empresa.
              </p>
            </div>
          </div>

          <section className="rounded-[28px] bg-surface-dark/40 border border-white/5 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-2xl flex items-center justify-center ${binding ? 'bg-positive/10 text-positive' : 'bg-warning/10 text-warning'}`}>
                {binding ? <CheckCircle2 size={19} /> : <Link2 size={19} />}
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Situação</p>
                <p className="font-black text-white">{binding ? 'WhatsApp vinculado' : 'Vínculo pendente'}</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Gere um código e envie a mensagem pelo seu próprio WhatsApp ao número oficial do TerraGes
              informado pela empresa. O código expira e identifica somente a sua conta.
            </p>

            <button
              disabled={busy}
              onClick={pair}
              className="w-full h-12 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              Gerar código de vínculo
            </button>

            {code && (
              <div className="rounded-2xl bg-black/25 border border-white/5 p-4">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Mensagem para enviar</p>
                <code className="block break-all text-sm text-white select-all">{code}</code>
                <button
                  type="button"
                  onClick={copy}
                  className="mt-3 h-9 px-4 rounded-xl bg-white/5 text-primary text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                  {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="w-full h-10 rounded-xl bg-white/5 text-gray-300 text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Conferir vínculo
            </button>

            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          </section>
        </div>
      </Layout.Content>
    </Layout>
  );
};
