import {IntakeError,readLimited} from './whatsapp-validation.ts';
import {processWhatsAppJob} from './whatsapp-processor.ts';
import type {Dependencies} from './whatsapp-processor.ts';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
export function createWorkerHandler(deps:Dependencies & {userClient:(token:string)=>any;schedule:(p:Promise<unknown>)=>void}) {
 return async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  try {
   let eventId:string|undefined;
   const secret=req.headers.get('x-worker-secret');
   if(secret) {
    if(secret.length!==64)return json({error:'unauthorized'},401);
    const verified=await deps.db.rpc('verify_whatsapp_worker',{p_secret:secret});
    if(verified.error || verified.data!==true)return json({error:'unauthorized'},401);
   } else {
    const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
    if(!token)return json({error:'unauthorized'},401);
    const client=deps.userClient(token);
    const user=await client.auth.getUser(token);
    if(user.error || !user.data.user)return json({error:'unauthorized'},401);
    const body=JSON.parse(new TextDecoder().decode(await readLimited(req,2048)));
    if(typeof body.event_id!=='string' || !/^[0-9a-f-]{36}$/i.test(body.event_id))return json({error:'invalid_event'},400);
    // The authenticated RPC checks the tenant, owner/manager, lease and backoff first.
    const allowed=await client.rpc('retry_whatsapp_event',{p_event_id:body.event_id});
    if(allowed.error)return json({error:'retry_unavailable'},409);
    eventId=allowed.data;
   }
   // One job per wake-up keeps worst-case inference within the Edge runtime budget.
   deps.schedule(processWhatsAppJob(deps,eventId).catch(()=>undefined));
   return json({status:'queued'},202);
  } catch(e) {return json({error:e instanceof IntakeError?e.message:'request_failed'},e instanceof IntakeError?e.status:500);}
 };
}
