
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Lock, Key, Smartphone, ShieldCheck, Check, Loader2, RefreshCw } from 'lucide-react';
import { userService } from '../services/userService';

export const SettingsSecurity: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordUpdate = async () => {
    // Validate passwords
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('As senhas não coincidem');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setUpdatingPassword(true);
      const result = await userService.updatePassword(passwordData.newPassword);

      if (result.success) {
        alert('Senha atualizada com sucesso!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        alert(`Erro ao atualizar senha: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Erro ao atualizar senha');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <Layout>
      <Layout.Header 
        title="Segurança" 
        subTitle="Proteja sua conta e monitore acessos ativos"
        showBack
      />

      <Layout.Content>
        <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-700">

          {/* Change Password */}
          <div className="bg-surface-dark/40 backdrop-blur-md rounded-[28px] p-6 border border-white/5 space-y-5 shadow-glass">
            <div className="flex items-center gap-4 mb-2">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-neon-sm border border-primary/20">
                <Key size={24} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-white font-bold tracking-tight">Alteração de Senha</h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Credenciais de Acesso</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative group">
                <input
                  type="password"
                  placeholder="Nova Senha"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all placeholder:text-gray-600 font-mono"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
              </div>
              
              <div className="relative group">
                <input
                  type="password"
                  placeholder="Confirmar Nova Senha"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all placeholder:text-gray-600 font-mono"
                />
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" size={18} />
              </div>
            </div>

            <button
              onClick={handlePasswordUpdate}
              disabled={updatingPassword}
              className="w-full h-16 bg-white/[0.03] hover:bg-white/10 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-white/5"
            >
              {updatingPassword ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw size={16} /> Atualizar Credenciais
                </>
              )}
            </button>
          </div>

          {/* 2FA */}
          <div className="bg-surface-dark/40 backdrop-blur-md rounded-[28px] p-6 border border-white/5 shadow-glass relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <ShieldCheck size={120} />
            </div>
            
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-neon border border-primary/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-white font-bold tracking-tight">MFA / 2FA</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-0.5">Ativo e Protegido</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/30 shadow-neon-sm">
                <Check size={14} className="text-primary" strokeWidth={3} />
                <span className="text-primary text-[10px] font-black uppercase tracking-widest mt-0.5">Secure</span>
              </div>
            </div>
            <p className="text-gray-500 text-[11px] font-medium mt-6 leading-relaxed uppercase tracking-tighter">
              A autenticação de dois fatores está vinculada ao seu dispositivo de confiança.
            </p>
            <button className="w-full h-14 mt-6 bg-red-500/5 border border-red-500/20 text-red-500/60 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-red-500/10 transition-all active:scale-[0.98]">
              Desativar Camada de Segurança
            </button>
          </div>

          {/* Devices */}
          <div className="space-y-4 px-2">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Dispositivos no Node</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-5 bg-surface-dark/40 backdrop-blur-md rounded-[28px] border border-white/5 shadow-glass group">
                <div className="flex items-center gap-5">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:shadow-neon transition-all border border-primary/20">
                    <Smartphone size={24} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-white text-sm font-black tracking-tight">iPhone 14 Pro Premium</p>
                    <p className="text-gray-500 text-[9px] font-medium uppercase tracking-widest">São Paulo, BR • Local Session</p>
                  </div>
                </div>
                <div className="size-2 bg-primary rounded-full shadow-neon" />
              </div>
              <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[28px] border border-white/5 opacity-40">
                <div className="flex items-center gap-5">
                  <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-700">
                    <Smartphone size={24} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-white text-sm font-black tracking-tight italic">Chrome Workstation</p>
                    <p className="text-gray-600 text-[9px] font-medium uppercase tracking-widest">Acesso há 24 horas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </Layout.Content>
    </Layout>
  );
};
