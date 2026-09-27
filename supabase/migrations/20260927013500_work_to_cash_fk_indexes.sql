-- Cover Work-to-Cash foreign keys used by tenant, document and reconciliation queries.
CREATE INDEX IF NOT EXISTS service_measurements_company_idx ON public.service_measurements(company_id);
CREATE INDEX IF NOT EXISTS service_measurements_created_by_idx ON public.service_measurements(created_by);
CREATE INDEX IF NOT EXISTS service_measurements_approved_by_idx ON public.service_measurements(approved_by);

CREATE INDEX IF NOT EXISTS service_measurement_items_company_idx ON public.service_measurement_items(company_id);
CREATE INDEX IF NOT EXISTS service_measurement_items_measurement_idx ON public.service_measurement_items(measurement_id);
-- service_order_id already has a UNIQUE index from the column constraint.

CREATE INDEX IF NOT EXISTS billing_documents_company_idx ON public.billing_documents(company_id);
CREATE INDEX IF NOT EXISTS billing_documents_measurement_idx ON public.billing_documents(measurement_id);
CREATE INDEX IF NOT EXISTS billing_documents_approved_by_idx ON public.billing_documents(approved_by);
-- service_order_id already has billing_documents_service_order_unique for non-null rows.

CREATE INDEX IF NOT EXISTS billing_charges_company_idx ON public.billing_charges(company_id);
CREATE INDEX IF NOT EXISTS billing_charges_document_idx ON public.billing_charges(billing_document_id);
CREATE INDEX IF NOT EXISTS billing_charges_transaction_idx ON public.billing_charges(transaction_id);

CREATE INDEX IF NOT EXISTS payment_reconciliations_company_idx ON public.payment_reconciliations(company_id);
-- charge_id is UNIQUE and therefore already indexed.
CREATE INDEX IF NOT EXISTS payment_reconciliations_transaction_idx ON public.payment_reconciliations(transaction_id);
CREATE INDEX IF NOT EXISTS payment_reconciliations_reconciled_by_idx ON public.payment_reconciliations(reconciled_by);
