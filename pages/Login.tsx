
import React, { useState } from 'react';
import { Hammer, Mail, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(formData);
      if (error) throw error;
      navigate('/dashboard');
    } catch (error) {
      alert('Erro: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <form onSubmit={handleLogin} className="w-full max-w-md bg-surface-dark p-8 rounded-2xl border border-white/5 space-y-6">
        <h1 className="text-3xl font-bold text-white text-center">TerraGes</h1>
        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-12 px-4 rounded-lg bg-[#4b3220] text-white" placeholder="E-mail" />
        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full h-12 px-4 rounded-lg bg-[#4b3220] text-white" placeholder="Senha" />
        <button type="submit" disabled={isLoading} className="w-full h-12 bg-primary text-white font-bold rounded-lg">{isLoading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  );
};
