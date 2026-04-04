import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Building2, Truck, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';


export function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFinish = async (redirectUri = '/dashboard') => {
    if (!user) return;
    setLoading(true);
    try {
      // Marcar onboarding como concluído no banco
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (error) throw error;
      
      // Force reload to update AuthContext profile state
      window.location.href = redirectUri;
    } catch (err: any) {
      console.error(err);
      alert('Erro ao finalizar configurações.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-[#111111] to-[#111111]">
      
      <div className="w-full max-w-md">
        {/* Header / Logo */}
        <div className="flex justify-center mb-8">
          <h1 className="text-3xl font-black tracking-tighter text-white">
            TERRA<span className="text-primary">GES</span>
          </h1>
        </div>

        {/* Card */}
        <div className="bg-[#1A1A1A] p-6 sm:p-8 border border-[#2A2A2A] rounded-3xl shadow-xl shadow-black/50">
          
          {/* Progress */}
          <div className="flex gap-2 mb-8">
            <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-[#333]'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-[#333]'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-[#333]'}`} />
          </div>

          {/* Steps Content */}
          <div className="min-h-[250px]">
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <Building2 size={24} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Dados da Empresa</h2>
                <p className="text-gray-400 text-sm mb-6">Como vamos chamar sua empresa no sistema e nos orçamentos?</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Nome da Empresa</label>
                    <input type="text" placeholder="Ex: Silva Terraplenagem" className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-gray-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Cidade / UF</label>
                      <input type="text" placeholder="Ex: SP" className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Telefone</label>
                      <input type="text" placeholder="(00) 00000-0000" className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-gray-600" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <Truck size={24} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Primeira Máquina</h2>
                <p className="text-gray-400 text-sm mb-6">Adicione seu principal equipamento para já começar a usar.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Nome / Modelo</label>
                    <input type="text" placeholder="Ex: Retroescavadeira CAT 416F2" className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Tipo</label>
                    <select className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer">
                      <option>Retroescavadeira</option>
                      <option>Escavadeira Hidráulica</option>
                      <option>Caminhão Basculante</option>
                      <option>Pá Carregadeira</option>
                      <option>Rolo Compactador</option>
                      <option>Outro</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center flex flex-col items-center justify-center pt-4">
                <div className="size-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <CheckCircle size={40} className="animate-pulse" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Tudo Pronto!</h2>
                <p className="text-gray-400 text-sm mb-8 px-4">Seu sistema está pronto para uso. O que você quer fazer agora?</p>
                
                <div className="space-y-3 w-full">
                  <button 
                    onClick={async () => {
                      await handleFinish('/orcamentos');
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-[#0A0A0A] font-black uppercase py-4 px-6 rounded-2xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    Fazer um Orçamento
                    <ArrowRight size={18} />
                  </button>
                  <button 
                    onClick={() => handleFinish('/dashboard')}
                    className="w-full bg-[#111] hover:bg-[#222] border border-[#333] text-white font-bold uppercase py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Ir para o Início'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          {step < 3 && (
            <div className="mt-8 pt-6 border-t border-[#2A2A2A] flex items-center justify-between">
              <button 
                onClick={() => handleFinish('/dashboard')} 
                className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
                disabled={loading}
              >
                Pular
              </button>
              
              <button 
                onClick={() => setStep(s => s + 1)}
                className="bg-white hover:bg-gray-200 text-[#0A0A0A] px-6 py-3 rounded-xl font-black uppercase tracking-wide text-xs flex items-center gap-2 transition-all hover:scale-105"
              >
                Próximo
                <ArrowRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
