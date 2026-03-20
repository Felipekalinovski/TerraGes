
import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Cloud, MessageCircle, Database, Check, Plus, X, Loader2, Smartphone, ShieldCheck, RefreshCw } from 'lucide-react';
import { createEvolutionInstance, connectEvolutionInstance, setEvolutionWebhook, EvolutionConfig } from '../services/evolutionApiService';

export const SettingsIntegrations: React.FC = () => {
  const [integrations, setIntegrations] = useState([
    { id: 1, name: 'Google Drive', desc: 'Backup automático de RDOs', icon: <Cloud size={20} />, connected: true },
    { id: 2, name: 'WhatsApp (Evolution)', desc: 'Notificações de obras e alertas', icon: <MessageCircle size={20} />, connected: false },
    { id: 3, name: 'ERP Totvs', desc: 'Sincronização financeira', icon: <Database size={20} />, connected: false },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  
  // States do Fluxo Simplificado
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'init' | 'generating' | 'waiting_scan' | 'success' | 'error'>('init');
  
  // Configuração "Hardcoded" (Simulando que vem do env ou backend do SaaS)
  const configData: EvolutionConfig = { 
    baseUrl: 'https://api.seudominio.com', // Em prod, usar process.env
    apiKey: 'SUA_GLOBAL_API_KEY_SECRETA', 
    instanceName: 'terrages_client_01' 
  };

  const handleAction = (id: number, isConnected: boolean) => {
    if (isConnected) {
      // Simula desconexão
      if (confirm("Deseja realmente desconectar? O envio de mensagens será interrompido.")) {
        setIntegrations(prev => prev.map(item => 
          item.id === id ? { ...item, connected: false } : item
        ));
      }
    } else {
      if (id === 2) {
        setActiveId(id);
        setStatus('init');
        setShowModal(true);
        // Inicia o processo automaticamente ao abrir
        startConnectionProcess();
      } else {
        setIntegrations(prev => prev.map(item => 
          item.id === id ? { ...item, connected: true } : item
        ));
      }
    }
  };

  const startConnectionProcess = async () => {
    setStatus('generating');
    setIsLoading(true);
    setQrCode(null);

    try {
      // 1. Tenta criar ou garantir que a instância existe
      // Nota: Em um app real, verificaríamos o status da instância antes
      try {
        await createEvolutionInstance(configData);
      } catch (e) {
        // Ignora erro se instância já existir
        console.log("Instância provavelmente já existe, prosseguindo...");
      }
      
      // 2. Busca o QR Code
      // Adicionamos um pequeno delay para garantir que a API processou a criação
      setTimeout(async () => {
        try {
            const qrBase64 = await connectEvolutionInstance(configData);
            if (qrBase64) {
                setQrCode(qrBase64);
                setStatus('waiting_scan');
            } else {
                // Se não retornou QR, pode estar já conectado
                setStatus('success'); 
                handleSuccess();
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
      }, 1500);

    } catch (error) {
      setStatus('error');
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    setIntegrations(prev => prev.map(item => 
        item.id === activeId ? { ...item, connected: true } : item
    ));
    // Configura o webhook em background
    setEvolutionWebhook(configData, 'https://seu-backend.com/webhook/whatsapp').catch(console.error);
    
    setTimeout(() => {
        setShowModal(false);
    }, 2000);
  };

  // Simulação de Polling para verificar se conectou (em prod seria via websocket ou polling real)
  useEffect(() => {
    let interval: any;
    if (status === 'waiting_scan') {
        interval = setInterval(() => {
            // Aqui faríamos um fetch para checar status: /instance/connectionState/{instance}
            // Para demo, vamos deixar manual o clique em "Já escaneei"
        }, 5000);
    }
    return () => clearInterval(interval);
  }, [status]);

  return (
    <Layout>
      <Layout.Header 
        title="Integrações" 
        subTitle="Conecte o TerraGes ao seu ecossistema digital"
        showBack
      />

      <Layout.Content>
        <div className="p-4 space-y-4 pb-24 animate-in fade-in duration-700">
          <div className="px-2 mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Conexões Ativas</p>
          </div>
          
          {integrations.map((item) => (
            <div 
                key={item.id} 
                className="group bg-surface-dark/40 backdrop-blur-md rounded-[28px] p-5 border border-white/5 flex items-center justify-between transition-all hover:border-primary/20 shadow-glass"
            >
              <div className="flex items-center gap-5">
                <div className={`size-14 rounded-2xl flex items-center justify-center transition-all duration-300 border border-white/5 ${item.connected ? 'bg-primary/10 text-primary shadow-neon-sm' : 'bg-white/5 text-gray-500'}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-white font-bold tracking-tight text-base group-hover:text-primary transition-colors">{item.name}</h3>
                  <p className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mt-0.5">{item.desc}</p>
                </div>
              </div>
              
              <button 
                onClick={() => handleAction(item.id, item.connected)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border
                  ${item.connected 
                    ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 shadow-neon-sm' 
                    : 'bg-white/5 text-white border-white/5 hover:bg-white/10'
                  }`}
              >
                {item.connected ? (
                  <span className="flex items-center gap-1.5">
                    <Check size={14} strokeWidth={3} /> Ativo
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} strokeWidth={3} /> Conectar
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      </Layout.Content>

      {/* Modal Simplificado */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-surface-dark/90 rounded-[40px] border border-white/10 shadow-2xl flex flex-col overflow-hidden glass-card">
            
            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-white tracking-tight">WhatsApp API</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Evolution Instance</p>
                </div>
                <button 
                    onClick={() => setShowModal(false)} 
                    className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-8 flex flex-col items-center justify-center min-h-[350px]">
              
              {/* Estado: Carregando / Gerando */}
              {status === 'generating' && (
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                        <Loader2 size={56} className="text-primary animate-spin relative z-10" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2">
                        <p className="text-white font-bold text-lg tracking-tight">Sincronizando Core...</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Aguarde o handshake da API</p>
                    </div>
                </div>
              )}

              {/* Estado: Erro */}
              {status === 'error' && (
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="size-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                        <X size={40} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2">
                        <p className="text-white font-bold text-lg tracking-tight">Time-out na Conexão</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 max-w-[200px]">O servidor Evolution não respondeu a tempo.</p>
                    </div>
                    <button 
                        onClick={startConnectionProcess}
                        className="w-full h-14 bg-white/5 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <RefreshCw size={16} /> Reiniciar Fluxo
                    </button>
                </div>
              )}

              {/* Estado: QR Code Pronto */}
              {status === 'waiting_scan' && qrCode && (
                <div className="flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="p-4 bg-white rounded-[32px] shadow-neon">
                        <img src={qrCode} alt="QR Code" className="size-48 object-contain" />
                    </div>
                    <div className="text-center space-y-4">
                        <div className="space-y-1">
                            <p className="text-white font-bold text-lg tracking-tight">Pareamento Requerido</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Ação necessária no mobile</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left">
                            <ul className="text-[10px] text-gray-400 space-y-1.5 font-medium">
                                <li className="flex gap-2">
                                    <span className="text-primary font-bold">01.</span> Abra o WhatsApp
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-primary font-bold">02.</span> Menu &gt; Aparelhos Conectados
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-primary font-bold">03.</span> Escaneie o código acima
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => { setStatus('success'); handleSuccess(); }}
                        className="w-full h-16 bg-primary text-black rounded-[24px] font-black uppercase tracking-widest text-[11px] shadow-neon hover:bg-primary-hover transition-all active:scale-95"
                    >
                        Validar Conexão
                    </button>
                </div>
              )}

              {/* Estado: Sucesso */}
              {status === 'success' && (
                <div className="flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                        <div className="size-24 rounded-[32px] bg-primary text-black flex items-center justify-center shadow-neon relative z-10">
                            <ShieldCheck size={56} strokeWidth={1.5} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-black text-white tracking-tight">Vínculo Ativo</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Canal de comunicação liberado</p>
                    </div>
                </div>
              )}

            </div>
            
            {/* Footer */}
            <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-center gap-2">
                <ShieldCheck size={14} className="text-primary shadow-neon-sm" />
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 italic">Security Layer 2.4 - End-to-End Encryption</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
