import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingQuotePrompt,handleWhatsAppAgentTurn,isEarthworkQuoteCandidate,mergeQuoteSlots,nextMissingQuoteField,sanitizeQuoteSlots,
} from '../../supabase/functions/_shared/whatsapp-agent-orchestrator.ts';

test('quote intent detection stays scoped to earthwork estimates',()=>{
  assert.equal(isEarthworkQuoteCandidate('Quanto cobrar para tirar 10 metros de argila por 5 e 2 de profundidade?'),true);
  assert.equal(isEarthworkQuoteCandidate('Bom dia, consegue cadastrar meu abastecimento?'),false);
});

test('slot sanitation only accepts allowlisted, bounded quote data',()=>{
  const result=sanitizeQuoteSlots({length_m:'10,5',depth_m:-2,material_key:'argila',equipment_name:' Escavadeira ',company_id:'other',hourly_rate:450});
  assert.deepEqual(result,{length_m:10.5,hourly_rate:450,material_key:'argila',equipment_name:'Escavadeira'});
  assert.equal('company_id' in result,false);
});

test('missing data is requested one objective field at a time',()=>{
  const slots=mergeQuoteSlots({length_m:10},{width_m:5});
  assert.equal(nextMissingQuoteField(slots),'depth_m');
  assert.match(buildMissingQuotePrompt(slots),/profundidade média/);
});

test('complete quote sends deterministic summary once and persists no business record',async()=>{
  const calls:any[]=[];let outbound=0;
  const db={rpc:async(name:string,args:any)=>{
    calls.push({name,args});
    if(name==='get_whatsapp_agent_context')return {data:{phone:'5541999999999',session:null},error:null};
    if(name==='save_whatsapp_agent_turn')return {data:{delivery_state:'planned'},error:null};
    if(name==='claim_whatsapp_agent_outbound')return {data:{delivery_state:'sending',response_text:calls.at(-2).args.p_response_text},error:null};
    return {data:true,error:null};
  }};
  const fetcher=async(url:any)=>{
    if(String(url).includes('openrouter'))return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({intent:'earthwork_quote',slots:{length_m:10,width_m:5,depth_m:2,material_key:'argila',truck_capacity_m3:12,equipment_name:'Escavadeira hidráulica',productivity_m3_per_hour:30,hourly_rate:450,cost_per_truckload:100}})}}]}));
    outbound++;return new Response(JSON.stringify({key:{id:'provider-1'}}));
  };
  const result=await handleWhatsAppAgentTurn({db,env:key=>key==='EVOLUTION_API_URL'?'https://evolution.example':key.endsWith('_KEY')?'secret':'model',fetcher:fetcher as any,event:{id:'event-1'},input:{},text:'Faça um orçamento de 10 por 5 por 2 de argila'});
  assert.deepEqual(result,{handled:true,delivery:'sent'});assert.equal(outbound,1);
  const save=calls.find(call=>call.name==='save_whatsapp_agent_turn');
  assert.match(save.args.p_response_text,/Volume no corte: 100 m³/);assert.match(save.args.p_response_text,/Nenhum orçamento foi salvo automaticamente/);
  assert.match(save.args.p_response_text,/Premissas padrão/);
  assert.equal(calls.some(call=>/orcamento|quote/i.test(call.name)&&call.name!=='save_whatsapp_agent_turn'),false);
});

test('a previously sent turn is never sent again',async()=>{
  let requests=0;
  const db={rpc:async(name:string)=>name==='get_whatsapp_agent_context'
    ?{data:{phone:'5541999999999',session:{status:'active',slots:{length_m:10}}},error:null}
    :name==='save_whatsapp_agent_turn'?{data:{delivery_state:'sent'},error:null}:{data:true,error:null}};
  const fetcher=async()=>{requests++;return new Response(JSON.stringify({choices:[{message:{content:'{"intent":"earthwork_quote","slots":{"width_m":5}}'}}]}));};
  const result=await handleWhatsAppAgentTurn({db,env:key=>key==='OPENROUTER_API_KEY'?'secret':'model',fetcher:fetcher as any,event:{id:'same-event'},input:{},text:'5 metros'});
  assert.deepEqual(result,{handled:true,delivery:'already_sent'});assert.equal(requests,1);
});
