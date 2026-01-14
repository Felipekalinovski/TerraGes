
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Lock, Key, Smartphone, ShieldCheck, Check, Loader2 } from 'lucide-react';
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
    <Layout title="Segurança" showBack hideNav>
      <div className="p-4 space-y-6 pb-24">

        {/* Change Password */}
        <div className="bg-surface-dark rounded-2xl p-5 border border-white/5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Key size={20} />
            </div>
            <h3 className="text-white font-bold">Alterar Senha</h3>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="Nova Senha"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
            />
            <input
              type="password"
              placeholder="Confirmar Nova Senha"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full h-12 px-4 rounded-xl bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <button
            onClick={handlePasswordUpdate}
            disabled={updatingPassword}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {updatingPassword ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Atualizando...
              </>
            ) : (
              'Atualizar Senha'
            )}
          </button>
        </div>

        {/* 2FA */}
        <div className="bg-surface-dark rounded-2xl p-5 border border-white/5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-positive/10 rounded-lg text-positive">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold">Autenticação de Dois Fatores</h3>
                <p className="text-gray-400 text-xs mt-1">Camada extra de segurança</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-positive/10 px-3 py-1 rounded-full border border-positive/20">
              <Check size={14} className="text-positive" />
              <span className="text-positive text-xs font-bold">Ativado</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-4 leading-relaxed">
            Sua conta está protegida. O código de verificação será solicitado a cada novo login.
          </p>
          <button className="w-full mt-4 bg-transparent border border-red-500/30 text-red-400 font-medium py-3 rounded-xl hover:bg-red-500/5 transition-colors">
            Desativar
          </button>
        </div>

        {/* Devices */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Dispositivos Conectados</h3>
          <div className="flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <Smartphone size={20} className="text-gray-400" />
              <div>
                <p className="text-white text-sm font-medium">iPhone 14 Pro</p>
                <p className="text-gray-500 text-xs">São Paulo, BR • Este dispositivo</p>
              </div>
            </div>
            <span className="size-2 bg-positive rounded-full"></span>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5 opacity-70">
            <div className="flex items-center gap-3">
              <Smartphone size={20} className="text-gray-400" />
              <div>
                <p className="text-white text-sm font-medium">Chrome no Windows</p>
                <p className="text-gray-500 text-xs">Ontem às 18:30</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};
