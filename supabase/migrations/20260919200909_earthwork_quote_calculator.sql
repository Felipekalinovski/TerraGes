ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS calculation_details jsonb;

COMMENT ON COLUMN public.orcamentos.calculation_details IS
  'Versioned, deterministic memory of an earthwork volume, hauling, hours and pricing estimate.';

ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_calculation_details_shape;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_calculation_details_shape CHECK (
    calculation_details IS NULL OR (
      jsonb_typeof(calculation_details) = 'object'
      AND jsonb_typeof(calculation_details -> 'input') = 'object'
      AND jsonb_typeof(calculation_details -> 'result') = 'object'
      AND (calculation_details ->> 'version') ~ '^[1-9][0-9]*$'
    )
  );

UPDATE public.agent_module_knowledge
SET
  optional_fields = optional_fields || jsonb_build_array(jsonb_build_object(
    'name', 'calculation_details',
    'type', 'earthwork_estimate',
    'versioned', true,
    'description', 'Memória determinística de volumetria, cargas, horas, premissas e composição do preço.'
  )),
  business_rules = business_rules || jsonb_build_array(
    'Cálculo rápido exige comprimento, largura, profundidade média, empolamento, capacidade útil do caminhão, produtividade e eficiência informadas.',
    'Volume no corte = comprimento × largura × profundidade média; volume solto = volume no corte × (1 + empolamento).',
    'Cargas são arredondadas para cima e horas são arredondadas para cima em quartos de hora, respeitando a cobrança mínima.',
    'O resultado é estimativa preliminar: antes do envio, repetir premissas, preço e alertar para vistoria e condições reais.'
  ),
  agent_actions = agent_actions || jsonb_build_array(jsonb_build_object(
    'action', 'calculate_earthwork_quote',
    'mode', 'deterministic_read',
    'manager_only', true,
    'required', jsonb_build_array('length_m','width_m','depth_m','swell_percent','truck_capacity_m3','truck_fill_percent','equipment_name','productivity_m3_per_hour','operational_efficiency_percent','hourly_rate'),
    'optional', jsonb_build_array('minimum_hours','cost_per_truckload','material_cost_per_loose_m3','mobilization_cost','contingency_percent','discount')
  )),
  knowledge_version = knowledge_version + 1,
  updated_at = now()
WHERE module_key = 'orcamentos'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(agent_actions) AS action
    WHERE action ->> 'action' = 'calculate_earthwork_quote'
  );

INSERT INTO public.agent_technical_knowledge (
  knowledge_key, domain, topic, title, summary, guidance, applicability,
  risk_level, requires_model_manual, requires_professional, tags, revision, active
) VALUES (
  'planejamento_orcamento_volumetria',
  'planejamento',
  'orcamento_rapido',
  'Estimativa de volume, cargas, horas e preço',
  'A estimativa rápida separa volume no corte, volume solto, transporte, produtividade efetiva, horas e composição do preço, mantendo todas as premissas visíveis e editáveis.',
  '["Calcular volume no corte por comprimento × largura × profundidade média.","Aplicar empolamento informado para obter volume solto; não inventar o fator.","Calcular cargas com a capacidade útil informada e arredondar para cima.","Calcular horas com produtividade e eficiência informadas, respeitando a cobrança mínima.","Somar máquina, transporte, material, mobilização e contingência, depois subtrair desconto.","Apresentar como estimativa preliminar e pedir confirmação das premissas antes de criar o orçamento."]'::jsonb,
  '{"calculator":"earthwork_quote_v1","volume_basis":{"excavation":"bank_m3","transport":"loose_m3"}}'::jsonb,
  'caution',
  true,
  false,
  ARRAY['orçamento','volumetria','empolamento','cargas','horas','preço'],
  1,
  true
)
ON CONFLICT (knowledge_key) DO UPDATE SET
  summary = EXCLUDED.summary,
  guidance = EXCLUDED.guidance,
  applicability = EXCLUDED.applicability,
  risk_level = EXCLUDED.risk_level,
  requires_model_manual = EXCLUDED.requires_model_manual,
  requires_professional = EXCLUDED.requires_professional,
  tags = EXCLUDED.tags,
  revision = public.agent_technical_knowledge.revision + 1,
  active = true,
  updated_at = now();

INSERT INTO public.agent_technical_knowledge_sources (knowledge_key, source_key, citation_note)
VALUES (
  'planejamento_orcamento_volumetria',
  'dnit_ipr742',
  'Referência técnica geral de terraplenagem; fatores e produtividade devem ser informados conforme a obra e o equipamento.'
)
ON CONFLICT (knowledge_key, source_key) DO UPDATE SET
  citation_note = EXCLUDED.citation_note;
