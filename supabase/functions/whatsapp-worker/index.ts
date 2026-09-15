/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import {createClient} from 'npm:@supabase/supabase-js@2.86.0';
import {createWorkerHandler} from '../_shared/whatsapp-worker-handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
Deno.serve(createWorkerHandler({db,env:key=>Deno.env.get(key),schedule:task=>EdgeRuntime.waitUntil(task),
 userClient:token=>createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{...options,global:{headers:{Authorization:`Bearer ${token}`}}})
}));
