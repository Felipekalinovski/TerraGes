
-- Create employees table with enhanced fields
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'vacation', 'leave', 'inactive')),
  contact TEXT,
  email TEXT,
  cpf TEXT,
  birth_date DATE,
  address TEXT,
  admission_date DATE,
  certifications TEXT[],
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employees"
  ON employees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert employees"
  ON employees FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update employees"
  ON employees FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Seed data for employees (using WHERE NOT EXISTS to avoid duplicates)
INSERT INTO employees (name, role, status, contact, email, cpf, image_url)
SELECT 'Carlos Silva', 'Operador de Máquinas', 'active', '(11) 99999-1111', 'carlos.silva@terrages.com', '123.456.789-00', 'https://i.pravatar.cc/150?u=1'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Carlos Silva');

INSERT INTO employees (name, role, status, contact, email, cpf, image_url)
SELECT 'Ana Pereira', 'Engenheira Civil', 'active', '(11) 98888-2222', 'ana.pereira@terrages.com', '234.567.890-11', 'https://i.pravatar.cc/150?u=5'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Ana Pereira');

INSERT INTO employees (name, role, status, contact, email, cpf, image_url)
SELECT 'João Costa', 'Mecânico Chefe', 'vacation', '(11) 97777-3333', 'joao.costa@terrages.com', '345.678.901-22', 'https://i.pravatar.cc/150?u=3'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'João Costa');

INSERT INTO employees (name, role, status, contact, email, cpf, image_url)
SELECT 'Mariana Souza', 'Assistente Adm.', 'active', '(11) 96666-4444', 'mariana.souza@terrages.com', '456.789.012-33', 'https://i.pravatar.cc/150?u=9'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Mariana Souza');

INSERT INTO employees (name, role, status, contact, email, cpf, image_url)
SELECT 'Roberto Lima', 'Motorista', 'leave', '(11) 95555-5555', 'roberto.lima@terrages.com', '567.890.123-44', 'https://i.pravatar.cc/150?u=8'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Roberto Lima');


-- Create service_orders table
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  client TEXT NOT NULL,
  machine_id UUID REFERENCES machines(id),
  operator_id UUID REFERENCES employees(id),
  start_hour NUMERIC NOT NULL,
  end_hour NUMERIC NOT NULL,
  total_hours NUMERIC GENERATED ALWAYS AS (end_hour - start_hour) STORED,
  hourly_rate NUMERIC NOT NULL,
  total_value NUMERIC GENERATED ALWAYS AS ((end_hour - start_hour) * hourly_rate) STORED,
  payment_method TEXT CHECK (payment_method IN ('Pix', 'Cartão', 'Boleto', 'Faturado', 'Dinheiro')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  location TEXT,
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for service_orders
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service_orders"
  ON service_orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert service_orders"
  ON service_orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update service_orders"
  ON service_orders FOR UPDATE
  USING (auth.role() = 'authenticated');


-- Create storage bucket for service receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-receipts', 'service-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for service receipts
CREATE POLICY "Service receipts are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-receipts');

CREATE POLICY "Authenticated users can upload service receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'service-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update service receipts"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'service-receipts' AND auth.role() = 'authenticated');


-- Function to update machine hours automatically
CREATE OR REPLACE FUNCTION public.update_machine_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic: If status changed to 'completed' (or inserted as 'completed')
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE machines
    SET hours = GREATEST(hours, NEW.end_hour)
    WHERE id = NEW.machine_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updating machine hours
DROP TRIGGER IF EXISTS on_service_order_completion ON service_orders;
CREATE TRIGGER on_service_order_completion
  AFTER INSERT OR UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_machine_hours();


-- Function to create financial transaction automatically
CREATE OR REPLACE FUNCTION public.create_transaction_from_so()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic: If status changed to 'completed' (or inserted as 'completed')
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO transactions (title, amount, type, category, date, status)
    VALUES (
      'Serviço #' || SUBSTRING(NEW.id::text, 1, 8) || ' - ' || NEW.client,
      NEW.total_value,
      'income',
      'Serviços',
      NEW.date,
      CASE WHEN NEW.payment_method = 'Faturado' THEN 'pending' ELSE 'paid' END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for creating financial transaction
DROP TRIGGER IF EXISTS on_service_order_payment ON service_orders;
CREATE TRIGGER on_service_order_payment
  AFTER INSERT OR UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION public.create_transaction_from_so();
