
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
    <div className="flex items-center justify-between p-5 bg-surface-dark/40 backdrop-blur-md rounded-[28px] border border-white/5 transition-all hover:border-primary/20 shadow-glass group">
      <div className="flex items-center gap-5 flex-1">
        <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 border border-white/5">
          {icon}
        </div>
        <div className="space-y-0.5">
          <h3 className="text-white font-bold tracking-tight text-sm">{title}</h3>
          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-widest">{desc}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-12 h-6.5 bg-white/5 rounded-full peer peer-checked:after:translate-x-[22px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-gray-500 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-black peer-checked:after:shadow-neon border border-white/5"></div>
      </label>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <Layout.Header title="Notificações" showBack />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Header 
        title="Notificações" 
        subTitle="Gerencie como e quando você recebe alertas"
        showBack 
      />

      <Layout.Content>
        <div className="p-4 space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-4">
            <div className="px-4 flex items-center gap-2">
              <div className="size-1.5 bg-primary rounded-full shadow-neon" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Alertas de Operação</h2>
            </div>

            <ToggleItem
              icon={<AlertTriangle size={20} />}
              title="Manutenção Preditiva"
              desc="Alertas de fadiga e reparo de máquinas"
              checked={settings.pushMaintenance}
              onChange={() => handleToggle('pushMaintenance')}
            />

            <ToggleItem
              icon={<Calendar size={20} />}
              title="Escala & Cronograma"
              desc="Atualizações de agenda e check-ins"
              checked={settings.pushSchedule}
              onChange={() => handleToggle('pushSchedule')}
            />
          </div>

          <div className="space-y-4">
            <div className="px-4 flex items-center gap-2">
              <div className="size-1.5 bg-primary rounded-full shadow-neon" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Fluxo de Dados</h2>
            </div>

            <ToggleItem
              icon={<Mail size={20} />}
              title="Relatórios de Performance"
              desc="Resumo semanal financeiro e RDO"
              checked={settings.emailReports}
              onChange={() => handleToggle('emailReports')}
            />

            <ToggleItem
              icon={<MessageSquare size={20} />}
              title="Alertas Críticos (SMS)"
              desc="Notificações de alta prioridade"
              checked={settings.smsAlerts}
              onChange={() => handleToggle('smsAlerts')}
            />
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
