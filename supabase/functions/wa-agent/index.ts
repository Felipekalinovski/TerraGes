import {getWhatsAppEnv} from '../_shared/whatsapp-env.ts';
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2.86.0';
import { createWhatsAppHandler } from '../_shared/whatsapp-handler.ts';
const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createWhatsAppHandler({db,env:getWhatsAppEnv,schedule:task=>EdgeRuntime.waitUntil(task)}));
