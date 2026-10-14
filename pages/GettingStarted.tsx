import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../services/roleService';

export function GettingStarted() {
  const { profile } = useAuth();
  const manager = isAdminUser(profile?.role);
  const items = manager ? [
    ['Minha empresa', 'Confira o nome e complete os dados quando precisar.', '/settings/company'],
    ['Máquinas', 'Cadastre os equipamentos usados nos serviços.', '/fleet'],
    ['Orçamentos e serviços', 'Monte uma proposta e registre o trabalho aprovado.', '/orcamentos'],
    ['WhatsApp', 'Conecte seu número para enviar registros por mensagem.', '/settings/whatsapp'],
    ['Conferir envios', 'Revise os dados recebidos antes de confirmar um lançamento.', '/whatsapp-inbox'],
  ] : [
    ['Meu perfil', 'Confira seu nome e adicione uma foto, se quiser.', '/settings/profile'],
    ['Meu WhatsApp', 'Conecte seu próprio número para enviar registros.', '/settings/whatsapp'],
    ['Registrar serviço', 'Informe o trabalho realizado e envie para o gestor.', '/field-entry'],
  ];
  return <Layout><Layout.Header title="Como usar" subTitle="Um passo de cada vez" showBack /><Layout.Content><div className="tg-page tg-stack">
    <section className="tg-card tg-stack"><h2>Comece pelo essencial</h2><p>{manager ? 'Organize sua empresa, cadastre uma máquina e registre o primeiro serviço.' : 'Você registra o trabalho realizado. O gestor confere os envios e cuida da gestão da empresa.'}</p>
      {items.map(([title, description, path], i) => <Link className="tg-choice" key={path} to={path}><span><strong>{i + 1}. {title}</strong><small>{description}</small></span><ArrowRight size={20} /></Link>)}
    </section>
    <section className="tg-card tg-stack"><h2>Dúvidas comuns</h2>
      <details className="tg-details"><summary>O que enviar pelo WhatsApp?</summary><p>Informe a data, a máquina, o serviço e as horas. Exemplo: “Hoje trabalhei 5 horas com a retro na obra do João”. Você também pode enviar áudio e foto. Confira os dados extraídos antes da confirmação.</p></details>
      <details className="tg-details"><summary>Preciso conectar o WhatsApp agora?</summary><p>Não. Você pode usar os formulários do aplicativo e conectar depois em Meu perfil ou Meu WhatsApp.</p></details>
      <details className="tg-details"><summary>Meu vínculo com a empresa está pendente</summary><p>Peça ao responsável que confira seu cadastro e o e-mail de acesso. Não use a conta de outra pessoa.</p></details>
      {manager && <details className="tg-details"><summary>O TerraGes emite nota fiscal?</summary><p>O aplicativo organiza ordens de serviço, recibos e dados de cobrança. A nota fiscal é emitida pelo seu contador ou pelo sistema de emissão que você já utiliza.</p></details>}
    </section>
    <Link to="/onboarding" className="tg-button tg-secondary">Rever apresentação inicial</Link>
  </div></Layout.Content></Layout>;
}
