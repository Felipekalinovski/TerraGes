// Legacy processors lacked authoritative tenant binding. Re-enable only after tenant tests.
Deno.serve(() => new Response(JSON.stringify({error:'legacy_processor_disabled',message:'Rotina em adequação ao isolamento de empresas.'}),{
  status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
}));
