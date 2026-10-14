import {sendEvolutionText} from './evolution-client.ts';
import {IntakeError} from './whatsapp-validation.ts';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function isWhatsAppSupportRequest(text:string){
 const v=normalize(text);
 if(/^(oi|ola|bom dia|boa tarde|boa noite)[.!?]*$/.test(v))return true;
 return /^(ajuda|menu|suporte|tutorial|como usar|como funciona|primeiros passos|comecar|começar|quero ajuda)(\b|[.!?])/.test(v)
 || /^(nao entendi|o que posso fazer|o que voce faz|quais comandos|quais funcionalidades)(\b|[.!?])/.test(v)
 || /^(como|onde|preciso de ajuda|me explique|me explica).*(?:usar|funciona|vincular|cadastr|registrar|confirmar|cancelar|enviar audio|enviar foto|permissoes)/.test(v);
}
export function onboardingMessage(){return 'Olá! 👋 Sou o assistente TerraGes.\n\nÉ operador? Peça ao gestor para enviar CADASTRAR OPERADOR aqui e informar seu nome e WhatsApp. Depois, envie um oi deste número para ativar seu acesso. Sem senha nem código.\n\nÉ gestor? Crie sua conta em https://terrages.com.br/signup e conecte seu WhatsApp em Mais → WhatsApp. A partir daí, você pode liberar sua equipe por esta conversa.\n\nApós a liberação, envie os dados do serviço por texto, áudio ou foto. Eu ajudo a completar e peço confirmação antes de registrar.';}
export function supportMessage(text:string,operator=false){
 const v=normalize(text);
 if(/vincul|cadastr|conta|acesso|senha/.test(v))return 'Operador: peça ao gestor para enviar CADASTRAR OPERADOR e informar seu nome e WhatsApp. Depois, envie um oi deste número para ativar o acesso na empresa dele. Sem senha nem código. Gestor: conecte primeiro seu WhatsApp em https://terrages.com.br/settings/whatsapp. Você também pode liberar ou bloquear operadores em Mais → Equipe → Acessos pelo WhatsApp.';
 if(/audio|foto|imagem|document|arquivo/.test(v))return 'Você pode enviar texto, áudio, foto e documentos (PDF, TXT ou CSV, até 10 MB). Diga o objetivo, por exemplo: “Registrar os dados deste serviço”. Envie imagens legíveis e informe a máquina e a data. Confira os dados extraídos antes de confirmar; arquivos ilegíveis precisam ser reenviados.';
 if(/confirm|cancel|registr|servico|rdo|horimetro/.test(v))return 'Para registrar, diga o tipo de registro, a máquina e a data. Exemplo: “Registrar serviço de hoje da retro 420, cliente João, horímetro inicial 100 e final 110”. Vou perguntar o que faltar e mostrar uma prévia. Envie CONFIRMAR somente após conferir ou CANCELAR para abandonar o registro. Horas trabalhadas são diferentes da leitura total do horímetro.';
 if(/orcamento|volume|calculo/.test(v))return operator?'Os cálculos de orçamento e consultas são destinados ao gestor ou administrador. Como operador, você pode enviar os dados do serviço para revisão do gestor.':'Para calcular terraplanagem, envie comprimento × largura × profundidade em metros, material e capacidade do caminhão. Exemplo: “Calcular corte de terra: 100 x 30 x 2 metros, argila, caminhão 12 m³”. Depois informe equipamento, produtividade e custos. A estimativa não vira orçamento salvo automaticamente.';
 return '📚 Como usar o TerraGes\n\n• Registros: informe máquina, data, cliente e os dados do serviço. Confira a prévia e responda CONFIRMAR ou CANCELAR.\n• Entradas: texto, áudio, foto ou documento legível.\n'+(operator?'• Seu perfil de operador permite enviar registros; consultas e dados financeiros são restritos ao gestor.\n':'• Equipe: envie CADASTRAR OPERADOR para liberar nome e WhatsApp na sua empresa.\n• Consultas: “Quais máquinas estão cadastradas?” ou “Faturamento desse mês”.\n• Orçamentos: envie medidas, material, caminhão e custos.\n')+'\nPara uma orientação específica, envie “Ajuda para registrar”, “Ajuda com áudio”, “Ajuda com orçamento” ou “Ajuda para vincular”. Este suporte explica o funcionamento; não abre chamado humano.';
}
export async function deliverWhatsAppGuidance({db,env,fetcher=fetch,input,kind,text}:{db:any;env:(k:string)=>string|undefined;fetcher?:typeof fetch;input:any;kind:string;text:string}){
 const params={p_instance:input.instance,p_phone:input.phone,p_message_id:input.id};
 const claim=await db.rpc('claim_whatsapp_guidance',{...params,p_kind:kind});
 if(claim.error)throw new IntakeError('guidance_unavailable',503);
 if(!claim.data)return 'skipped';
 let sent=false;
 try{await sendEvolutionText(input.phone,text,k=>k==='EVOLUTION_PROVIDER'?input.provider:env(k),fetcher);sent=true;}
 catch{/* Sending may have succeeded despite a timeout. Do not send it again blindly. */}
 const finished=await db.rpc('finish_whatsapp_guidance',{...params,p_sent:sent});
 if(finished.error)throw new IntakeError('guidance_checkpoint_failed',503);
 return sent?'sent':'uncertain';
}