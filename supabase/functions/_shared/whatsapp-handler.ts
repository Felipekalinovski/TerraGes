import {activateAuthorizedOperator} from './whatsapp-team.ts';
import {deliverWhatsAppGuidance,onboardingMessage,supportMessage,isWhatsAppSupportRequest} from './whatsapp-guidance.ts';
import { IntakeError, MAX_WEBHOOK_BYTES, readLimited, equalSecret, parseMessage } from './whatsapp-validation.ts';

import {processWhatsAppJob} from './whatsapp-processor.ts';

type Dependencies = { db: any; env: (key: string) => string | undefined; fetcher?: typeof fetch; schedule?:(task:Promise<unknown>)=>void };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createWhatsAppHandler({db,env,fetcher = fetch,schedule}: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({error:'method_not_allowed'},405);
    try {
      const apiKey = env('EVOLUTION_API_KEY');
      if (!apiKey || !env('EVOLUTION_INSTANCE')) return json({error:'evolution_configuration_required'},503);
      let payload: any;
      try { payload = JSON.parse(new TextDecoder().decode(await readLimited(req,MAX_WEBHOOK_BYTES))); }
      catch(e) { if (e instanceof IntakeError) throw e; throw new IntakeError('invalid_json'); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new IntakeError('invalid_envelope');
      // Evolution API includes apikey; Evolution Go includes instanceToken.
      // Credentials are checked before identity resolution and never queued or logged.
      const credential = req.headers.get('apikey') ?? payload.apikey ?? payload.instanceToken;
      if (typeof credential !== 'string' || !await equalSecret(credential,apiKey)) return json({error:'unauthorized'},401);
      const input = parseMessage(payload,env('EVOLUTION_INSTANCE')!);
      if (!input) return json({status:'ignored'});
      const pairing = input.kind === 'text' && /^VINCULAR ([a-f0-9]{32})$/i.exec(input.text.trim());
      if (pairing) {
        const {data,error} = await db.rpc('verify_whatsapp_pairing',{p_instance:input.instance,p_phone:input.phone,p_token:pairing[1].toLowerCase()});
        if (error) throw new IntakeError('pairing_unavailable',503);
        const delivery=await deliverWhatsAppGuidance({db,env,fetcher,input,kind:data?'paired':'support',text:data?'✅ WhatsApp vinculado com sucesso! Envie AJUDA para ver o guia conforme seu perfil. Você pode enviar texto, áudio, fotos e documentos; confira a prévia antes de confirmar um registro.': 'Não consegui validar esse vínculo. O código pode estar inválido ou expirado. Peça um novo código ao gestor ou gere outro pela sua conta. Não envie sua senha.'});
        return json({status:data ? 'paired' : 'pairing_rejected',delivery},200);
      }
      let identity = await db.rpc('resolve_whatsapp_identity',{p_instance:input.instance,p_phone:input.phone});
      if (identity.error) throw new IntakeError('identity_unavailable',503);
      if (identity.data?.length !== 1 && await activateAuthorizedOperator(db,input)) {
        const delivery=await deliverWhatsAppGuidance({db,env,fetcher,input,kind:'paired',text:'✅ Seu acesso de operador foi ativado na empresa que seu gestor autorizou. Não precisa criar senha nem copiar código. Envie por texto ou áudio os dados do serviço: máquina, data, cliente e horas. Vou ajudar a completar e pedir sua confirmação antes de registrar.'});
        if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite)[.!?]*$/i.test(input.text.trim())) return json({status:'operator_activated',delivery},200);
        identity=await db.rpc('resolve_whatsapp_identity',{p_instance:input.instance,p_phone:input.phone});
        if(identity.error)throw new IntakeError('identity_unavailable',503);
      }
      if (identity.data?.length !== 1) {
 const greeting=/^(oi|ol[aá]|bom dia|boa tarde|boa noite)[.!?]*$/i.test(input.text.trim());
 const help=(!greeting&&isWhatsAppSupportRequest(input.text))||/^(cadastro|vincular)[.!?]*$/i.test(input.text.trim());
 const delivery=await deliverWhatsAppGuidance({db,env,fetcher,input,kind:help?'support':'onboarding',text:help?'Este número ainda precisa ser vinculado antes de acessar dados ou registrar informações.\n\n'+supportMessage(input.text):onboardingMessage()});
 return json({status:'onboarding',delivery},202);
}
      const queued=await db.rpc('enqueue_whatsapp_event',{p_input:input});
      if(queued.error)throw new IntakeError('intake_unavailable',503);
      const id=queued.data?.id;
      if(id) {
        const task=processWhatsAppJob({db,env,fetcher},id);
        if(schedule)schedule(task.catch(()=>undefined));else await task;
      }
      return json({status:queued.data?.duplicate?'duplicate':'received',id},202);
    } catch(e) {
      return json({error:e instanceof IntakeError?e.message:'intake_failed'},e instanceof IntakeError?e.status:500);
    }
  };
}
