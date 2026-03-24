
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ShieldCheck, HardHat } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 1. Buscar perfil atual
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') throw profileError;

        // 2. Se não tiver empresa vinculada, tentar descobrir via tabela de funcionários
        if (!profile?.company_id) {
          const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('company_id, role')
            .eq('email', authData.user.email)
            .maybeSingle();

          if (employee) {
            // Vincular perfil à empresa e definir como operador/user
            await supabase
              .from('profiles')
              .update({ 
                company_id: employee.company_id,
                role: 'operador' // Funcionários entram como operador por padrão
              })
              .eq('id', authData.user.id);
            
            // Também vincular o user_id na tabela de funcionários para referência futura
            await supabase
              .from('employees')
              .update({ user_id: authData.user.id })
              .eq('email', authData.user.email);
          }
        }

        await refreshProfile();
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor - Removed for Clean Look */}

      <div className="w-full max-w-[400px] z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center size-16 bg-white/5 border border-white/10 rounded-2xl mb-6 shadow-md">
            <ShieldCheck className="text-primary" size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">TerraGes <span className="text-primary italic">OS</span></h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Sistemas de Gestão de Ativos</p>
        </div>

        <div className="bg-surface-dark border border-white/5 p-8 rounded-[32px] shadow-xl relative group">
          
          <form onSubmit={handleLogin} className="space-y-6 relative">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest text-center animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-4 tracking-widest">Acesso do Operador</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 focus-within:text-primary transition-colors" size={18} />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-14 pl-14 pr-6 rounded-[20px] bg-white/5 border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-gray-700 text-sm font-medium"
                    placeholder="exemplo@engeman.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-4 tracking-widest">Chave de Segurança</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 focus-within:text-primary transition-colors" size={18} />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-14 pl-14 pr-6 rounded-[20px] bg-white/5 border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-gray-700 text-sm font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-primary hover:brightness-110 active:scale-[0.98] text-black font-black uppercase tracking-[0.2em] italic text-xs rounded-[20px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Autenticar Entrada"}
            </button>
            
            <button 
              type="button" 
              onClick={() => navigate('/forgot-password')} 
              className="w-full text-center text-[9px] text-gray-600 hover:text-primary transition-colors font-black uppercase tracking-widest pt-2"
            >
              Recuperar Acesso
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-4">Novo Gestor?</p>
          <button 
            onClick={() => navigate('/signup')} 
            className="px-8 py-3 rounded-full border border-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/5 hover:border-white/10 transition-all"
          >
            Cadastrar Empresa
          </button>
        </div>
      </div>
    </div>
  );
};
