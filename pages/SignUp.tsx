import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Truck } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { ThemeToggle } from '../components/ThemeToggle';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!form.name.trim()) { setError('Informe seu nome.'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(), password: form.password,
        options: { data: { name: form.name.trim() }, emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (error) throw error;
      if (data.session) navigate('/onboarding', { replace: true });
      else setSent(true);
    } catch (err: any) {
      setError(err.code === 'weak_password' ? 'Escolha uma senha mais forte, com letras, números e símbolos.' : err.code === 'over_email_send_rate_limit' ? 'Aguarde alguns minutos antes de tentar novamente.' : 'Não foi possível criar sua conta. Confira os dados ou entre se já tiver cadastro.');
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/onboarding` } });
      if (error) throw error;
    } catch { setError('Não foi possível continuar com Google. Tente o cadastro por e-mail.'); setBusy(false); }
  }

  return <div className="tg-welcome"><div className="tg-welcome-shell tg-stack">
    <div className="tg-row"><Link to="/login" className="tg-brand tg-grow"><Truck size={25} />TerraGes</Link><ThemeToggle /></div>
    {sent ? <section className="tg-card tg-stack">
      <CheckCircle2 className="text-positive" size={32} /><h1>Confira seu e-mail</h1>
      <p>Se o cadastro precisar de confirmação, enviaremos um link para <strong className="tg-wrap">{form.email.trim()}</strong>. Abra o link para continuar.</p>
      <p className="tg-muted">Confira também o spam. Se você já tem uma conta, entre com sua senha.</p>
      <Link to="/login" className="tg-button tg-primary">Ir para o login</Link>
      <button className="tg-link" onClick={() => setSent(false)}>Corrigir meu e-mail</button>
    </section> : <>
      <div><p className="tg-eyebrow">Primeiro acesso</p><h1>Crie sua conta</h1><p className="tg-muted">Comece com seu nome, e-mail e uma senha. Depois, vamos organizar sua empresa juntos.</p></div>
      <form className="tg-card tg-stack" onSubmit={submit}>
        <div className="tg-field"><label htmlFor="signup-name">Seu nome</label><input id="signup-name" autoComplete="name" required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Como podemos chamar você?" /></div>
        <div className="tg-field"><label htmlFor="signup-email">E-mail</label><input id="signup-email" autoComplete="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@exemplo.com.br" /></div>
        <div className="tg-field"><label htmlFor="signup-password">Crie uma senha</label><div className="tg-password"><input id="signup-password" autoComplete="new-password" type={show ? 'text' : 'password'} minLength={8} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} aria-describedby="password-hint" /><button type="button" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button></div><p id="password-hint" className="tg-muted">Use pelo menos 8 caracteres.</p></div>
        {error && <p role="alert" className="tg-error">{error}</p>}
        <button disabled={busy} type="submit" className="tg-button tg-primary">{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}Criar conta e continuar</button>
        <div className="tg-divider">ou</div>
        <button type="button" disabled={busy} onClick={google} className="tg-button tg-secondary">Continuar com Google</button>
      </form>
      <p className="tg-muted">Já usa o TerraGes? <Link className="tg-link" to="/login">Entrar na minha conta</Link></p>
    </>}
  </div></div>;
};
