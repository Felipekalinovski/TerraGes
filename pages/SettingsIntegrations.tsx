
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Cloud, MessageCircle, Database, Check, Plus, X, Loader2 } from 'lucide-react';

export const SettingsIntegrations: React.FC = () => {
  const [integrations] = useState([
    { id: 1, name: 'Google Drive', desc: 'Backup de RDOs', icon: <Cloud size={20} />, connected: true },
    { id: 2, name: 'WhatsApp', desc: 'Notificações', icon: <MessageCircle size={20} />, connected: false },
  ]);
  return (
    <Layout title="Integrações" showBack hideNav>
      <div className="p-4 space-y-4">
        {integrations.map(item => (
          <div key={item.id} className="bg-surface-dark p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">{item.icon}</div>
              <div><h3 className="font-bold">{item.name}</h3><p className="text-xs text-gray-500">{item.desc}</p></div>
            </div>
            <button className={`px-4 py-2 rounded-lg text-xs font-bold ${item.connected ? 'bg-positive/10 text-positive' : 'bg-white/10'}`}>{item.connected ? 'Conectado' : 'Conectar'}</button>
          </div>
        ))}
      </div>
    </Layout>
  );
};
