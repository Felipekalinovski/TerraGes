import {handleTerragesActionTurn,isTerragesActionCandidate} from './whatsapp-action-engine.ts';
import {handleWhatsAppAgentTurn,isEarthworkQuoteCandidate} from './whatsapp-agent-orchestrator.ts';
import {handleTerragesQueryTurn,isTerragesQueryCandidate} from './whatsapp-query-engine.ts';

export type WhatsAppSkillId='actions'|'operational_queries'|'earthwork_quote'|'fallback';
type TurnArgs={db:any;env:(key:string)=>string|undefined;fetcher?:typeof fetch;event:any;input:any;text:string};
type Skill={id:Exclude<WhatsAppSkillId,'fallback'>;priority:number;matches:(text:string)=>boolean;run:(args:TurnArgs)=>Promise<{handled:boolean;delivery?:string}>};

// The registry is the single extension point for new WhatsApp capabilities.
// Matchers must be synchronous and cheap; an LLM is never used to select a skill.
const skills:Skill[]=[
 {id:'actions',priority:300,matches:isTerragesActionCandidate,run:({db,env,fetcher,event,text})=>handleTerragesActionTurn({db,env,fetcher,event,text})},
 {id:'operational_queries',priority:200,matches:isTerragesQueryCandidate,run:({db,env,fetcher,event,text})=>handleTerragesQueryTurn({db,env,fetcher,event,text})},
 {id:'earthwork_quote',priority:100,matches:isEarthworkQuoteCandidate,run:({db,env,fetcher,event,input,text})=>handleWhatsAppAgentTurn({db,env,fetcher,event,input,text})},
];
const control=/^\s*(confirmar|confirmo|sim|pode confirmar|cancelar|cancela|parar|sair)\s*[.!]?\s*$/i;

export function selectWhatsAppSkill(text:string):WhatsAppSkillId{
 const hit=skills.filter(skill=>skill.matches(text)).sort((a,b)=>b.priority-a.priority)[0];
 return hit?.id??(control.test(text)?'actions':'fallback');
}

export function listWhatsAppSkills(){return skills.map(({id,priority})=>({id,priority}));}

export async function routeWhatsAppSkillTurn(args:TurnArgs){
 const selected=selectWhatsAppSkill(args.text);
 if(selected!=='fallback'){
  const skill=skills.find(item=>item.id===selected)!;
  const result=await skill.run(args);
  if(result.handled)return {...result,skill:selected};
  // A short control reply may belong to an active quote after an action session expired.
  if(selected==='actions'&&control.test(args.text)){
   const quote=skills.find(item=>item.id==='earthwork_quote')!;
   const fallback=await quote.run(args);if(fallback.handled)return {...fallback,skill:'earthwork_quote' as const};
  }
  return {...result,skill:selected};
 }
 // Only unknown/short replies check existing session state. This preserves multi-turn flows
 // without spending an LLM request for routine conversational messages.
 for(const id of ['actions','earthwork_quote'] as const){
  const result=await skills.find(item=>item.id===id)!.run(args);
  if(result.handled)return {...result,skill:id};
 }
 return {handled:false as const,skill:'fallback' as const};
}
