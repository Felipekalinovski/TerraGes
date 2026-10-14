import {IntakeError,readLimited} from './whatsapp-validation.ts';
import {parseModelJson} from './llm-json.ts';
type Env=(key:string)=>string|undefined;
type Message={role:string;content:string};
export const DEFAULT_NVIDIA_TEXT_MODEL='nvidia/nemotron-3-super-120b-a12b';
export async function completeTextJson({env,fetcher=fetch,messages,maxTokens}:{env:Env;fetcher?:typeof fetch;messages:Message[];maxTokens:number}):Promise<Record<string,any>> {
 const nvidiaKey=env('NVIDIA_API_KEY')?.trim(),openrouterKey=env('OPENROUTER_API_KEY')?.trim();
 async function request(provider:'nvidia'|'openrouter') {
  const native=provider==='nvidia',key=native?nvidiaKey:openrouterKey;
  const model=native?(env('NVIDIA_MODEL_TEXT')?.trim()||DEFAULT_NVIDIA_TEXT_MODEL):env('AI_MODEL_TEXT');
  if(!key||!model)throw new IntakeError('llm_not_configured',503);
  const endpoint=native?'https://integrate.api.nvidia.com/v1/chat/completions':'https://openrouter.ai/api/v1/chat/completions';
  let response:Response;
  try{
   response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),
    body:JSON.stringify({model,temperature:0,max_tokens:maxTokens,stream:false,response_format:{type:'json_object'},messages,
    ...(native?{chat_template_kwargs:{enable_thinking:false}}:{reasoning:{enabled:false}})})});
  }catch{throw new IntakeError('llm_request_unavailable',503);}
  if(!response.ok) {
   if(response.status===401||response.status===403)throw new IntakeError('llm_authentication_failed',401);
   throw new IntakeError('llm_provider_unavailable',response.status===429?429:503);
  }
  try{
   const body=JSON.parse(new TextDecoder().decode(await readLimited(response,64000)));
   return parseModelJson(body.choices?.[0]?.message?.content);
  }catch{throw new IntakeError('llm_invalid_json',502);}
 }
 if(!nvidiaKey)return request('openrouter');
 try{return await request('nvidia');}
 catch(e){
  if(openrouterKey && e instanceof IntakeError && (e.status>=500||e.status===429))return request('openrouter');
  throw e;
 }
}
