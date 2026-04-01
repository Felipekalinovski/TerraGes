-- ═══════════════════════════════════════════════════════════════
-- TerraGes — Migração: Orçamentos + Hora-Máquina
-- Execute no Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── Tabela: orcamentos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Cliente
    client_name     TEXT NOT NULL,
    client_phone    TEXT,
    client_email    TEXT,
    client_address  TEXT,

    -- Serviço
    service_type    TEXT NOT NULL,          -- ex: 'Terraplanagem', 'Escavação', 'Demolição'
    location        TEXT,                   -- endereço da obra
    description     TEXT,
    machines        JSONB DEFAULT '[]',     -- [{ machine_id, machine_name, hourly_rate, estimated_hours }]

    -- Financeiro
    hourly_rate     NUMERIC(10,2) DEFAULT 0,
    estimated_hours NUMERIC(8,2)  DEFAULT 0,
    total_value     NUMERIC(12,2) DEFAULT 0,
    discount        NUMERIC(10,2) DEFAULT 0,
    notes           TEXT,

    -- Controle
    status          TEXT DEFAULT 'rascunho'  -- rascunho | enviado | aprovado | recusado
        CHECK (status IN ('rascunho','enviado','aprovado','recusado')),
    valid_until     DATE,
    number          SERIAL,                 -- numeração automática: ORC-0001

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabela: hora_maquina ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hora_maquina (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Referências
    machine_id      UUID REFERENCES public.machines(id) ON DELETE SET NULL,
    machine_name    TEXT NOT NULL,          -- desnormalizado para relatórios
    operator_name   TEXT,
    project_name    TEXT NOT NULL,          -- obra / cliente
    client_name     TEXT,

    -- Tempo
    date            DATE NOT NULL,
    start_time      TIME NOT NULL,          -- ex: '07:30'
    end_time        TIME NOT NULL,          -- ex: '17:00'
    total_hours     NUMERIC(5,2) NOT NULL,  -- calculado: end - start - breaks
    break_minutes   INT DEFAULT 0,

    -- Financeiro
    hourly_rate     NUMERIC(10,2) DEFAULT 0,
    total_value     NUMERIC(12,2) DEFAULT 0,  -- total_hours * hourly_rate

    -- Complemento
    service_type    TEXT,
    observations    TEXT,
    photo_url       TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS Policies ────────────────────────────────────────────────
ALTER TABLE public.orcamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hora_maquina ENABLE ROW LEVEL SECURITY;

-- Orçamentos: cada usuário vê só os seus
CREATE POLICY "orcamentos_own" ON public.orcamentos
    FOR ALL USING (auth.uid() = user_id);

-- Hora-máquina: cada usuário vê só os seus
CREATE POLICY "hora_maquina_own" ON public.hora_maquina
    FOR ALL USING (auth.uid() = user_id);

-- ─── Trigger: updated_at automático ─────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS orcamentos_updated_at ON public.orcamentos;
CREATE TRIGGER orcamentos_updated_at
    BEFORE UPDATE ON public.orcamentos
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Índices de performance ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orcamentos_user    ON public.orcamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status  ON public.orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_hora_maquina_user  ON public.hora_maquina(user_id);
CREATE INDEX IF NOT EXISTS idx_hora_maquina_date  ON public.hora_maquina(date DESC);
CREATE INDEX IF NOT EXISTS idx_hora_maquina_proj  ON public.hora_maquina(project_name);
