import React, { useState } from 'react';
import { Hammer, Mail, Lock, Loader2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <div className="w-full max-w-md bg-surface-dark p-8 rounded-2xl shadow-2xl border border-white/5">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Hammer className="text-primary" size={40} />
            <h1 className="text-3xl font-bold text-white">TerraGes</h1>
          </div>
          <p className="text-gray-400">Gestão inteligente para sua obra</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full h-12 px-4 rounded-lg bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full h-12 px-4 rounded-lg bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Não tem uma conta? <button onClick={() => navigate('/signup')} className="text-primary font-bold hover:underline">Cadastre-se</button>
        </div>
      </div>
    </div>
  );
};
