import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

/** Personal pairing only; never fetch company conversations in this component. */
export function WhatsAppConnection() {
  const { profile } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [replace, setReplace] = useState(false);

  useEffect(() => {
    let active = true;
    setConnected(null); setCode(''); setReplace(false); setError('');
    supabase.rpc('my_whatsapp_status').then(({ data, error }) => {
      if (!active) return;
      if (error) setError('Não conseguimos conferir a conexão. Tente novamente.');
      else setConnected(data === true);
    });
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    if (!code) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [code]);

  async function check() {
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.rpc('my_whatsapp_status');
      if (error) throw error;
      setConnected(data === true);
      // Existing binding is not evidence that a replacement code was consumed.
      if (data === true && !replace) { setCode(''); setCopied(false); }
    } catch { setError('Não conseguimos conferir a conexão. Tente novamente.'); }
    finally { setBusy(false); }
  }

  async function generate() {
    setBusy(true); setError(''); setCopied(false); setCode('');
    try {
      const { data, error } = await supabase.rpc('create_whatsapp_pairing');
      if (error || typeof data !== 'string' || !data) throw error || new Error('empty_code');
      setCode(data); setNow(Date.now()); setExpiresAt(Date.now() + 10 * 60 * 1000);
    } catch { setError('Não foi possível gerar o código. Tente novamente ou peça ajuda ao responsável da empresa.'); }
    finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { setError('Não foi possível copiar automaticamente. Selecione a mensagem abaixo e copie.'); }
  }

  const expired = !!code && now >= expiresAt;
  return <section className="tg-card tg-stack" aria-label="Conexão do WhatsApp">
    <div className="tg-row">
      <MessageCircle size={24} className="text-primary" aria-hidden="true" />
      <div className="tg-grow"><h2>Seu WhatsApp</h2><p className="tg-muted" role="status">{connected === null ? 'Conferindo conexão…' : connected ? 'Conectado à sua conta' : 'Ainda não conectado'}</p></div>
      {connected && <CheckCircle2 size={22} className="text-positive" aria-label="Conectado" />}
    </div>
    {connected && !replace ? <>
      <p>Seu número já está pronto para enviar mensagens ao TerraGes. Você não precisa gerar outro código.</p>
      <details className="tg-details"><summary>Como usar e trocar de número</summary>
        <p>Envie um texto, áudio ou foto ao contato oficial do TerraGes. Informe a máquina, a data e o serviço realizado.</p>
        <button type="button" className="tg-button tg-secondary" onClick={() => setReplace(true)}>Conectar outro número</button>
      </details>
    </> : connected !== null && <>
      <p>Conecte seu número para registrar serviços por mensagem. Você pode fazer isso depois.</p>
      <ol className="tg-instructions">
        <li>Gere e copie a mensagem de conexão.</li>
        <li>Envie pelo <strong>seu WhatsApp</strong> ao contato oficial do TerraGes, informado pelo responsável da empresa.</li>
        <li>{replace ? 'Aguarde a confirmação na conversa do WhatsApp.' : 'Volte aqui e toque em “Conferir conexão”.'}</li>
      </ol>
      {(!code || expired) && <button type="button" disabled={busy} onClick={generate} className="tg-button tg-primary">{busy && <Loader2 size={18} className="animate-spin" />}{expired ? 'Gerar nova mensagem' : 'Gerar mensagem de conexão'}</button>}
      {code && !expired && <div className="tg-code">
        <p className="tg-muted">Envie esta mensagem. Válida por mais {Math.max(1, Math.ceil((expiresAt - now) / 60000))} min.</p>
        <code>{code}</code>
        <button type="button" onClick={copy} className="tg-button tg-secondary"><Copy size={18} />{copied ? 'Mensagem copiada' : 'Copiar mensagem'}</button>
      </div>}
      {expired && <p role="status">A mensagem expirou. Gere uma nova para continuar.</p>}
      {code && !replace && <button type="button" className="tg-button tg-secondary" disabled={busy} onClick={check}>Conferir conexão</button>}
      {replace && <button type="button" className="tg-button tg-secondary" onClick={() => { setReplace(false); setCode(''); }}>Voltar</button>}
      <p className="tg-muted">O código é pessoal. Não compartilhe com outra pessoa.</p>
    </>}
    {error && <div role="alert" className="tg-error">{error}{connected === null && <button type="button" className="tg-button tg-secondary" disabled={busy} onClick={check}>Tentar novamente</button>}</div>}
  </section>;
}
