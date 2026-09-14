import { IntakeError, MAX_WEBHOOK_BYTES, readLimited, equalSecret, parseMessage } from './whatsapp-validation.ts';

import {processWhatsAppJob} from './whatsapp-processor.ts';

type Dependencies = { db: any; env: (key: string) => string | undefined; fetcher?: typeof fetch; schedule?:(task:Promise<unknown>)=>void };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createWhatsAppHandler({db,env,fetcher = fetch,schedule}: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({error:'method_not_allowed'},405);
    try {
      const secret = env('WA_WEBHOOK_SECRET');
      // No fallback to a global provider or Supabase key. Missing setup fails closed.
      if (!secret || secret.length < 32 || !env('EVOLUTION_INSTANCE')) return json({error:'secure_webhook_configuration_required'},503);
      if (!await equalSecret(req.headers.get('x-webhook-secret') ?? '', secret)) return json({error:'unauthorized'},401);
      let payload: any;
      try { payload = JSON.parse(new TextDecoder().decode(await readLimited(req,MAX_WEBHOOK_BYTES))); }
      catch(e) { if (e instanceof IntakeError) throw e; throw new IntakeError('invalid_json'); }
      const input = parseMessage(payload,env('EVOLUTION_INSTANCE')!);
      if (!input) return json({status:'ignored'});
      const pairing = input.kind === 'text' && /^VINCULAR ([a-f0-9]{32})$/i.exec(input.text.trim());
      if (pairing) {
        const {data,error} = await db.rpc('verify_whatsapp_pairing',{p_instance:input.instance,p_phone:input.phone,p_token:pairing[1].toLowerCase()});
        if (error) throw new IntakeError('pairing_unavailable',503);
        return json({status:data ? 'paired' : 'pairing_rejected'},data ? 200 : 403);
      }
      const identity = await db.rpc('resolve_whatsapp_identity',{p_instance:input.instance,p_phone:input.phone});
      if (identity.error) throw new IntakeError('identity_unavailable',503);
      if (identity.data?.length !== 1) return json({error:'verified_account_required'},403);
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
