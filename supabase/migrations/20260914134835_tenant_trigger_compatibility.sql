-- Preserve legitimate manager completion of an operator's order under immutable ownership.
-- The derived financial entry belongs to the authenticated actor and the same company.
CREATE OR REPLACE FUNCTION public.create_transaction_from_so() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
  INSERT INTO public.transactions(title,amount,type,category,date,status,user_id,company_id)
  VALUES('Serviço #'||substring(NEW.id::text,1,8)||' - '||NEW.client,NEW.total_value,'income','Serviços',NEW.date,
   CASE WHEN NEW.payment_method='Faturado' THEN 'pending' ELSE 'paid' END,coalesce(auth.uid(),NEW.user_id),NEW.company_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_transaction_from_so() FROM PUBLIC,anon,authenticated;
-- Fixed trusted search paths for remaining legacy functions, which are not callable by clients.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proconfig IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') LOOP
  EXECUTE format('ALTER FUNCTION %s SET search_path=pg_catalog,public,extensions,pg_temp',f.signature);
 END LOOP;
END $$;
