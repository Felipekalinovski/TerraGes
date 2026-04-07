-- ═══════════════════════════════════════════════════════════════
-- TerraGes — Migração: Correção de Segurança RLS
-- Data: 2026-04-07
-- Tabelas corrigidas: rdos, projects, rdo_ai_analysis, rdo_tags, 
--                      machine_impact, company_info, insights,
--                      maintenance_records, schedules
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Adicionar coluna user_id onde não existir ──────────────
DO $$
BEGIN
    -- rdos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rdos' AND column_name = 'user_id') THEN
        ALTER TABLE public.rdos ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- projects
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'user_id') THEN
        ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- rdo_ai_analysis
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rdo_ai_analysis' AND column_name = 'user_id') THEN
        ALTER TABLE public.rdo_ai_analysis ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- rdo_tags
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rdo_tags' AND column_name = 'user_id') THEN
        ALTER TABLE public.rdo_tags ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- machine_impact
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machine_impact' AND column_name = 'user_id') THEN
        ALTER TABLE public.machine_impact ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- company_info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_info' AND column_name = 'user_id') THEN
        ALTER TABLE public.company_info ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- insights
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'insights' AND column_name = 'user_id') THEN
        ALTER TABLE public.insights ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- maintenance_records
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_records' AND column_name = 'user_id') THEN
        ALTER TABLE public.maintenance_records ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;

    -- schedules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'user_id') THEN
        ALTER TABLE public.schedules ADD COLUMN user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END
$$;

-- ─── 2. Habilitar RLS em todas as tabelas ─────────────────────
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- ─── 3. Criar políticas de acesso (user_id = auth.uid()) ──────

-- rdos
DROP POLICY IF EXISTS "Users can view own rdos" ON public.rdos;
DROP POLICY IF EXISTS "Users can insert own rdos" ON public.rdos;
DROP POLICY IF EXISTS "Users can update own rdos" ON public.rdos;
DROP POLICY IF EXISTS "Users can delete own rdos" ON public.rdos;

CREATE POLICY "Users can view own rdos" ON public.rdos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rdos" ON public.rdos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rdos" ON public.rdos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rdos" ON public.rdos FOR DELETE USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- rdo_ai_analysis
DROP POLICY IF EXISTS "Users can view own rdo_ai_analysis" ON public.rdo_ai_analysis;
DROP POLICY IF EXISTS "Users can insert own rdo_ai_analysis" ON public.rdo_ai_analysis;
DROP POLICY IF EXISTS "Users can update own rdo_ai_analysis" ON public.rdo_ai_analysis;
DROP POLICY IF EXISTS "Users can delete own rdo_ai_analysis" ON public.rdo_ai_analysis;

CREATE POLICY "Users can view own rdo_ai_analysis" ON public.rdo_ai_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rdo_ai_analysis" ON public.rdo_ai_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rdo_ai_analysis" ON public.rdo_ai_analysis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rdo_ai_analysis" ON public.rdo_ai_analysis FOR DELETE USING (auth.uid() = user_id);

-- rdo_tags
DROP POLICY IF EXISTS "Users can view own rdo_tags" ON public.rdo_tags;
DROP POLICY IF EXISTS "Users can insert own rdo_tags" ON public.rdo_tags;
DROP POLICY IF EXISTS "Users can update own rdo_tags" ON public.rdo_tags;
DROP POLICY IF EXISTS "Users can delete own rdo_tags" ON public.rdo_tags;

CREATE POLICY "Users can view own rdo_tags" ON public.rdo_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rdo_tags" ON public.rdo_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rdo_tags" ON public.rdo_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rdo_tags" ON public.rdo_tags FOR DELETE USING (auth.uid() = user_id);

-- machine_impact
DROP POLICY IF EXISTS "Users can view own machine_impact" ON public.machine_impact;
DROP POLICY IF EXISTS "Users can insert own machine_impact" ON public.machine_impact;
DROP POLICY IF EXISTS "Users can update own machine_impact" ON public.machine_impact;
DROP POLICY IF EXISTS "Users can delete own machine_impact" ON public.machine_impact;

CREATE POLICY "Users can view own machine_impact" ON public.machine_impact FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machine_impact" ON public.machine_impact FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own machine_impact" ON public.machine_impact FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own machine_impact" ON public.machine_impact FOR DELETE USING (auth.uid() = user_id);

-- company_info (acesso mais flexível - todos usuários autenticados podem ver)
DROP POLICY IF EXISTS "Users can view company_info" ON public.company_info;
DROP POLICY IF EXISTS "Users can insert company_info" ON public.company_info;
DROP POLICY IF EXISTS "Users can update own company_info" ON public.company_info;
DROP POLICY IF EXISTS "Users can delete own company_info" ON public.company_info;

CREATE POLICY "Users can view company_info" ON public.company_info FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert company_info" ON public.company_info FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own company_info" ON public.company_info FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own company_info" ON public.company_info FOR DELETE USING (auth.uid() = user_id);

-- insights
DROP POLICY IF EXISTS "Users can view own insights" ON public.insights;
DROP POLICY IF EXISTS "Users can insert own insights" ON public.insights;
DROP POLICY IF EXISTS "Users can update own insights" ON public.insights;
DROP POLICY IF EXISTS "Users can delete own insights" ON public.insights;

CREATE POLICY "Users can view own insights" ON public.insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insights" ON public.insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insights" ON public.insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insights" ON public.insights FOR DELETE USING (auth.uid() = user_id);

-- maintenance_records
DROP POLICY IF EXISTS "Users can view own maintenance_records" ON public.maintenance_records;
DROP POLICY IF EXISTS "Users can insert own maintenance_records" ON public.maintenance_records;
DROP POLICY IF EXISTS "Users can update own maintenance_records" ON public.maintenance_records;
DROP POLICY IF EXISTS "Users can delete own maintenance_records" ON public.maintenance_records;

CREATE POLICY "Users can view own maintenance_records" ON public.maintenance_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own maintenance_records" ON public.maintenance_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own maintenance_records" ON public.maintenance_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own maintenance_records" ON public.maintenance_records FOR DELETE USING (auth.uid() = user_id);

-- schedules
DROP POLICY IF EXISTS "Users can view own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can insert own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can update own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can delete own schedules" ON public.schedules;

CREATE POLICY "Users can view own schedules" ON public.schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedules" ON public.schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.schedules FOR DELETE USING (auth.uid() = user_id);

-- ─── 4. Índices de performance para user_id ───────────────────
CREATE INDEX IF NOT EXISTS idx_rdos_user ON public.rdos(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_rdo_ai_analysis_user ON public.rdo_ai_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_rdo_tags_user ON public.rdo_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_machine_impact_user ON public.machine_impact(user_id);
CREATE INDEX IF NOT EXISTS idx_company_info_user ON public.company_info(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_user ON public.insights(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_user ON public.maintenance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user ON public.schedules(user_id);
