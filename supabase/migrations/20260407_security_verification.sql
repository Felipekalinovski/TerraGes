-- ═══════════════════════════════════════════════════════════════
-- TerraGes — Verificação de Segurança e Status do RLS
-- Execute no Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Verificar quais tabelas têm RLS ativado ────────────────
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'rdos', 'projects', 'rdo_ai_analysis', 'rdo_tags', 
        'machine_impact', 'company_info', 'insights',
        'maintenance_records', 'schedules', 'machines', 
        'employees', 'service_orders', 'transactions',
        'orcamentos', 'hora_maquina', 'profiles', 'companies'
    )
ORDER BY tablename;

-- ─── 2. Verificar políticas de segurança existentes ────────────
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN (
        'rdos', 'projects', 'rdo_ai_analysis', 'rdo_tags', 
        'machine_impact', 'company_info', 'insights',
        'maintenance_records', 'schedules', 'machines', 
        'employees', 'service_orders', 'transactions',
        'orcamentos', 'hora_maquina', 'profiles', 'companies'
    )
ORDER BY tablename, policyname;

-- ─── 3. Verificar colunas user_id nas tabelas ─────────────────
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
    AND table_name IN (
        'rdos', 'projects', 'rdo_ai_analysis', 'rdo_tags', 
        'machine_impact', 'company_info', 'insights',
        'maintenance_records', 'schedules', 'machines', 
        'employees', 'service_orders', 'transactions',
        'orcamentos', 'hora_maquina', 'profiles', 'companies'
    )
    AND column_name = 'user_id'
ORDER BY table_name;

-- ─── 4. Verificar índices de performance ────────────────────
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN (
        'rdos', 'projects', 'rdo_ai_analysis', 'rdo_tags', 
        'machine_impact', 'company_info', 'insights',
        'maintenance_records', 'schedules', 'machines', 
        'employees', 'service_orders', 'transactions',
        'orcamentos', 'hora_maquina', 'profiles', 'companies'
    )
    AND indexname LIKE '%_user%'
ORDER BY tablename;

-- ─── 5. Testar segurança com usuário simulado (opcional) ─────
-- SELECT * FROM rdos LIMIT 10;
-- SELECT * FROM projects LIMIT 10;
-- SELECT * FROM machines LIMIT 10;

-- ─── 6. Mostrar resumo ────────────────────────────────────────
SELECT 
    'Tabelas com RLS ativo' AS category,
    COUNT(*) AS count
FROM pg_tables 
WHERE schemaname = 'public' 
    AND rowsecurity = true
    AND tablename IN (
        'rdos', 'projects', 'rdo_ai_analysis', 'rdo_tags', 
        'machine_impact', 'company_info', 'insights',
        'maintenance_records', 'schedules', 'machines', 
        'employees', 'service_orders', 'transactions',
        'orcamentos', 'hora_maquina', 'profiles', 'companies'
    )

UNION ALL

SELECT 
    'Tabelas sem RLS' AS category,
    COUNT(*) AS count
FROM pg_tables 
WHERE schemaname = 'public' 
    AND rowsecurity = false
    AND tablename IN (
        'rdos', 'projects', 'rdo_ai_analysis', 'rdo_tags', 
        'machine_impact', 'company_info', 'insights',
        'maintenance_records', 'schedules', 'machines', 
        'employees', 'service_orders', 'transactions',
        'orcamentos', 'hora_maquina', 'profiles', 'companies'
    );

-- ─── 7. Verificar telefone em perfis ─────────────────────────
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as profiles_with_phone
FROM profiles;