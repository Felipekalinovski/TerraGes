import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processWhatsAppJob} from '../../supabase/functions/_shared/whatsapp-processor.ts';
import {createWorkerHandler} from '../../supabase/functions/_shared/whatsapp-worker-handler.ts';
const event={id:'a5000000-0000-4000-8000-000000000001',company_id:'company-a',user_id:'user-a'};
function processor(kind='text',extra:any={}){
 const calls:any[]=[];let downloads=0,uploads=0;
 const db={rpc:async(name:string,args:any)=>{calls.push({name,args});return {data:name==='claim_whatsapp_job'?{event:{...event,...extra},input:{kind,text:'Texto sintético',mime:'audio/ogg'},token:'lease'}:true};},storage:{from:()=>({download:async()=>{downloads++;return {data:new Blob(['OggS synthetic'])}},upload:async()=>{uploads++;return {error:null}}})}};
 return {db,calls,downloads:()=>downloads,uploads:()=>uploads};
}
test('persisted audio resumes without redownloading from WhatsApp or uploading again',async()=>{
 const s=processor('audio',{media_path:`company-a/user-a/${event.id}-old.ogg`,media_mime:'audio/ogg'});const urls:string[]=[];
 const result=await processWhatsAppJob({db:s.db,env:key=>key==='GROQ_API_KEY'?'test-key':undefined,fetcher:async(url)=>{urls.push(String(url));return new Response('Operação de teste');}});
 assert.equal(result.status,'needs_review');assert.equal(s.downloads(),1);assert.equal(s.uploads(),0);assert.deepEqual(urls,['https://api.groq.com/openai/v1/audio/transcriptions']);assert.equal(s.calls.at(-1).args.p_text,'Operação de teste');
});
test('transient provider failure schedules retry without raw error leakage',async()=>{
 const s=processor('audio');const result=await processWhatsAppJob({db:s.db,env:()=>undefined});assert.equal(result.status,'retry_scheduled');assert.equal(s.calls.at(-1).args.p_retryable,true);assert.equal(s.calls.at(-1).args.p_error,'media_provider_not_configured');
});
test('foreign storage checkpoint is refused before any download',async()=>{
 const s=processor('audio',{media_path:'company-b/user-b/secret.ogg'});const result=await processWhatsAppJob({db:s.db,env:()=>undefined});assert.equal(result.status,'rejected');assert.equal(s.downloads(),0);assert.equal(s.calls.at(-1).args.p_retryable,false);
});
test('worker rejects missing auth, wrong internal secret and invalid user session before processing',async()=>{
 for(const headers of [{},{'x-worker-secret':'x'.repeat(64)},{authorization:'Bearer bad'}]){
  const scheduled:any[]=[];const calls:string[]=[];
  const handler=createWorkerHandler({db:{rpc:async(name:string)=>{calls.push(name);return {data:false}}},env:()=>undefined,userClient:()=>({auth:{getUser:async()=>({error:true,data:{user:null}})}}),schedule:p=>scheduled.push(p)});
  const response=await handler(new Request('https://test.invalid',{method:'POST',headers,body:'{}'}));assert.equal(response.status,401);assert.equal(scheduled.length,0);assert.equal(calls.includes('claim_whatsapp_job'),false);
 }
});
test('worker never trusts an event ID without the authenticated tenant RPC',async()=>{
 let scheduled=0;const handler=createWorkerHandler({db:{rpc:()=>{throw Error('must not claim')}},env:()=>undefined,userClient:()=>({auth:{getUser:async()=>({data:{user:{id:'a'}}})},rpc:async(name:string)=>{assert.equal(name,'retry_whatsapp_event');return {error:{message:'access_denied'}}}}),schedule:()=>{scheduled++}});
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({event_id:event.id})}));assert.equal(response.status,409);assert.equal(scheduled,0);
});
test('worker acknowledges an authorized retry and processes only that event',async()=>{
 const s=processor();const pending:Promise<unknown>[]=[];
 const handler=createWorkerHandler({db:s.db,env:()=>undefined,userClient:()=>({auth:{getUser:async()=>({data:{user:{id:'a'}}})},rpc:async()=>({data:event.id})}),schedule:p=>pending.push(p)});
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({event_id:event.id})}));assert.equal(response.status,202);await Promise.all(pending);assert.equal(s.calls[0].args.p_event_id,event.id);
});
