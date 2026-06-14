
import React, { useState } from 'react';
import { Truck, User, Mail, Lock, ArrowRight, Loader2, Chrome } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
        },
      });

      if (error) throw error;

      alert("Conta criada com sucesso! Verifique seu e-mail para confirmar.");
      navigate('/login');
    } catch (error) {
      alert('Erro ao criar conta: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error) {
      alert('Erro ao cadastrar com Google: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-surface-dark/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/10">
        <div className="flex flex-col items-center mb-6">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10 flex items-center justify-center mb-3 shadow-lg shadow-primary/10">
            <Truck className="text-primary" size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Criar Conta</h1>
          <p className="text-gray-400 text-sm">Junte-se ao TerraGes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome Completo</label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-white/30 text-sm"
                placeholder="Seu nome"
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">E-mail</label>
            <div className="relative">
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-white/30 text-sm"
                placeholder="seu@email.com"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-white/30 text-sm"
                placeholder="••••••••"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Confirmar Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-white/30 text-sm"
                placeholder="••••••••"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={18} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/20 mt-6 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Cadastrar"}
            {!isLoading && <ArrowRight size={20} />}
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
            onClick={handleGoogleSignUp}
            className="w-full h-12 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition-all shadow-lg flex items-center justify-center gap-3 group"
          >
            <Chrome size={20} className="text-blue-600" />
            <span>Continuar com Google</span>
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Já tem uma conta? <button onClick={() => navigate('/login')} className="text-primary font-bold hover:underline">Faça Login</button>
        </div>
      </div>
    </div>
  );
};
