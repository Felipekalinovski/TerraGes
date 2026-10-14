-- Synthetic identities only. Execute the whole file, including ROLLBACK.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); op uuid:=gen_random_uuid(); spoof uuid:=gen_random_uuid(); ca uuid; cb uuid; invitation uuid; e uuid; r jsonb; again jsonb; company_count bigint; i integer; msg text;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(a,a||'@operator-test.invalid','{}'),(b,b||'@operator-test.invalid','{}');
 select company_id into ca from private.tenant_memberships where user_id=a;
 select company_id into cb from private.tenant_memberships where user_id=b;
 insert into private.whatsapp_bindings(instance_name,phone,user_id,company_id) values('operator-test','12025550101',a,ca),('operator-test','12025550102',b,cb);
 select count(*) into company_count from public.company_info;
 -- Conversational wizard: no mutation before confirmation; replay returns original answer.
 for i in 1..4 loop
  msg:=case i when 1 then 'Quero cadastrar um operador' when 2 then '+12025550109' when 3 then 'Operador de teste' else 'Sim' end;
  e:=gen_random_uuid();
  insert into public.whatsapp_inbound_events(id,user_id,company_id,instance_name,message_id,kind,text_content) values(e,a,ca,'operator-test',e::text,'text',msg);
  r:=public.whatsapp_operator_team_turn(e,msg);
  if r->>'handled'<>'true' then raise exception 'FAIL: wizard did not handle step %',i; end if;
  again:=public.whatsapp_operator_team_turn(e,msg);
  if r is distinct from again then raise exception 'FAIL: event replay changed response'; end if;
  if i<4 and exists(select 1 from private.whatsapp_operator_enrollments where phone='12025550109') then raise exception 'FAIL: access before confirmation'; end if;
 end loop;
 select id into invitation from private.whatsapp_operator_enrollments where company_id=ca and phone='12025550109' and state='pending';
 if invitation is null then raise exception 'FAIL: no authorization'; end if;
 if public.prepare_whatsapp_operator_activation('other-instance','12025550109') is not null then raise exception 'FAIL: wrong instance activated'; end if;
 if public.prepare_whatsapp_operator_activation('operator-test','12025550110') is not null then raise exception 'FAIL: wrong phone activated'; end if;
 begin
  perform private.authorize_whatsapp_operator(b,'operator-test','Foreign operator','+12025550109');
  raise exception 'FAIL: foreign company claimed phone';
 exception when raise_exception then if SQLERRM<>'phone_already_registered' then raise; end if; end;
 -- Activation trigger mirrors server-side Auth admin creation; fixtures roll back.
 insert into auth.users(id,phone,raw_app_meta_data,raw_user_meta_data) values(op,'12025550109',jsonb_build_object('terrages_operator_invite_id',invitation),'{"role":"admin"}');
 if not exists(select 1 from private.tenant_memberships where user_id=op and company_id=ca and role='operator' and active) then raise exception 'FAIL: incorrect operator membership'; end if;
 if (select count(*) from public.company_info)<>company_count then raise exception 'FAIL: operator created another company'; end if;
 if not exists(select 1 from public.employees where user_id=op and company_id=ca and contact='12025550109') then raise exception 'FAIL: missing employee'; end if;
 if (select count(*) from public.resolve_whatsapp_identity('operator-test','12025550109'))<>1 then raise exception 'FAIL: identity unresolved'; end if;
 e:=gen_random_uuid();
 insert into public.whatsapp_inbound_events(id,user_id,company_id,instance_name,message_id,kind,text_content) values(e,op,ca,'operator-test',e::text,'text','cadastrar operador');
 r:=public.whatsapp_operator_team_turn(e,'cadastrar operador');
 if r->>'text' not like 'Peça ao gestor%' then raise exception 'FAIL: operator can invite'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',op,'role','authenticated')::text,true);
 begin
  perform public.authorize_whatsapp_operator('Unauthorized','+12025550108');
  raise exception 'FAIL: operator RPC can invite';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('authenticated','public.prepare_whatsapp_operator_activation(text,text)','EXECUTE') or has_table_privilege('authenticated','private.whatsapp_operator_enrollments','SELECT') then raise exception 'FAIL: exposed private authorization'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 if jsonb_array_length(public.list_whatsapp_operators())<>0 then raise exception 'FAIL: foreign list'; end if;
 begin
  perform public.revoke_whatsapp_operator(invitation);
  raise exception 'FAIL: foreign revoke';
 exception when raise_exception then if SQLERRM<>'operator_not_found' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 if jsonb_array_length(public.list_whatsapp_operators())<>1 then raise exception 'FAIL: own list'; end if;
 perform public.revoke_whatsapp_operator(invitation);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 if exists(select 1 from public.resolve_whatsapp_identity('operator-test','12025550109')) then raise exception 'FAIL: revoked number resolves'; end if;
 if public.prepare_whatsapp_operator_activation('operator-test','12025550109') is not null then raise exception 'FAIL: revoked invitation activates'; end if;
 -- Reauthorization uses the same operator, without transferring company or adding a duplicate.
 perform private.authorize_whatsapp_operator(a,'operator-test','Operador de teste','+12025550109');
 r:=public.prepare_whatsapp_operator_activation('operator-test','12025550109');
 if r->>'activated'<>'true' then raise exception 'FAIL: reactivation'; end if;
 if (select count(*) from public.employees where user_id=op)<>1 then raise exception 'FAIL: duplicate employee'; end if;
 -- User-editable metadata cannot redeem an invite or choose a company/role.
 insert into auth.users(id,email,raw_user_meta_data) values(spoof,spoof||'@operator-test.invalid',jsonb_build_object('terrages_operator_invite_id',invitation,'company_id',ca,'role','admin'));
 if exists(select 1 from private.tenant_memberships where user_id=spoof and company_id=ca) then raise exception 'FAIL: metadata tenant injection'; end if;
 -- Manager deactivation and invitation expiration are rechecked at activation time.
 r:=private.authorize_whatsapp_operator(a,'operator-test','Pending test','+12025550108');
 update private.whatsapp_operator_enrollments set expires_at=now()-interval '1 second' where id=(r->>'id')::uuid;
 if public.prepare_whatsapp_operator_activation('operator-test','12025550108') is not null then raise exception 'FAIL: expired activates'; end if;
 update private.whatsapp_operator_enrollments set expires_at=now()+interval '1 day' where id=(r->>'id')::uuid;
 update private.tenant_memberships set active=false where user_id=a;
 if public.prepare_whatsapp_operator_activation('operator-test','12025550108') is not null then raise exception 'FAIL: revoked manager activates'; end if;
end $$;
select 'PASS: guided flow, replay, role restrictions, tenant isolation, activation, revocation, reactivation, expiry, metadata injection' as result;
rollback;
