-- Manager-authorized, phone-verified WhatsApp operators. No public role/tenant input.
create table private.whatsapp_operator_enrollments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.company_info(id),
 invited_by uuid not null references auth.users(id),
 instance_name text not null,
 phone text not null unique check (phone ~ '^[1-9][0-9]{7,14}$'),
 name text not null check (length(name) between 2 and 100),
 state text not null default 'pending' check (state in ('pending','active','revoked')),
 user_id uuid references auth.users(id), employee_id uuid references public.employees(id) on delete set null,
 expires_at timestamptz not null default now()+interval '7 days',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index whatsapp_operator_company_idx on private.whatsapp_operator_enrollments(company_id);
create table private.whatsapp_team_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 company_id uuid not null references public.company_info(id), instance_name text not null,
 step text not null check (step in ('phone','name','confirm')),
 phone text, name text, expires_at timestamptz not null default now()+interval '30 minutes'
);
create table private.whatsapp_team_turns (
 event_id uuid primary key references public.whatsapp_inbound_events(id) on delete cascade,
 response_text text not null
);
alter table private.whatsapp_operator_enrollments enable row level security;
alter table private.whatsapp_team_sessions enable row level security;
alter table private.whatsapp_team_turns enable row level security;
revoke all on private.whatsapp_operator_enrollments,private.whatsapp_team_sessions,private.whatsapp_team_turns from public,anon,authenticated;
grant all on private.whatsapp_operator_enrollments,private.whatsapp_team_sessions,private.whatsapp_team_turns to service_role;

create function private.operator_phone(p_phone text) returns text
language plpgsql immutable set search_path='' as $$
declare v text;
begin
 if p_phone is null or length(p_phone)>40 or p_phone !~ '^[+0-9 ().-]+$' then return null; end if;
 v:=regexp_replace(p_phone,'[^0-9]','','g');
 if length(v) in (10,11) and left(trim(p_phone),1)<>'+' then v:='55'||v; end if;
 if v !~ '^[1-9][0-9]{7,14}$' then return null; end if;
 if left(v,2)='55' and (length(v) not in (12,13) or substring(v,3,1)='0') then return null; end if;
 return v;
end $$;

