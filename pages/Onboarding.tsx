import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, Truck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { companyService } from '../services/companyService';
import { isAdminUser } from '../services/roleService';
import { ThemeToggle } from '../components/ThemeToggle';

export function Onboarding() {
  const { profile, refreshProfile, signOut } = useAuth();
  const manager = isAdminUser(profile?.role);
  const steps = manager ? ['Você', 'Empresa', 'Começar'] : ['Você', 'Começar'];
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name || '');
  const [company, setCompany] = useState('');
  const [companyLoaded, setCompanyLoaded] = useState(!manager);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const finalStep = step === steps.length - 1;

  async function loadCompany() {
    setError(''); setCompanyLoaded(false);
    const data = await companyService.getCompanyProfile();
    if (!data) { setError('Não conseguimos carregar a empresa. Tente novamente.'); return; }
    setCompany(data.name === 'Empresa — configuração pendente' ? '' : data.name);
    setCompanyLoaded(true);
  }
  useEffect(() => { if (manager) void loadCompany(); }, [profile?.company_id, manager]);
  useEffect(() => { heading.current?.focus(); }, [step]);

  async function next(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!(step === 0 ? name : company).trim()) { setError(step === 0 ? 'Informe seu nome.' : 'Informe o nome da empresa.'); return; }
    setBusy(true);
    try {
      const result = step === 0
        ? await userService.updateProfile({ name: name.trim() })
        : await companyService.updateCompanyProfile({ name: company.trim() });
      if (!result.success) throw new Error(result.error);
      await refreshProfile(); setStep(s => s + 1);
    } catch { setError('Não foi possível salvar. Confira sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }

  async function finish(path: string) {
    setBusy(true); setError('');
    try {
      const result = await userService.updateProfile({ onboarding_completed: true });
      if (!result.success) throw new Error(result.error);
      await refreshProfile(); navigate(path, { replace: true });
    } catch { setError('Não foi possível concluir. Tente novamente; os dados já salvos foram mantidos.'); }
    finally { setBusy(false); }
  }

  return <div className="tg-welcome">
    <div className="tg-welcome-shell tg-stack">
      <div className="tg-row"><div className="tg-brand tg-grow"><Truck size={25} />TerraGes</div><ThemeToggle /></div>
      <div><p className="tg-eyebrow">Vamos começar</p><h1>Seu trabalho, organizado.</h1><p className="tg-muted">Só o essencial agora. O restante você configura quando precisar.</p></div>
      <ol className="tg-progress" aria-label="Etapas do primeiro acesso">{steps.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} data-active={i <= step}><span>{i < step ? <CheckCircle2 size={18} /> : i + 1}</span>{label}</li>)}</ol>
      <section className="tg-card tg-stack">
        <p className="tg-muted">Passo {step + 1} de {steps.length}</p>
        <h2 ref={heading} tabIndex={-1}>{step === 0 ? 'Como podemos chamar você?' : finalStep ? 'Por onde quer começar?' : 'Qual é o nome da sua empresa?'}</h2>
        {!finalStep ? <form className="tg-stack" onSubmit={next}>
          {step === 0 ? <div className="tg-field"><label htmlFor="welcome-name">Seu nome</label><input id="welcome-name" autoComplete="name" maxLength={120} required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Felipe Santos" /><p className="tg-muted">Você pode adicionar uma foto depois, no seu perfil.</p></div>
            : <><p>Use o nome que seus clientes conhecem. CNPJ e endereço podem ficar para depois.</p><div className="tg-field"><label htmlFor="welcome-company">Nome da empresa</label><input id="welcome-company" autoComplete="organization" maxLength={160} disabled={!companyLoaded} required value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex.: Martins Terraplanagem" /></div>{!companyLoaded && <button type="button" className="tg-button tg-secondary" onClick={loadCompany}>Carregar empresa novamente</button>}</>}
          {error && <p className="tg-error" role="alert">{error}</p>}
          <button className="tg-button tg-primary" disabled={busy || (step === 1 && !companyLoaded)}>{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}{busy ? 'Salvando…' : 'Salvar e continuar'}</button>
        </form> : <>
          <p>Seu cadastro básico está salvo. Escolha uma opção ou entre no aplicativo.</p>
          <div className="tg-stack">
            {(manager ? [
              { title: 'Cadastrar minha primeira máquina', description: 'Prepare os equipamentos para registrar serviços.', path: '/fleet/add' },
              { title: 'Conectar meu WhatsApp', description: 'Envie registros por texto, áudio ou foto. Opcional.', path: '/settings/whatsapp' },
            ] : [
              { title: 'Registrar um serviço', description: 'Envie os dados do trabalho para o gestor conferir.', path: '/field-entry' },
              { title: 'Conectar meu WhatsApp', description: 'Faça seus registros por mensagem. Opcional.', path: '/settings/whatsapp' },
            ]).map(item => <button key={item.path} className="tg-choice" disabled={busy} onClick={() => finish(item.path)}><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowRight size={20} /></button>)}
          </div>
          {error && <p className="tg-error" role="alert">{error}</p>}
          <button className="tg-button tg-primary" disabled={busy} onClick={() => finish(manager ? '/dashboard' : '/field-entry')}>{busy && <Loader2 size={18} className="animate-spin" />}Entrar no aplicativo</button>
          <p className="tg-muted">A ajuda fica em Mais → Como usar.</p>
        </>}
        {step > 0 && <button type="button" className="tg-link" disabled={busy} onClick={() => { setError(''); setStep(s => s - 1); }}>Voltar ao passo anterior</button>}
      </section>
      <button className="tg-link" disabled={busy} onClick={async () => { await signOut(); navigate('/login'); }}>Sair da conta</button>
    </div>
  </div>;
}
