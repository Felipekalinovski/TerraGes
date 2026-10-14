// Replace the retired free Llama route while preserving future model configuration.
export function getWhatsAppEnv(key:string):string|undefined {
  const value=Deno.env.get(key);
  if(key==='AI_MODEL_TEXT' && (!value?.trim() || value.trim()==='meta-llama/llama-3.3-70b-instruct:free'))return 'openrouter/free';
  return value;
}
