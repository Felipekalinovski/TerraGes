import React from 'react';
import { Layout } from '../components/Layout';
import { WhatsAppConnection } from '../components/WhatsAppConnection';

export const WhatsAppPairing: React.FC = () => <Layout>
  <Layout.Header title="Meu WhatsApp" subTitle="Envie seus registros por mensagem" showBack />
  <Layout.Content><div className="tg-page"><WhatsAppConnection /></div></Layout.Content>
</Layout>;