create function private.authorize_whatsapp_operator(p_manager uuid,p_instance text,p_name text,p_phone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid; v_phone text:=private.operator_phone(p_phone); v_name text:=trim(p_name); r private.whatsapp_operator_enrollments%rowtype;
begin
 select company_id into cid from private.tenant_memberships where user_id=p_manager and active and role in ('admin','gestor');
 if cid is null then raise exception 'manager_required' using errcode='42501'; end if;
 if not exists(select 1 from private.whatsapp_bindings where user_id=p_manager and company_id=cid and instance_name=p_instance) then raise exception 'manager_whatsapp_required'; end if;
 if v_phone is null then raise exception 'invalid_operator_phone'; end if;
 if v_name is null or length(v_name) not between 2 and 100 or v_name ~ '[[:cntrl:]]' then raise exception 'invalid_operator_name'; end if;
 perform pg_advisory_xact_lock(hashtextextended('operator:'||v_phone,0));
 select * into r from private.whatsapp_operator_enrollments where phone=v_phone for update;
 if r.id is not null and (r.company_id<>cid or r.instance_name<>p_instance) then raise exception 'phone_already_registered'; end if;
 if exists(select 1 from private.whatsapp_bindings b where b.phone=v_phone and (r.user_id is null or b.user_id<>r.user_id or b.company_id<>cid or b.instance_name<>p_instance))
 or exists(select 1 from auth.users u where ltrim(u.phone,'+')=v_phone and (r.user_id is null or u.id<>r.user_id)) then raise exception 'phone_already_registered'; end if;
 if r.state='active' then return jsonb_build_object('id',r.id,'state','active','name',r.name,'phone',r.phone); end if;
 if r.user_id is not null and not exists(select 1 from private.tenant_memberships where user_id=r.user_id and company_id=cid and role='operator') then raise exception 'phone_already_registered'; end if;
 insert into private.whatsapp_operator_enrollments(company_id,invited_by,instance_name,phone,name)
 values(cid,p_manager,p_instance,v_phone,v_name)
 on conflict(phone) do update set name=excluded.name,invited_by=excluded.invited_by,state='pending',expires_at=now()+interval '7 days',updated_at=now()
 returning * into r;
 return jsonb_build_object('id',r.id,'state',r.state,'name',r.name,'phone',r.phone);
end $$;

create function public.authorize_whatsapp_operator(p_name text,p_phone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare instance text;
begin
 if auth.uid() is null or not private.is_manager() then raise exception 'manager_required' using errcode='42501'; end if;
 select b.instance_name into instance from private.whatsapp_bindings b where b.user_id=auth.uid() and b.company_id=private.current_company() order by b.verified_at desc limit 1;
 if instance is null then raise exception 'manager_whatsapp_required'; end if;
 return private.authorize_whatsapp_operator(auth.uid(),instance,p_name,p_phone);
end $$;

create function public.list_whatsapp_operators() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_manager() then raise exception 'manager_required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone,'state',case when state='pending' and expires_at<=now() then 'expired' else state end,'expires_at',expires_at) order by created_at desc),'[]'::jsonb) from private.whatsapp_operator_enrollments where company_id=private.current_company());
end $$;

create function public.revoke_whatsapp_operator(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r private.whatsapp_operator_enrollments%rowtype;
begin
 if not private.is_manager() then raise exception 'manager_required' using errcode='42501'; end if;
 select * into r from private.whatsapp_operator_enrollments where id=p_id and company_id=private.current_company() for update;
 if not found then raise exception 'operator_not_found'; end if;
 if r.user_id is not null then
  update private.tenant_memberships set active=false where user_id=r.user_id and company_id=r.company_id and role='operator';
  delete from private.whatsapp_bindings where user_id=r.user_id and company_id=r.company_id and instance_name=r.instance_name;
 end if;
 update private.whatsapp_operator_enrollments set state='revoked',updated_at=now() where id=r.id;
 return true;
end $$;

-- Only a verified webhook may look up a pending authorization. Existing operator
-- accounts can be reactivated, but never moved between companies or promoted.
create function public.prepare_whatsapp_operator_activation(p_instance text,p_phone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.whatsapp_operator_enrollments%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 select * into r from private.whatsapp_operator_enrollments where phone=p_phone and instance_name=p_instance and state='pending' and expires_at>now() for update;
 if not found then return null; end if;
 if not exists(select 1 from private.tenant_memberships where user_id=r.invited_by and company_id=r.company_id and active and role in ('admin','gestor')) then return null; end if;
 if exists(select 1 from private.whatsapp_bindings where phone=p_phone) then return null; end if;
 if r.user_id is not null then
  update private.tenant_memberships set active=true where user_id=r.user_id and company_id=r.company_id and role='operator';
  if not found then return null; end if;
  insert into private.whatsapp_bindings(instance_name,phone,user_id,company_id) values(r.instance_name,r.phone,r.user_id,r.company_id);
  update private.whatsapp_operator_enrollments set state='active',updated_at=now() where id=r.id;
  return jsonb_build_object('activated',true);
 end if;
 return jsonb_build_object('id',r.id);
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare cid uuid; r private.whatsapp_operator_enrollments%rowtype; eid uuid;
begin
 if NEW.raw_app_meta_data ? 'terrages_operator_invite_id' then
  select * into r from private.whatsapp_operator_enrollments where id=(NEW.raw_app_meta_data->>'terrages_operator_invite_id')::uuid for update;
  if r.id is null or r.state<>'pending' or r.expires_at<=now() or r.user_id is not null or ltrim(NEW.phone,'+') is distinct from r.phone
   or not exists(select 1 from private.tenant_memberships where user_id=r.invited_by and company_id=r.company_id and active and role in ('admin','gestor'))
   or exists(select 1 from private.whatsapp_bindings where phone=r.phone) then raise exception 'operator_authorization_invalid'; end if;
  insert into public.profiles(id,email,name,phone,role,company_id,permissions,onboarding_completed) values(NEW.id,NEW.email,r.name,r.phone,'operator',r.company_id,'{}',true);
  insert into private.tenant_memberships(user_id,company_id,role,active) values(NEW.id,r.company_id,'operator',true);
  insert into public.employees(name,role,contact,user_id,company_id) values(r.name,'Operador de Máquinas',r.phone,NEW.id,r.company_id) returning id into eid;
  insert into private.whatsapp_bindings(instance_name,phone,user_id,company_id) values(r.instance_name,r.phone,NEW.id,r.company_id);
  update private.whatsapp_operator_enrollments set state='active',user_id=NEW.id,employee_id=eid,updated_at=now() where id=r.id;
 else
  insert into public.company_info(name) values('Empresa — configuração pendente') returning id into cid;
  insert into public.profiles(id,email,name,role,company_id,permissions) values(NEW.id,NEW.email,coalesce(NEW.raw_user_meta_data->>'name','Novo usuário'),'admin',cid,'{}');
  insert into private.tenant_memberships(user_id,company_id,role,active) values(NEW.id,cid,'admin',true);
 end if;
 return NEW;
end $$;

create function public.whatsapp_operator_team_turn(p_event_id uuid,p_text text) returns jsonb
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
    result:=private.authorize_whatsapp_operator(s.user_id,s.instance_name,s.name,s.phone);
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

revoke all on function private.operator_phone(text),private.authorize_whatsapp_operator(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.authorize_whatsapp_operator(text,text),public.list_whatsapp_operators(),public.revoke_whatsapp_operator(uuid),public.prepare_whatsapp_operator_activation(text,text),public.whatsapp_operator_team_turn(uuid,text) from public,anon,authenticated;
grant execute on function public.authorize_whatsapp_operator(text,text),public.list_whatsapp_operators(),public.revoke_whatsapp_operator(uuid) to authenticated;
grant execute on function public.prepare_whatsapp_operator_activation(text,text),public.whatsapp_operator_team_turn(uuid,text) to service_role;
