import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatQueryResponse,handleTerragesQueryTurn,isTerragesQueryCandidate} from '../../supabase/functions/_shared/whatsapp-query-engine.ts';

test('query intent requires an operational subject and a read request',()=>{
 assert.equal(isTerragesQueryCandidate('Quais máquinas estão disponíveis?'),true);
 assert.equal(isTerragesQueryCandidate('Mostre as OS abertas'),true);
 assert.equal(isTerragesQueryCandidate('Registre uma despesa de diesel'),false);
 assert.equal(isTerragesQueryCandidate('Olá, tudo bem?'),false);
});

test('query response exposes a concise allowlisted machine view',()=>{
 const response=formatQueryResponse({query_type:'machine_status',rows:[{name:'CAT 320',type:'Escavadeira',status:'Operando',hours:1320,next_maintenance:'2026-10-01',health_status:'Bom'}]});
 assert.match(response,/CAT 320/);assert.match(response,/1320 h/);assert.doesNotMatch(response,/company_id|user_id/i);
});

test('financial query goes through the scoped database RPC and is delivered once',async()=>{
 let saved='';const calls:any[]=[];
 const db={rpc:async(name:string,args:any)=>{calls.push({name,args});
  if(name==='run_whatsapp_operational_query')return {data:{query_type:'financial_summary',start_date:'2026-08-20',end_date:'2026-09-19',rows:{income:1000,expenses:200,balance:800,pending:50}},error:null};
  if(name==='save_whatsapp_query_response'){saved=args.p_response_text;return {data:{delivery_state:'planned',phone:'5541999999999'},error:null};}
  if(name==='claim_whatsapp_agent_outbound')return {data:{delivery_state:'sending',response_text:saved},error:null};
  return {data:true,error:null};
 }};
 const fetcher=async(url:any)=>String(url).includes('openrouter')?new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({intent:'financial_summary',limit:999,company_id:'foreign'})}}]})):new Response(JSON.stringify({key:{id:'provider-1'}}));
 const result=await handleTerragesQueryTurn({db,env:key=>key==='EVOLUTION_API_URL'?'https://evolution.example':key==='AI_MODEL_TEXT'?'model':'secret',fetcher:fetcher as any,event:{id:'event-1'},text:'Qual é o resumo financeiro?'});
 assert.deepEqual(result,{handled:true,delivery:'sent'});
 const query=calls.find(x=>x.name==='run_whatsapp_operational_query');assert.equal(query.args.p_limit,10);assert.equal('company_id' in query.args,false);assert.match(saved,/Saldo/);
});
