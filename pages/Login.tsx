
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Truck } from 'lucide-react';
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

  const handleGoogleLogin = async () => {
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar com Google');
    }
  };

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
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-gradient pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[400px] z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10 rounded-3xl mb-6 shadow-lg shadow-primary/10">
            <Truck className="text-primary" size={36} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">TerraGes <span className="text-primary italic">OS</span></h1>
          <p className="text-[10px] text-accent font-bold uppercase tracking-[0.3em]">Sistemas de Gestão de Ativos</p>
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
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-4 tracking-widest">Seu E-mail</label>
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
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-2 ml-4 tracking-widest">Sua Senha</label>
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
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Entrar com E-mail"}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/40 text-[10px] font-black uppercase tracking-widest">ou</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-14 bg-white hover:bg-gray-200 active:scale-[0.98] text-black font-black uppercase tracking-widest text-xs rounded-[20px] transition-all flex items-center justify-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
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
