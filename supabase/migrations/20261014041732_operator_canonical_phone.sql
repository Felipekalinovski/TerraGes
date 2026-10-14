-- Preserve the country code of already-normalized WhatsApp numbers.
create or replace function public.whatsapp_operator_team_turn(p_event_id uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; s private.whatsapp_team_sessions%rowtype; v text:=trim(p_text); norm text; response text; result jsonb; company text; start_request boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 c:=public.get_whatsapp_action_context(p_event_id);
 -- Do not execute registration instructions extracted from documents or images.
 if not exists(select 1 from public.whatsapp_inbound_events where id=p_event_id and kind='text') then return jsonb_build_object('handled',false); end if;
 if length(v)>1000 then return jsonb_build_object('handled',false); end if;
 norm:=lower(translate(v,'áàâãéêíóôõúç','aaaaeeiooouc'));
 start_request:=norm ~ '(cadastr|liber|adicion|convid).*(operador|colaborador|funcionario|equipe)' or norm in ('cadastrar operador','novo operador');
 if c->>'role' not in ('admin','gestor') then
  if start_request then return jsonb_build_object('handled',true,'text','Peça ao gestor da empresa para enviar CADASTRAR OPERADOR. Só o gestor pode liberar um acesso.'); end if;
  return jsonb_build_object('handled',false);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('team:'||(c->>'user_id'),0));
 select response_text into response from private.whatsapp_team_turns where event_id=p_event_id;
 if found then return jsonb_build_object('handled',true,'text',response); end if;
 select * into s from private.whatsapp_team_sessions where user_id=(c->>'user_id')::uuid and company_id=(c->>'company_id')::uuid and instance_name=c->>'instance_name' and expires_at>now() for update;
 if s.user_id is null and not start_request then return jsonb_build_object('handled',false); end if;
 if norm ~ '^(cancelar|cancela|sair|parar)[.!]?$' then
  delete from private.whatsapp_team_sessions where user_id=(c->>'user_id')::uuid;
  response:='Cadastro cancelado. Nenhum novo acesso foi liberado.';
 elsif start_request then
  insert into private.whatsapp_team_sessions(user_id,company_id,instance_name,step) values((c->>'user_id')::uuid,(c->>'company_id')::uuid,c->>'instance_name','phone')
  on conflict(user_id) do update set company_id=excluded.company_id,instance_name=excluded.instance_name,step='phone',phone=null,name=null,expires_at=now()+interval '30 minutes';
  response:='Vamos liberar o operador na sua empresa. Qual é o WhatsApp dele? Envie o contato ou digite o número com DDD. Para desistir, envie CANCELAR.';
 elsif s.step='phone' then
  s.phone:=private.operator_phone(v);
  if s.phone is null then response:='Não reconheci o número. Envie o WhatsApp com DDD, por exemplo: (41) 99999-9999. Para outro país, inclua + e o código do país.';
  else
   update private.whatsapp_team_sessions set phone=s.phone,step='name',expires_at=now()+interval '30 minutes' where user_id=s.user_id;
   response:='Qual é o nome do operador?';
  end if;
 elsif s.step='name' then
  if length(v) not between 2 and 100 or v ~ '[[:cntrl:]]' or v !~ '[[:alpha:]]' then response:='Digite apenas o nome do operador (de 2 a 100 caracteres).';
  else
   select name into company from public.company_info where id=s.company_id;
   update private.whatsapp_team_sessions set name=v,step='confirm',expires_at=now()+interval '30 minutes' where user_id=s.user_id;
   response:='Confira antes de liberar:'||E'\nNome: '||v||E'\nWhatsApp: +'||s.phone||E'\nEmpresa: '||coalesce(company,'Sua empresa')||E'\nAcesso: operador, para enviar registros de campo.\n\nEstá correto? Responda SIM para liberar ou CANCELAR para recomeçar.';
  end if;
 else
  if norm ~ '^(sim|confirmar|confirmo)[.!]?$' then
   begin
    result:=private.authorize_whatsapp_operator(s.user_id,s.instance_name,s.name,'+'||s.phone);
    response:=case when result->>'state'='active' then 'Esse operador já tem acesso pelo WhatsApp.' else 'Pronto! '||s.name||' está autorizado. Peça que envie um oi para este WhatsApp do TerraGes em até 7 dias. O acesso será ativado na sua empresa, sem senha nem código. Você pode bloquear o acesso em Mais → Equipe → Acessos pelo WhatsApp.' end;
   exception when raise_exception then
    if SQLERRM='phone_already_registered' then response:='Esse número já tem um cadastro. Não vou transferir o acesso entre empresas. Confira o número em Mais → Equipe → Acessos pelo WhatsApp.'; else raise; end if;
   end;
   delete from private.whatsapp_team_sessions where user_id=s.user_id;
  else response:='Para liberar o nome e número mostrados acima, responda SIM. Se houver algo errado, envie CANCELAR e depois CADASTRAR OPERADOR.'; end if;
 end if;
 insert into private.whatsapp_team_turns(event_id,response_text) values(p_event_id,response);
 return jsonb_build_object('handled',true,'text',response);
end $$;

