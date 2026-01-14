
import React, { useState } from 'react';
import { Hammer, Mail, Lock, Loader2, Chrome } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      navigate('/dashboard');
    } catch (error) {
      alert('Erro ao fazer login: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error) {
      alert('Erro ao fazer login com Google: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-surface-dark/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Hammer className="text-primary" size={40} />
            <h1 className="text-3xl font-bold text-white tracking-tight">TerraGes</h1>
          </div>
          <p className="text-gray-400">Gestão inteligente para sua obra</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">E-mail</label>
            <div className="relative">
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-12 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-white/30"
                placeholder="seu@email.com"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-12 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-white/30"
                placeholder="••••••••"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={20} />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="rounded border-gray-600 bg-transparent text-primary focus:ring-primary" />
              <span className="text-gray-400 group-hover:text-white transition-colors">Lembrar-me</span>
            </label>
            <button type="button" onClick={() => navigate('/forgot-password')} className="text-primary hover:underline">Esqueceu a senha?</button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Entrar"}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface-dark text-gray-400">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-12 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition-all shadow-lg flex items-center justify-center gap-3 group"
          >
            <Chrome size={20} className="text-blue-600" />
            <span>Continuar com Google</span>
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Não tem uma conta? <button onClick={() => navigate('/signup')} className="text-primary font-bold hover:underline ml-1">Cadastre-se</button>
        </div>
      </div>
    </div>
  );
};
