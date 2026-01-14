
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Bell, Mail, MessageSquare, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { userService } from '../services/userService';

export const SettingsNotifications: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    pushMaintenance: true,
    emailReports: true,
    smsAlerts: false,
    pushSchedule: true,
    marketing: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await userService.getNotificationSettings();
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);

    // Save to backend
    try {
      await userService.updateNotificationSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      // Revert on error
      setSettings(settings);
      alert('Erro ao salvar configurações');
    }
  };

  const ToggleItem = ({
    icon,
    title,
    desc,
    checked,
    onChange
  }: {
    icon: React.ReactNode,
    title: string,
    desc: string,
    checked: boolean,
    onChange: () => void
  }) => (
    <div className="flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5">
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2 bg-[#4b3220] rounded-lg text-text-gold">
          {icon}
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">{title}</h3>
          <p className="text-gray-500 text-xs">{desc}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );

  if (loading) {
    return (
      <Layout title="Notificações" showBack hideNav>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Notificações" showBack hideNav>
      <div className="p-4 space-y-6 pb-24">

        <div className="space-y-4">
          <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider px-1">Alertas do Sistema</h2>

          <ToggleItem
            icon={<AlertTriangle size={20} />}
            title="Alertas de Manutenção"
            desc="Avisar quando uma máquina precisar de reparo"
            checked={settings.pushMaintenance}
            onChange={() => handleToggle('pushMaintenance')}
          />

          <ToggleItem
            icon={<Calendar size={20} />}
            title="Agenda e Serviços"
            desc="Lembretes de serviços agendados"
            checked={settings.pushSchedule}
            onChange={() => handleToggle('pushSchedule')}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider px-1">Comunicação</h2>

          <ToggleItem
            icon={<Mail size={20} />}
            title="Relatórios por E-mail"
            desc="Receber resumo semanal financeiro e RDO"
            checked={settings.emailReports}
            onChange={() => handleToggle('emailReports')}
          />

          <ToggleItem
            icon={<MessageSquare size={20} />}
            title="Alertas SMS"
            desc="Para notificações urgentes e críticas"
            checked={settings.smsAlerts}
            onChange={() => handleToggle('smsAlerts')}
          />
        </div>

      </div>
    </Layout>
  );
};
