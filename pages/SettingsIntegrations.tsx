
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
    <Layout title="Integrações" showBack hideNav>
      <div className="p-4 space-y-4 pb-24">
        <p className="text-gray-400 text-sm mb-2">Gerencie as conexões do TerraGes com outras ferramentas.</p>
        
        {integrations.map((item) => (
          <div key={item.id} className="bg-surface-dark rounded-xl p-4 border border-white/5 flex items-center justify-between transition-all hover:border-white/10">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl transition-colors ${item.connected ? 'bg-primary/20 text-primary' : 'bg-gray-700 text-gray-400'}`}>
                {item.icon}
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{item.name}</h3>
                <p className="text-gray-500 text-xs">{item.desc}</p>
              </div>
            </div>
            
            <button 
              onClick={() => handleAction(item.id, item.connected)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95
                ${item.connected 
                  ? 'bg-positive/10 text-positive border border-positive/20 hover:bg-positive/20' 
                  : 'bg-white/10 text-white hover:bg-white/20'
                }`}
            >
              {item.connected ? (
                <>
                  <Check size={12} /> Conectado
                </>
              ) : (
                <>
                  <Plus size={12} /> Conectar
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Modal Simplificado */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-surface-dark rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="bg-[#4b3220] p-4 flex justify-between items-center">
                <div className="flex items-center gap-2 text-white">
                    <MessageCircle size={20} />
                    <span className="font-bold">Conectar WhatsApp</span>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
              
              {/* Estado: Carregando / Gerando */}
              {status === 'generating' && (
                <div className="flex flex-col items-center text-center space-y-4">
                    <Loader2 size={48} className="text-primary animate-spin" />
                    <div>
                        <p className="text-white font-medium">Iniciando Servidor...</p>
                        <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos.</p>
                    </div>
                </div>
              )}

              {/* Estado: Erro */}
              {status === 'error' && (
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="size-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                        <X size={32} />
                    </div>
                    <div>
                        <p className="text-white font-medium">Falha na Conexão</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-[200px]">Não foi possível gerar o QR Code. O servidor pode estar indisponível.</p>
                    </div>
                    <button 
                        onClick={startConnectionProcess}
                        className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/20"
                    >
                        <RefreshCw size={16} /> Tentar Novamente
                    </button>
                </div>
              )}

              {/* Estado: QR Code Pronto */}
              {status === 'waiting_scan' && qrCode && (
                <div className="flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
                    <div className="bg-white p-3 rounded-xl shadow-lg">
                        <img src={qrCode} alt="QR Code" className="size-48 object-contain" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-sm text-white font-medium">Escaneie com seu WhatsApp</p>
                        <ol className="text-xs text-gray-400 text-left space-y-1 list-decimal pl-4">
                            <li>Abra o WhatsApp no seu celular</li>
                            <li>Toque em Menu ou Configurações</li>
                            <li>Selecione Aparelhos Conectados</li>
                            <li>Toque em Conectar um aparelho</li>
                        </ol>
                    </div>
                    
                    {/* Botão de simulação de sucesso para a demo */}
                    <button 
                        onClick={() => { setStatus('success'); handleSuccess(); }}
                        className="w-full bg-positive text-black py-3 rounded-xl font-bold mt-2 shadow-lg shadow-positive/20 hover:bg-positive/90 transition-colors"
                    >
                        Já Escaneei
                    </button>
                </div>
              )}

              {/* Estado: Sucesso */}
              {status === 'success' && (
                <div className="flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-300">
                    <div className="size-20 rounded-full bg-positive/20 flex items-center justify-center text-positive">
                        <ShieldCheck size={40} />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-white">Conectado!</p>
                        <p className="text-sm text-gray-400 mt-1">Seu WhatsApp foi vinculado com sucesso.</p>
                    </div>
                </div>
              )}

            </div>
            
            {/* Footer com info de segurança */}
            <div className="p-3 bg-white/5 border-t border-white/5 flex items-center justify-center gap-2">
                <Smartphone size={14} className="text-gray-500" />
                <p className="text-[10px] text-gray-500">Conexão criptografada ponta-a-ponta</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
