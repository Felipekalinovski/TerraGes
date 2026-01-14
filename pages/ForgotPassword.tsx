
import React, { useState } from 'react';
import { Hammer, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simula envio de email
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-surface-dark p-8 rounded-2xl shadow-2xl border border-white/5 relative">
        <button 
            onClick={() => navigate('/login')}
            className="absolute top-4 left-4 p-2 text-gray-400 hover:text-white transition-colors"
        >
            <ArrowLeft size={20} />
        </button>

        <div className="flex flex-col items-center mb-8 mt-2">
          <div className="size-16 bg-[#4b3220] rounded-full flex items-center justify-center mb-4 text-primary">
            {isSent ? <CheckCircle size={32} /> : <Hammer size={32} />}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar Senha</h1>
          <p className="text-gray-400 text-sm text-center mt-2 px-4">
            {isSent 
                ? `Enviamos um link de recuperação para ${email}` 
                : "Digite seu e-mail para receber as instruções de redefinição."}
          </p>
        </div>

        {!isSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">E-mail Cadastrado</label>
                <div className="relative">
                    <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-lg bg-[#4b3220] border-none text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-text-gold/50"
                    placeholder="seu@email.com"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-gold" size={20} />
                </div>
            </div>

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Enviar Link de Recuperação"}
            </button>
            </form>
        ) : (
            <div className="space-y-4">
                <button 
                    onClick={() => navigate('/login')}
                    className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-all"
                >
                    Voltar para o Login
                </button>
                <p className="text-center text-xs text-gray-500">
                    Não recebeu? <button className="text-primary hover:underline" onClick={() => setIsSent(false)}>Tentar novamente</button>
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
