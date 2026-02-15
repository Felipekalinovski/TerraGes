
-- 1. Add user_id column to tables (if not exists)
DO $$
BEGIN
    -- Machines
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'user_id') THEN
        ALTER TABLE machines ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- Employees
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'user_id') THEN
        ALTER TABLE employees ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- Service Orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_orders' AND column_name = 'user_id') THEN
        ALTER TABLE service_orders ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- Transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'user_id') THEN
        ALTER TABLE transactions ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END
$$;

-- 2. Update RLS Policies for Strict Isolation

-- Machines Policies
DROP POLICY IF EXISTS "Authenticated users can view machines" ON machines;
DROP POLICY IF EXISTS "Authenticated users can insert machines" ON machines; -- Assuming nomenclature
DROP POLICY IF EXISTS "Authenticated users can update machines" ON machines;
DROP POLICY IF EXISTS "Users can only view their own machines" ON machines; -- Clean up if re-running

CREATE POLICY "Users can view own machines" ON machines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machines" ON machines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own machines" ON machines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own machines" ON machines FOR DELETE USING (auth.uid() = user_id);

-- Employees Policies
DROP POLICY IF EXISTS "Authenticated users can view employees" ON employees;
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON employees;

CREATE POLICY "Users can view own employees" ON employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own employees" ON employees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own employees" ON employees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own employees" ON employees FOR DELETE USING (auth.uid() = user_id);

-- Service Orders Policies
DROP POLICY IF EXISTS "Authenticated users can view service_orders" ON service_orders;
DROP POLICY IF EXISTS "Authenticated users can insert service_orders" ON service_orders;
DROP POLICY IF EXISTS "Authenticated users can update service_orders" ON service_orders;

CREATE POLICY "Users can view own service_orders" ON service_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own service_orders" ON service_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own service_orders" ON service_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own service_orders" ON service_orders FOR DELETE USING (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions; -- Assuming nomenclature
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON transactions;

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);


-- 3. Update Trigger to propagate user_id to transactions
CREATE OR REPLACE FUNCTION public.create_transaction_from_so()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic: If status changed to 'completed' (or inserted as 'completed')
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO transactions (title, amount, type, category, date, status, user_id)
    VALUES (
      'Serviço #' || SUBSTRING(NEW.id::text, 1, 8) || ' - ' || NEW.client,
      NEW.total_value,
      'income',
      'Serviços',
      NEW.date,
      CASE WHEN NEW.payment_method = 'Faturado' THEN 'pending' ELSE 'paid' END,
      NEW.user_id -- Propagate user_id from service_order
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
