-- Proposed next migration: reliable service-order completion.
-- Execute all statements in one transaction. Existing completed orders are preserved.
CREATE TABLE private.service_order_settlements (
 service_order_id uuid PRIMARY KEY REFERENCES public.service_orders(id) ON DELETE RESTRICT,
 transaction_id uuid UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL REFERENCES public.company_info(id),
 completed_by uuid REFERENCES auth.users(id),
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.service_order_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.service_order_settlements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.service_order_settlements TO service_role;

CREATE FUNCTION private.guard_service_order_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='completed' OR EXISTS(SELECT 1 FROM private.service_order_settlements WHERE service_order_id=OLD.id) THEN
   RAISE EXCEPTION 'completed_order_requires_adjustment' USING ERRCODE='42501';
  END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='completed' THEN
  IF ROW(NEW.id,NEW.status,NEW.date,NEW.client,NEW.machine_id,NEW.operator_id,NEW.start_hour,NEW.end_hour,NEW.hourly_rate,NEW.payment_method)
   IS DISTINCT FROM ROW(OLD.id,OLD.status,OLD.date,OLD.client,OLD.machine_id,OLD.operator_id,OLD.start_hour,OLD.end_hour,OLD.hourly_rate,OLD.payment_method) THEN
   RAISE EXCEPTION 'completed_order_requires_adjustment' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.status='completed' THEN
  IF auth.uid() IS NOT NULL AND NOT private.is_manager() THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501'; END IF;
  IF NEW.machine_id IS NULL OR NEW.start_hour IS NULL OR NEW.end_hour IS NULL OR NEW.hourly_rate IS NULL
   OR NEW.start_hour<0 OR NEW.start_hour>1000000 OR NEW.end_hour<=NEW.start_hour OR NEW.end_hour-NEW.start_hour>24
   OR NEW.hourly_rate<0 OR NEW.hourly_rate>1000000
   OR NEW.start_hour::text IN ('NaN','Infinity','-Infinity')
   OR NEW.end_hour::text IN ('NaN','Infinity','-Infinity')
   OR NEW.hourly_rate::text IN ('NaN','Infinity','-Infinity')
   OR length(trim(coalesce(NEW.client,'')))=0 THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_service_order_completion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER service_order_completion_guard BEFORE INSERT OR UPDATE OR DELETE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION private.guard_service_order_completion();

CREATE OR REPLACE FUNCTION public.create_transaction_from_so() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claimed uuid; txid uuid;
BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
  INSERT INTO private.service_order_settlements(service_order_id,company_id,completed_by,snapshot)
   VALUES(NEW.id,NEW.company_id,auth.uid(),jsonb_build_object('date',NEW.date,'client',NEW.client,'machine_id',NEW.machine_id,
    'start_hour',NEW.start_hour,'end_hour',NEW.end_hour,'hourly_rate',NEW.hourly_rate,'total_value',NEW.total_value,'owner_id',NEW.user_id))
   ON CONFLICT(service_order_id) DO NOTHING RETURNING service_order_id INTO claimed;
  IF claimed IS NOT NULL THEN
   INSERT INTO public.transactions(title,amount,type,category,date,status,user_id,company_id)
    VALUES('Serviço #'||substring(NEW.id::text,1,8)||' - '||NEW.client,NEW.total_value,'income','Serviços',NEW.date,
     'pending',coalesce(auth.uid(),NEW.user_id),NEW.company_id) RETURNING id INTO txid;
   UPDATE private.service_order_settlements SET transaction_id=txid WHERE service_order_id=NEW.id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_transaction_from_so() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.update_machine_hours() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
  UPDATE public.machines SET hours=greatest(coalesce(hours,0),NEW.end_hour)
   WHERE id=NEW.machine_id AND company_id=NEW.company_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.update_machine_hours() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';

-- Keep financial values tied to their completed source; receipt status remains editable by tenant managers.
CREATE FUNCTION private.guard_settlement_transaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.service_order_settlements WHERE transaction_id=OLD.id) AND
  ROW(NEW.id,NEW.title,NEW.date,NEW.amount,NEW.type,NEW.category,NEW.user_id,NEW.company_id)
   IS DISTINCT FROM ROW(OLD.id,OLD.title,OLD.date,OLD.amount,OLD.type,OLD.category,OLD.user_id,OLD.company_id) THEN
  RAISE EXCEPTION 'settlement_requires_adjustment' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_settlement_transaction() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER settlement_transaction_guard BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION private.guard_settlement_transaction();
