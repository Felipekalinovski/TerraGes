import { createClient } from 'npm:@supabase/supabase-js@2.86.0';
import {readLimited} from '../_shared/whatsapp-validation.ts';
const cors = {'Access-Control-Allow-Origin':'https://terrages.com.br','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  try {
    const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
    if(!token)return reply({error:'authentication_required'},401);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const {data:{user},error}=await db.auth.getUser(token);
    if(error||!user)return reply({error:'authentication_required'},401);
    const {data:company,error:tenantError}=await db.from('company_info').select('id').limit(1);
    if(tenantError||company?.length!==1)return reply({error:'tenant_membership_required'},403);
    const body=JSON.parse(new TextDecoder().decode(await readLimited(req,2*1024*1024)));
    if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>40)return reply({error:'invalid_messages'},400);
    const model=Deno.env.get(body.type==='vision'?'AI_MODEL_VISION':'AI_MODEL_TEXT');
    const apiKey=Deno.env.get('OPENROUTER_API_KEY');
    if(!apiKey||!model)return reply({error:'model_not_configured'},503);
    const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(50000),
      body:JSON.stringify({model,messages:body.messages,max_tokens:3000})
    });
    if(!response.ok)return reply({error:'ai_provider_unavailable'},502);
    const data=JSON.parse(new TextDecoder().decode(await readLimited(response,256000)));
    return reply({content:data.choices?.[0]?.message?.content??''});
  } catch { return reply({error:'request_failed'},400); }
});
