import React from 'react';
import {Link} from 'react-router-dom';
import {Layout} from '../components/Layout';
export const SettingsIntegrations:React.FC=()=> <Layout><Layout.Header title="Integrações" showBack/><Layout.Content><div className="p-6 space-y-4 text-white max-w-2xl"><h2 className="font-bold text-xl">WhatsApp TerraGes</h2><p className="text-gray-400">Cada pessoa deve vincular seu próprio número à conta. Os envios ficam disponíveis apenas dentro da empresa, conforme o perfil de acesso.</p><Link to="/whatsapp-inbox" className="inline-block px-4 py-3 bg-primary text-black rounded-xl">Vincular meu número e ver envios</Link><p className="text-sm text-gray-500">A conexão do número oficial é administrada pelo responsável técnico do TerraGes.</p></div></Layout.Content></Layout>;
