
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Bell, Mail, MessageSquare, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { userService } from '../services/userService';

export const SettingsNotifications: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ pushMaintenance: true, emailReports: true, smsAlerts: false, pushSchedule: true, marketing: false });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await userService.getNotificationSettings();
      if (data) setSettings(data);
    } finally { setLoading(false); }
  };

  const handleToggle = async (key: keyof typeof settings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await userService.updateNotificationSettings(next);
  };

  if (loading) return <Layout title="Notificações" showBack hideNav><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title="Notificações" showBack hideNav>
      <div className="p-4 space-y-4">
        {Object.entries(settings).map(([key, val]) => (
          <div key={key} className="flex justify-between items-center bg-surface-dark p-4 rounded-xl">
            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
            <input type="checkbox" checked={val} onChange={() => handleToggle(key as any)} className="size-6 accent-primary" />
          </div>
        ))}
      </div>
    </Layout>
  );
};
