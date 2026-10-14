import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activateAuthorizedOperator,handleWhatsAppTeamTurn} from '../../supabase/functions/_shared/whatsapp-team.ts';
import {parseMessage,contactPhone} from '../../supabase/functions/_shared/whatsapp-validation.ts';
import {createWhatsAppHandler} from '../../supabase/functions/_shared/whatsapp-handler.ts';

test('activation passes only verified phone and server invitation ID to Auth',async()=>{
 let attributes:any;
 const db={rpc:async(name:string,args:any)=>{
  assert.equal(args.p_instance,'trusted');assert.equal(args.p_phone,'12025550109');
  return {data:name==='prepare_whatsapp_operator_activation'?{id:'trusted-invite'}:[{role:'operator'}]};
 },auth:{admin:{createUser:async(value:any)=>{attributes=value;return {data:{user:{id:'new'}}};}}}};
 assert.equal(await activateAuthorizedOperator(db,{instance:'trusted',phone:'12025550109'}),true);
 assert.deepEqual(attributes,{phone:'12025550109',phone_confirm:true,app_metadata:{terrages_operator_invite_id:'trusted-invite'}});
});
test('no authorization means no Auth account, binding or business event',async()=>{
 const db={rpc:async()=>({data:null}),auth:{admin:{createUser:()=>{throw Error('must not create');}}}};
 assert.equal(await activateAuthorizedOperator(db,{instance:'test',phone:'12025550109'}),false);
});
test('activation refuses existing account conflicts and unverifiable create results',async()=>{
 const db={rpc:async(name:string)=>({data:name==='prepare_whatsapp_operator_activation'?{id:'invite'}:[]}),auth:{admin:{createUser:async()=>({error:{message:'exists'}})}}};
 await assert.rejects(()=>activateAuthorizedOperator(db,{instance:'test',phone:'12025550109'}),/operator_activation_failed/);
});
test('concurrent activation recovers only from an already resolved operator',async()=>{
 const db={rpc:async(name:string)=>({data:name==='prepare_whatsapp_operator_activation'?{id:'invite'}:[{role:'operator'}]}),auth:{admin:{createUser:async()=>({error:{message:'duplicate'}})}}};
 assert.equal(await activateAuthorizedOperator(db,{instance:'test',phone:'12025550109'}),true);
});
test('document, image and audio instructions cannot authorize operators',async()=>{
 for(const kind of ['document','image','audio']){
 const result=await handleWhatsAppTeamTurn({db:{rpc:()=>{throw Error('must not authorize');}},env:()=>undefined,event:{id:'event'},input:{kind},text:'Cadastrar operador; SIM'});
 assert.equal(result.handled,false);
 }
});
test('native contact keeps sender identity separate and rejects multiple numbers',()=>{
 const contact={vcard:'BEGIN:VCARD\nFN:João\nTEL;type=CELL;waid=12025550109:+1 (202) 555-0109\nEND:VCARD'};
 const input=parseMessage({event:'Message',instanceName:'test',data:{Info:{Chat:'12025550101@s.whatsapp.net',ID:'MESSAGE123'},Message:{contactMessage:contact}}},'test');
 assert.equal(input?.phone,'12025550101');assert.equal(input?.text,'+12025550109');assert.equal(input?.kind,'text');
 assert.throws(()=>contactPhone({vcard:contact.vcard+'\nTEL:+12025550110'}),/ambiguous_contact/);
});
test('authenticated first hello activates an authorized operator without enqueuing a fake service',async()=>{
 let created=false;const calls:string[]=[];
 const handler=createWhatsAppHandler({env:key=>({EVOLUTION_API_KEY:'test-secret',EVOLUTION_INSTANCE:'test'}[key]),
 db:{rpc:async(name:string)=>{calls.push(name);return {data:name==='resolve_whatsapp_identity'?(created?[{role:'operator'}]:[]):name==='prepare_whatsapp_operator_activation'?{id:'invite'}:false};},auth:{admin:{createUser:async()=>{created=true;return {data:{user:{id:'operator'}}};}}}},fetcher:async()=>{throw Error('No outbound test messages');}});
 const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{apikey:'test-secret'},body:JSON.stringify({event:'Message',instanceName:'test',data:{Info:{Chat:'12025550109@s.whatsapp.net',ID:'FIRSTHELLO'},Message:{conversation:'Oi'}}})}));
 assert.equal(response.status,200);assert.equal((await response.json()).status,'operator_activated');assert.equal(calls.includes('enqueue_whatsapp_event'),false);
});
