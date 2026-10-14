import {IntakeError} from './whatsapp-validation.ts';
import {deliver} from './whatsapp-query-engine.ts';

/** Identity is supplied exclusively by the authenticated Evolution webhook. */
export async function activateAuthorizedOperator(db:any, input:{instance:string;phone:string}) {
  const prepared=await db.rpc('prepare_whatsapp_operator_activation',{p_instance:input.instance,p_phone:input.phone});
  if(prepared.error)throw new IntakeError('operator_activation_unavailable',503);
  if(!prepared.data)return false;
  if(prepared.data.activated===true)return true;
  if(typeof prepared.data.id!=='string')throw new IntakeError('operator_authorization_invalid',503);
  const created=await db.auth.admin.createUser({
    phone:input.phone,phone_confirm:true,
    app_metadata:{terrages_operator_invite_id:prepared.data.id}
  });
  // Concurrent deliveries may have activated the same authorization already.
  // Re-resolve the exact sender; never adopt an arbitrary existing Auth account.
  const identity=await db.rpc('resolve_whatsapp_identity',{p_instance:input.instance,p_phone:input.phone});
  if(identity.error||identity.data?.length!==1||identity.data[0].role!=='operator') {
    throw new IntakeError(created.error?'operator_activation_failed':'operator_binding_failed',503);
  }
  return true;
}

export async function handleWhatsAppTeamTurn(args:{db:any;env:(key:string)=>string|undefined;fetcher?:typeof fetch;event:any;input:any;text:string}) {
  if(args.input.kind!=='text')return {handled:false};
  const result=await args.db.rpc('whatsapp_operator_team_turn',{p_event_id:args.event.id,p_text:args.text});
  if(result.error)throw new IntakeError('operator_registration_unavailable',503);
  if(!result.data?.handled)return {handled:false};
  const delivery=await deliver({db:args.db,env:args.env,fetcher:args.fetcher??fetch,event:args.event,
    text:result.data.text,inputText:args.text,query:{intent:'operator_registration'}});
  return {handled:true,delivery};
}
