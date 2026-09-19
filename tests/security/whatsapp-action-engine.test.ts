import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildActionPreview,handleTerragesActionTurn,isTerragesActionCandidate,mergeActionSlots,nextMissingActionField,sanitizeActionSlots} from '../../supabase/functions/_shared/whatsapp-action-engine.ts';

test('action intent is limited to explicit TerraGes write requests',()=>{
  assert.equal(isTerragesActionCandidate('Registre um RDO da escavação de hoje'),true);
  assert.equal(isTerragesActionCandidate('Atualize o horímetro da escavadeira para 1320'),true);
  assert.equal(isTerragesActionCandidate('Quanto custa uma escavadeira?'),false);
});

test('untrusted extraction cannot inject ownership or database identifiers',()=>{
  const slots=sanitizeActionSlots({description:' Diesel ',amount:'250,50',machine_id:'a2000000-0000-4000-8000-000000000001',company_id:'foreign',user_id:'foreign'});
  assert.deepEqual(slots,{description:'Diesel',amount:250.5});
  assert.equal('company_id' in slots,false);assert.equal('machine_id' in slots,false);
});

test('changing a machine name invalidates the previously trusted resolution',()=>{
  const merged=mergeActionSlots({machine_query:'CAT 320',machine_id:'a2000000-0000-4000-8000-000000000001',machine_name:'CAT 320',current_meter_hours:100},{machine_query:'Komatsu'});
  assert.equal(merged.machine_id,undefined);assert.equal(merged.machine_name,undefined);assert.equal(merged.current_meter_hours,undefined);
});

test('required fields and confirmation preview are deterministic',()=>{
  assert.equal(nextMissingActionField('create_expense',{date:'2026-09-19',description:'Diesel'}),'amount');
  assert.match(buildActionPreview('update_machine_meter',{machine_name:'CAT 320',current_meter_hours:100,meter_hours:108}),/100 h/);
});

test('complete RDO request resolves only a permitted machine and asks confirmation',async()=>{
  const calls:any[]=[];let sent=0,savedText='';
  const db={rpc:async(name:string,args:any)=>{
    calls.push({name,args});
    if(name==='get_whatsapp_action_context')return {data:{phone:'5541999999999',role:'admin',session:null},error:null};
    if(name==='resolve_whatsapp_action_machine')return {data:{status:'resolved',machine:{id:'a2000000-0000-4000-8000-000000000001',name:'CAT 320',hours:100}},error:null};
    if(name==='prepare_whatsapp_action')return {data:{state:'awaiting_confirmation'},error:null};
    if(name==='save_whatsapp_action_response'){savedText=args.p_response_text;return {data:{delivery_state:'planned',phone:'5541999999999'},error:null};}
    if(name==='claim_whatsapp_agent_outbound')return {data:{delivery_state:'sending',response_text:savedText},error:null};
    return {data:true,error:null};
  }};
  const fetcher=async(url:any)=>{
    if(String(url).includes('openrouter'))return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({intent:'create_rdo',slots:{date:'2026-09-19',description:'Escavação da vala',machine_query:'CAT 320',company_id:'foreign'}})}}]}));
    sent++;return new Response(JSON.stringify({key:{id:'provider-1'}}));
  };
  const result=await handleTerragesActionTurn({db,env:key=>key==='EVOLUTION_API_URL'?'https://evolution.example':key.endsWith('_KEY')?'secret':'model',fetcher:fetcher as any,event:{id:'event-1'},text:'Registre o RDO de hoje da CAT 320: escavação da vala'});
  assert.deepEqual(result,{handled:true,delivery:'sent'});assert.equal(sent,1);
  const prepare=calls.find(call=>call.name==='prepare_whatsapp_action');assert.equal(prepare.args.p_ready,true);assert.equal(prepare.args.p_slots.company_id,undefined);assert.match(savedText,/CONFIRMAR/);
});

test('explicit confirmation executes the prepared action without another AI call',async()=>{
  let fetches=0,savedText='';
  const slots={date:'2026-09-19',description:'Escavação',machine_id:'a2000000-0000-4000-8000-000000000001',machine_name:'CAT 320'};
  const db={rpc:async(name:string,args:any)=>{
    if(name==='get_whatsapp_action_context')return {data:{phone:'5541999999999',role:'admin',session:{action_type:'create_rdo',state:'awaiting_confirmation',slots}},error:null};
    if(name==='confirm_whatsapp_action')return {data:{action_type:'create_rdo',record_id:'record-1',slots},error:null};
    if(name==='save_whatsapp_action_response'){savedText=args.p_response_text;return {data:{delivery_state:'planned',phone:'5541999999999'},error:null};}
    if(name==='claim_whatsapp_agent_outbound')return {data:{delivery_state:'sending',response_text:savedText},error:null};
    return {data:true,error:null};
  }};
  const result=await handleTerragesActionTurn({db,env:key=>key==='EVOLUTION_API_URL'?'https://evolution.example':'secret',fetcher:(async()=>{fetches++;return new Response('{}');}) as any,event:{id:'event-2'},text:'CONFIRMAR'});
  assert.deepEqual(result,{handled:true,delivery:'sent'});assert.equal(fetches,1);assert.match(savedText,/RDO registrado/);
});
