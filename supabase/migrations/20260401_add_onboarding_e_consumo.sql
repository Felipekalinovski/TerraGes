-- Adicionar coluna de onboarding no profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    END IF;
END
$$;

-- Adicionar coluna de consumo de combustível na tabela machines
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'fuel_consumption') THEN
        ALTER TABLE public.machines ADD COLUMN fuel_consumption FLOAT DEFAULT 0.0;
    END IF;
END
$$;
