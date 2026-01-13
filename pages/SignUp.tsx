
import React, { useState } from 'react';
import { Hammer, User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return alert("Senhas não coincidem.");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: formData.email, password: formData.password, options: { data: { name: formData.name } } });
      if (error) throw error;
      alert("Sucesso! Verifique seu e-mail.");
      navigate('/login');
    } catch (error) {
      alert('Erro: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-surface-dark p-8 rounded-2xl border border-white/5 space-y-4">
        <h1 className="text-2xl font-bold text-white text-center">Criar Conta</h1>
        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white" placeholder="Nome" />
        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white" placeholder="E-mail" />
        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white" placeholder="Senha" />
        <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full h-11 px-4 rounded-lg bg-[#4b3220] text-white" placeholder="Confirmar Senha" />
        <button type="submit" disabled={isLoading} className="w-full h-12 bg-primary text-white font-bold rounded-lg flex items-center justify-center gap-2">{isLoading ? <Loader2 className="animate-spin" /> : "Cadastrar"}</button>
      </form>
    </div>
  );
};
