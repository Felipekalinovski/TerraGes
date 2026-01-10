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
        options: { data: { name: formData.name } },
      });

      if (error) throw error;
      alert("Conta criada com sucesso! Verifique seu e-mail.");
      navigate('/login');
    } catch (error) {
      alert('Erro ao criar conta: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <div className="w-full max-w-md bg-surface-dark p-8 rounded-2xl shadow-2xl border border-white/5">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Hammer className="text-primary" size={32} />
            <h1 className="text-2xl font-bold text-white">Criar Conta</h1>
          </div>
          <p className="text-gray-400 text-sm">Junte-se ao TerraGes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nome Completo</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirmar Senha</label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-primary text-white font-bold rounded-lg mt-6"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin m-auto" /> : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
};
