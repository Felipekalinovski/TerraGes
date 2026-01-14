
import React, { useState } from 'react';
import { Hammer, User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-surface-dark p-8 rounded-2xl shadow-2xl border border-white/5">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Hammer className="text-primary" size={32} />
            <h1 className="text-2xl font-bold text-white tracking-tight">Criar Conta</h1>
          </div>
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
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-text-gold/50 text-sm"
                placeholder="Seu nome"
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={18} />
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
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-text-gold/50 text-sm"
                placeholder="seu@email.com"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={18} />
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
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-text-gold/50 text-sm"
                placeholder="••••••••"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={18} />
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
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-text-gold/50 text-sm"
                placeholder="••••••••"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={18} />
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
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Já tem uma conta? <button onClick={() => navigate('/login')} className="text-primary font-bold hover:underline">Faça Login</button>
        </div>
      </div>
    </div>
  );
};
