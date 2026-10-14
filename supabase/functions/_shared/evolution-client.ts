import {IntakeError,readLimited} from './whatsapp-validation.ts';
type Env=(key:string)=>string|undefined;
export function evolutionEndpoint(env:Env, apiPath:string, goPath:string):string {
  const configured=env('EVOLUTION_API_URL'),instance=env('EVOLUTION_INSTANCE');
  if(!configured||!instance)throw new IntakeError('provider_not_configured',503);
  const base=new URL(configured);
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new IntakeError('invalid_provider_configuration',503);
  return configured.replace(/\/+$/,'')+(env('EVOLUTION_PROVIDER')==='go'?goPath:apiPath.replace('{instance}',encodeURIComponent(instance)));
}
export async function sendEvolutionText(phone:string,text:string,env:Env,fetcher:typeof fetch=fetch) {
  const apiKey=env('EVOLUTION_API_KEY');
  if(!apiKey)throw new IntakeError('outbound_provider_not_configured',503);
  const number=phone.replace(/@(s\.whatsapp\.net|c\.us)$/,'');
  if(!/^[1-9][0-9]{7,14}$/.test(number))throw new IntakeError('invalid_recipient');
  const body=env('EVOLUTION_PROVIDER')==='go'
    ? {number,text,delay:0}
    : {number,text,textMessage:{text},delay:0};
  const response=await fetcher(evolutionEndpoint(env,'/message/sendText/{instance}','/send/text'),{
    method:'POST',headers:{'Content-Type':'application/json',apikey:apiKey},redirect:'error',signal:AbortSignal.timeout(25000),body:JSON.stringify(body)
  });
  // Never retry a send blindly: the delivery checkpoint handles uncertain outcomes.
  if(!response.ok)throw new IntakeError('outbound_delivery_failed',400);
  let result:any={};try{result=JSON.parse(new TextDecoder().decode(await readLimited(response,64000)));}catch{/* optional receipt */}
  return result.data??result;
}
