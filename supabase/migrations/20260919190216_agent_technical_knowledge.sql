CREATE TABLE public.agent_knowledge_sources (
  source_key text PRIMARY KEY CHECK (source_key ~ '^[a-z][a-z0-9_]*$'),
  authority text NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual','regulation','law','official_portal')),
  document_code text,
  edition text,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  published_on date,
  verified_on date NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_technical_knowledge (
  knowledge_key text PRIMARY KEY CHECK (knowledge_key ~ '^[a-z][a-z0-9_]*$'),
  domain text NOT NULL CHECK (domain IN (
    'terminologia','solos','planejamento','equipamentos','implementos',
    'seguranca_normas','manutencao','diagnostico','tributacao'
  )),
  topic text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 20 AND 2000),
  guidance jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(guidance) = 'array'),
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(applicability) = 'object'),
  risk_level text NOT NULL CHECK (risk_level IN ('general','caution','critical')),
  requires_model_manual boolean NOT NULL DEFAULT false,
  requires_professional boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_technical_knowledge_sources (
  knowledge_key text NOT NULL REFERENCES public.agent_technical_knowledge(knowledge_key) ON DELETE CASCADE,
  source_key text NOT NULL REFERENCES public.agent_knowledge_sources(source_key) ON DELETE RESTRICT,
  citation_note text,
  PRIMARY KEY (knowledge_key, source_key)
);

COMMENT ON TABLE public.agent_technical_knowledge IS
  'Curated technical guidance for the TerraGes agent. Model-specific specifications require the applicable OEM manual.';

ALTER TABLE public.agent_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_technical_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_technical_knowledge_sources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_knowledge_sources, public.agent_technical_knowledge,
  public.agent_technical_knowledge_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_knowledge_sources, public.agent_technical_knowledge,
  public.agent_technical_knowledge_sources TO service_role;

CREATE POLICY agent_sources_no_client_access ON public.agent_knowledge_sources
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agent_technical_no_client_access ON public.agent_technical_knowledge
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agent_technical_sources_no_client_access ON public.agent_technical_knowledge_sources
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO public.agent_knowledge_sources
  (source_key,authority,title,source_type,document_code,edition,source_url,published_on,verified_on,notes)
VALUES
('dnit_ipr742','DNIT/IPR','Manual de Implantação Básica de Rodovia','manual','IPR 742','Versão corrigida com errata 1, abril de 2025','https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/ipr/coletanea-de-manuais/errata-da-publicacao-ipr-742-2014-manual-de-implantacao-basica-de-rodovia','2025-04-24','2026-09-19','Referência geral para implantação rodoviária e terraplenagem; o projeto e a especificação contratual prevalecem.'),
('mte_nr11','Ministério do Trabalho e Emprego','Norma Regulamentadora nº 11 — Transporte, Movimentação, Armazenagem e Manuseio de Materiais','regulation','NR-11','Página oficial vigente','https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-11-nr-11',NULL,'2026-09-19','Consultar sempre o texto e anexos vigentes.'),
('mte_nr12','Ministério do Trabalho e Emprego','Norma Regulamentadora nº 12 — Segurança no Trabalho em Máquinas e Equipamentos','regulation','NR-12','Página atualizada em janeiro de 2025','https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-12-nr-12','2025-01-21','2026-09-19','Base de segurança em máquinas; não substitui análise de risco nem manual do fabricante.'),
('mte_nr18','Ministério do Trabalho e Emprego','Norma Regulamentadora nº 18 — Segurança e Saúde no Trabalho na Indústria da Construção','regulation','NR-18','Texto atualizado em 2025','https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-18-nr-18','2025-01-03','2026-09-19','Inclui requisitos para escavações e canteiros; consultar o PGR e profissional legalmente habilitado.'),
('planalto_lc116','Presidência da República','Lei Complementar nº 116, de 31 de julho de 2003','law','LC 116/2003','Texto compilado vigente','https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm','2003-07-31','2026-09-19','Base nacional do ISS; legislação municipal e enquadramento concreto precisam ser conferidos.'),
('receita_cgsn140','Receita Federal / Comitê Gestor do Simples Nacional','Resolução CGSN nº 140, de 22 de maio de 2018','regulation','CGSN 140/2018','Texto oficial consolidado','https://normas.receita.fazenda.gov.br/','2018-05-22','2026-09-19','Regras do Simples mudam; confirmar texto vigente, CNAE, regime e período de apuração.'),
('gov_nfse','Portal Nacional da NFS-e','Portal da Nota Fiscal de Serviço eletrônica','official_portal','NFS-e','Portal nacional vigente','https://www.gov.br/nfse/pt-br',NULL,'2026-09-19','Documentação e acesso ao padrão nacional; disponibilidade e regras dependem do município e do contribuinte.'),
('ibge_cnae','IBGE/CONCLA e Receita Federal','Classificação Nacional de Atividades Econômicas — CNAE','official_portal','CNAE','Consulta oficial','https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cnpj/classificacao-nacional-de-atividades-economicas-2013-cnae','2023-06-23','2026-09-19','A escolha cadastral deve refletir as atividades efetivamente exercidas e ser validada por profissional contábil.');

WITH entries(knowledge_key,domain,topic,title,summary,guidance,applicability,risk_level,requires_model_manual,requires_professional,tags,source_key) AS (VALUES
('termos_corte_aterro','terminologia','movimentacao_terra','Corte e aterro','Corte é a retirada de material para atingir a geometria de projeto; aterro é a colocação controlada de material para formar a geometria prevista.',
 '["Associar sempre à seção, cota e estaca do projeto.","Registrar origem, destino e condição do material.","Não tratar todo material de corte como automaticamente adequado ao aterro."]'::jsonb,'{"scope":"earthworks"}'::jsonb,'general',false,false,ARRAY['corte','aterro','escavação','movimentação de terra'],'dnit_ipr742'),
('termos_emprestimo_bota_fora','terminologia','origem_destino','Empréstimo, jazida e bota-fora','Empréstimo ou jazida fornece material; bota-fora recebe material excedente ou inadequado conforme projeto, licenciamento e destinação autorizada.',
 '["Registrar local, distância de transporte e autorização.","Não indicar descarte sem verificar licenciamento e regras ambientais."]'::jsonb,'{"scope":"earthworks"}'::jsonb,'caution',false,true,ARRAY['empréstimo','jazida','bota-fora','descarte','material excedente'],'dnit_ipr742'),
('termos_volumes','terminologia','volumes','Volume em banco, solto e compactado','O mesmo solo ocupa volumes diferentes no terreno natural, depois de escavado e após compactação.',
 '["Identificar sempre o estado do volume.","Não converter volumes sem fator medido, especificação ou fonte aplicável.","Guardar unidade e método de levantamento."]'::jsonb,'{"units":["m3 banco","m3 solto","m3 compactado"]}'::jsonb,'caution',false,true,ARRAY['volume','empolamento','contração','banco','solto','compactado'],'dnit_ipr742'),
('termos_talude_berma','terminologia','geometria','Talude, berma e banqueta','Talude é uma superfície inclinada de corte ou aterro; bermas e banquetas são elementos geométricos previstos no projeto para estabilidade, drenagem ou operação.',
 '["Não sugerir inclinação universal.","Geometria depende de projeto geotécnico, solo, água, altura e carregamentos."]'::jsonb,'{"scope":"slopes"}'::jsonb,'critical',false,true,ARRAY['talude','berma','banqueta','inclinação','estabilidade'],'dnit_ipr742'),
('termos_greide_cota_estaca','terminologia','topografia','Greide, cota e estaca','Greide descreve o perfil de projeto; cota é a elevação de referência; estaca localiza uma seção ao longo do eixo.',
 '["Repetir datum, unidade e referência quando disponíveis.","Não calcular execução com coordenadas ou cotas ambíguas."]'::jsonb,'{"scope":"survey"}'::jsonb,'caution',false,true,ARRAY['greide','cota','estaca','perfil','topografia'],'dnit_ipr742'),
('solos_identificacao','solos','identificacao','Identificação inicial do material','A descrição de campo pode registrar aparência, granulometria aparente, plasticidade percebida, umidade, matéria orgânica e presença de blocos, mas não substitui ensaio.',
 '["Tratar foto ou relato como observação preliminar.","Pedir localização e condição de umidade.","Classificação de projeto depende de investigação e ensaios aplicáveis."]'::jsonb,'{"scope":"field_observation"}'::jsonb,'caution',false,true,ARRAY['solo','argila','silte','areia','cascalho','classificação'],'dnit_ipr742'),
('solos_adequacao','solos','adequacao','Adequação do solo ao uso','A aptidão de um material para aterro, camada final, subleito ou drenagem depende das exigências do projeto e dos resultados de controle.',
 '["Não aprovar material apenas por aparência.","Conferir especificação, ensaios e restrições de matéria orgânica ou materiais indesejáveis."]'::jsonb,'{"scope":"quality_control"}'::jsonb,'critical',false,true,ARRAY['solo adequado','subleito','aterro','ensaio','controle tecnológico'],'dnit_ipr742'),
('solos_umidade_compactacao','solos','compactacao','Umidade e compactação','A eficiência da compactação depende do material, da umidade, da energia, da espessura da camada e do equipamento.',
 '["Não prescrever número universal de passadas.","Comparar umidade e grau de compactação com o critério do projeto.","Ajustar método somente com controle de campo e responsável técnico."]'::jsonb,'{"scope":"compaction"}'::jsonb,'critical',false,true,ARRAY['umidade ótima','compactação','grau de compactação','passadas'],'dnit_ipr742'),
('solos_drenagem','solos','agua','Água no solo e drenagem provisória','Água superficial ou subterrânea altera trabalhabilidade, suporte e estabilidade e precisa ser controlada durante a execução.',
 '["Registrar chuva, surgência, bombeamento e trechos saturados.","Evitar continuidade automática da operação quando houver perda de suporte ou estabilidade.","Seguir projeto de drenagem e orientação técnica."]'::jsonb,'{"scope":"earthworks"}'::jsonb,'critical',false,true,ARRAY['água','chuva','saturado','drenagem','bombeamento'],'dnit_ipr742'),
('planejamento_balanco_massas','planejamento','massas','Balanço de massas','O planejamento compara volumes utilizáveis de corte, demanda de aterro, empréstimos, descartes e distâncias de transporte.',
 '["Separar volumes por condição e qualidade.","Incluir perdas e fatores apenas quando documentados.","Recalcular quando topografia ou projeto mudar."]'::jsonb,'{"scope":"planning"}'::jsonb,'caution',false,true,ARRAY['balanço de massas','cubação','corte aterro','distância média'],'dnit_ipr742'),
('planejamento_ciclo_produtividade','planejamento','produtividade','Ciclo e produtividade','Produtividade resulta da capacidade efetiva por ciclo, duração do ciclo, eficiência operacional e condições da frente.',
 '["Cronometrar carga, deslocamento, descarga e retorno.","Registrar espera, manobra, distância, inclinação, piso, clima e operador.","Estimativa não deve ser apresentada como produção medida."]'::jsonb,'{"formula":"capacidade_efetiva * ciclos_por_hora * eficiencia"}'::jsonb,'caution',true,false,ARRAY['produtividade','ciclo','produção','tempo de ciclo','eficiência'],'dnit_ipr742'),
('planejamento_selecao_equipamento','planejamento','selecao','Seleção de equipamento','A seleção depende do material, volume, geometria, alcance, distância de transporte, acesso, suporte do terreno, acabamento e prazo.',
 '["Levantar condições antes de recomendar.","Verificar capacidade e limites no manual do modelo.","Balancear produção entre escavação, transporte, espalhamento e compactação."]'::jsonb,'{"scope":"fleet_planning"}'::jsonb,'caution',true,true,ARRAY['seleção','dimensionamento','equipamento','frota'],'dnit_ipr742'),
('planejamento_rota_transporte','planejamento','transporte','Rota e frente de transporte','A rota deve considerar largura, capacidade de suporte, inclinação, cruzamentos, visibilidade, drenagem e segregação entre pessoas e máquinas.',
 '["Definir circulação, sinalização e pontos de espera.","Registrar mudança de rota que altere ciclo ou risco.","Não recomendar velocidade sem plano e limites aplicáveis."]'::jsonb,'{"scope":"haul_road"}'::jsonb,'critical',true,true,ARRAY['rota','transporte','caminhão','acesso','tráfego'],'mte_nr11'),
('equipamento_escavadeira','equipamentos','escavacao','Escavadeira hidráulica','Indicada para escavar, carregar e conformar dentro do alcance e da configuração permitidos pelo fabricante.',
 '["Verificar solo, profundidade, alcance, raio de giro, estabilidade e capacidade de içamento quando aplicável.","Caçamba, lança e implemento alteram capacidade e limites.","Nunca inferir tabela de carga sem modelo, configuração e manual."]'::jsonb,'{"equipment":["excavator"]}'::jsonb,'critical',true,true,ARRAY['escavadeira','caçamba','alcance','giro'],'mte_nr12'),
('equipamento_trator_esteira','equipamentos','empurrar_espalhar','Trator de esteiras','Usado para desmonte leve com lâmina ou ripper, empurrar, espalhar e conformar material em distâncias compatíveis com o planejamento.',
 '["Produtividade varia com distância, inclinação, material, lâmina e tração.","Verificar limites de inclinação e operação no manual."]'::jsonb,'{"equipment":["dozer"]}'::jsonb,'caution',true,true,ARRAY['trator de esteira','bulldozer','lâmina','empurrar'],'dnit_ipr742'),
('equipamento_carregadeira','equipamentos','carregamento','Pá-carregadeira','Usada em carregamento, movimentação curta e manejo de materiais, respeitando estabilidade, caçamba e terreno.',
 '["Verificar densidade do material e capacidade nominal da configuração.","Evitar deslocamento com carga elevada.","Conferir pneus, articulação, freios e visibilidade."]'::jsonb,'{"equipment":["wheel_loader"]}'::jsonb,'critical',true,true,ARRAY['pá carregadeira','carregadeira','caçamba','carregamento'],'mte_nr12'),
('equipamento_motoniveladora','equipamentos','acabamento','Motoniveladora','Usada para espalhamento, regularização, acabamento e conservação de superfícies e valetas conforme projeto.',
 '["Controle depende de referências topográficas e sequência de passadas.","Não usar acabamento visual como substituto do controle de cota e inclinação."]'::jsonb,'{"equipment":["motor_grader"]}'::jsonb,'caution',true,true,ARRAY['motoniveladora','patrol','acabamento','greide'],'dnit_ipr742'),
('equipamento_compactador','equipamentos','compactacao','Equipamentos de compactação','Rolos lisos, pé-de-carneiro, pneumáticos e placas atendem materiais e espaços distintos.',
 '["Escolher tipo conforme material, camada e especificação.","Passadas e amplitude/frequência dependem de teste e manual.","Confirmar compactação por controle previsto, não pelo aspecto superficial."]'::jsonb,'{"equipment":["roller","plate_compactor"]}'::jsonb,'critical',true,true,ARRAY['rolo','compactador','pé de carneiro','pneumático','placa'],'dnit_ipr742'),
('equipamento_transporte','equipamentos','transporte','Caminhões e transportadores','A capacidade efetiva de transporte depende do equipamento, densidade do material, distribuição da carga, rota e limites legais e operacionais.',
 '["Não usar apenas volume nominal para definir peso.","Evitar sobrecarga e derramamento.","Conferir condição da caçamba, pneus, freios e basculamento seguro."]'::jsonb,'{"equipment":["truck","articulated_hauler"]}'::jsonb,'critical',true,true,ARRAY['caminhão','basculante','articulado','carga','transporte'],'mte_nr11'),
('implemento_cacambas','implementos','cacambas','Caçambas','Caçambas de escavação, limpeza, rocha e carregamento possuem geometria, dentes, largura e capacidade diferentes.',
 '["Selecionar pelo material e serviço.","Confirmar compatibilidade, massa, capacidade e limites no manual e na placa do implemento.","Não usar caçamba larga como regra para todo acabamento."]'::jsonb,'{"attachments":["bucket"]}'::jsonb,'caution',true,true,ARRAY['caçamba','dentes','limpeza','rocha'],'mte_nr12'),
('implemento_rompedor','implementos','rompimento','Rompedor hidráulico','O rompedor exige compatibilidade hidráulica e estrutural, ferramenta correta, lubrificação e técnica prevista pelo fabricante.',
 '["Confirmar vazão, pressão, massa portante e instalação.","Não orientar regulagem por valor genérico.","Trincas, vazamentos, aquecimento ou fixação anormal exigem parada e inspeção."]'::jsonb,'{"attachments":["hydraulic_breaker"]}'::jsonb,'critical',true,true,ARRAY['rompedor','martelo hidráulico','demolição','rocha'],'mte_nr12'),
('implemento_ripper','implementos','escarificacao','Ripper ou escarificador','O ripper rompe ou desagrega materiais antes da movimentação quando a condição permite.',
 '["Avaliar material, espaçamento, profundidade e tração.","Não substituir avaliação de desmonte de rocha por recomendação genérica.","Verificar limites do conjunto no manual."]'::jsonb,'{"attachments":["ripper"]}'::jsonb,'caution',true,true,ARRAY['ripper','escarificador','desagregar','rocha'],'dnit_ipr742'),
('implemento_engate_rapido','implementos','acoplamento','Engate rápido e troca de implementos','Troca de implementos exige procedimento, bloqueio, inspeção do acoplamento e teste seguro antes do uso.',
 '["Confirmar travamento visual e conforme indicador do fabricante.","Manter pessoas fora da zona de risco.","Não operar se houver folga, pino ou trava duvidosa."]'::jsonb,'{"attachments":["quick_coupler"]}'::jsonb,'critical',true,true,ARRAY['engate rápido','troca de implemento','pino','trava'],'mte_nr12'),
('seguranca_escavacoes','seguranca_normas','escavacoes','Planejamento seguro de escavações','Escavações exigem análise de riscos, medidas definidas no PGR, estabilidade, acessos, isolamento e consideração de estruturas e redes próximas.',
 '["Verificar projeto e profissional legalmente habilitado quando exigido.","Interromper diante de trincas, desprendimento, entrada de água ou condição não prevista.","Não fornecer inclinação ou escoramento universal."]'::jsonb,'{"regulation":"NR-18"}'::jsonb,'critical',false,true,ARRAY['NR-18','escavação','PGR','escoramento','estabilidade'],'mte_nr18'),
('seguranca_redes_interferencias','seguranca_normas','interferencias','Redes e interferências','Antes de escavar, devem ser identificadas interferências como energia, água, esgoto, gás, telecomunicações, fundações e estruturas próximas.',
 '["Confirmar levantamento e liberação da área.","Tratar rede desconhecida como risco e suspender a escavação no ponto.","Monitorar estruturas próximas conforme planejamento."]'::jsonb,'{"regulation":"NR-18"}'::jsonb,'critical',false,true,ARRAY['rede elétrica','tubulação','interferência','escavação'],'mte_nr18'),
('seguranca_maquinas','seguranca_normas','maquinas','Operação segura de máquinas','Máquinas devem manter proteções, dispositivos, sinalização, manual, inspeção e condições de operação previstas.',
 '["Operador deve estar autorizado e capacitado conforme requisitos aplicáveis.","Não neutralizar proteção ou alarme.","Defeito de segurança exige bloqueio da operação e comunicação."]'::jsonb,'{"regulation":"NR-12"}'::jsonb,'critical',true,true,ARRAY['NR-12','segurança','proteção','alarme','operador'],'mte_nr12'),
('seguranca_manutencao_bloqueio','seguranca_normas','bloqueio','Bloqueio para manutenção','Intervenção exige máquina em condição segura, energias controladas e prevenção de acionamento ou movimento inesperado.',
 '["Aplicar o procedimento de bloqueio da empresa e do fabricante.","Apoiar ou travar componentes elevados conforme procedimento.","Liberar somente após inspeção, retirada de pessoas e reinstalação das proteções."]'::jsonb,'{"regulation":"NR-12"}'::jsonb,'critical',true,true,ARRAY['bloqueio','energia zero','manutenção','LOTO'],'mte_nr12'),
('manutencao_inspecao_diaria','manutencao','inspecao','Inspeção antes da operação','A inspeção diária deve procurar vazamentos, danos, folgas, pneus ou esteiras, níveis, iluminação, alarmes, freios, acesso e itens indicados pelo fabricante.',
 '["Registrar anomalia e horímetro.","Não declarar máquina liberada quando item de segurança falhar.","Usar o checklist do modelo como referência final."]'::jsonb,'{"frequency":"before_shift"}'::jsonb,'critical',true,true,ARRAY['checklist','inspeção diária','vazamento','freio','alarme'],'mte_nr12'),
('manutencao_fluidos_filtros','manutencao','fluidos','Fluidos e filtros','Tipo, especificação, capacidade e intervalo de fluidos e filtros variam por modelo, número de série, ambiente e programa de análise.',
 '["Solicitar fabricante, modelo, série e manual.","Não reutilizar intervalo ou peça de outro modelo.","Registrar produto, quantidade, horímetro e responsável."]'::jsonb,'{"scope":"model_specific"}'::jsonb,'critical',true,true,ARRAY['óleo','filtro','fluido','intervalo','capacidade'],'mte_nr12'),
('manutencao_lubrificacao','manutencao','lubrificacao','Lubrificação de articulações','Pontos, graxa, frequência e método dependem do equipamento e do implemento.',
 '["Limpar o ponto antes de aplicar.","Investigar ponto que não aceita graxa ou apresenta folga.","Usar diagrama e produto definidos no manual."]'::jsonb,'{"scope":"model_specific"}'::jsonb,'caution',true,true,ARRAY['graxa','lubrificação','pino','bucha'],'mte_nr12'),
('manutencao_arrefecimento','manutencao','arrefecimento','Aquecimento e sistema de arrefecimento','Temperatura alta pode envolver obstrução, nível, vazamento, ventilação, correia, bomba, sensor ou carga operacional; não há diagnóstico único pelo sintoma.',
 '["Seguir o procedimento de parada do fabricante.","Não abrir sistema pressurizado quente.","Registrar temperatura, alarmes, carga e condições ambientais para diagnóstico técnico."]'::jsonb,'{"symptom":"overheating"}'::jsonb,'critical',true,true,ARRAY['superaquecimento','radiador','arrefecimento','temperatura'],'mte_nr12'),
('manutencao_hidraulica','manutencao','hidraulica','Sistema hidráulico','Lentidão, ruído, aquecimento ou perda de força podem ter várias causas e exigem inspeção, códigos, medições e procedimento seguro.',
 '["Nunca procurar vazamento pressurizado com a mão.","Baixar implementos e controlar energia antes da intervenção.","Pressões e testes somente conforme manual e por pessoa qualificada."]'::jsonb,'{"system":"hydraulic"}'::jsonb,'critical',true,true,ARRAY['hidráulico','pressão','mangueira','vazamento','bomba'],'mte_nr12'),
('manutencao_rodante_pneus','manutencao','rodante','Material rodante e pneus','Desgaste do material rodante ou pneus depende de terreno, tensão ou pressão, alinhamento, carga, velocidade, giro e limpeza.',
 '["Registrar padrão e posição do desgaste.","Não informar tensão, pressão ou limite sem manual.","Dano estrutural, cabo exposto ou componente solto exige avaliação antes de operar."]'::jsonb,'{"systems":["undercarriage","tires"]}'::jsonb,'critical',true,true,ARRAY['esteira','material rodante','pneu','desgaste','tensão'],'mte_nr12'),
('manutencao_registro_horimetro','manutencao','registro','Histórico e horímetro','Manutenção confiável depende de horímetro, data, sintomas, códigos, peças, fluidos, medições, responsável e resultado após o serviço.',
 '["Distinguir horímetro acumulado de horas trabalhadas no dia.","Não reduzir horímetro sem correção auditada.","Anexar evidência e relacionar a máquina correta."]'::jsonb,'{"integration":"TerraGes maintenance_records"}'::jsonb,'general',false,false,ARRAY['horímetro','histórico','ordem de manutenção','registro'],'mte_nr12'),
('diagnostico_classificacao','diagnostico','triagem','Classificação de sintomas e urgência','O agente deve separar sintoma observado, possíveis causas, verificações seguras e diagnóstico confirmado.',
 '["Crítico: risco a pessoas, perda de controle, baixa pressão vital, superaquecimento severo, incêndio ou dano estrutural; orientar parada segura.","Atenção: desempenho anormal sem risco imediato identificado; limitar e inspecionar conforme manual.","Informativo: dúvida operacional sem anomalia; responder com fonte e contexto."]'::jsonb,'{"levels":["critical","caution","general"]}'::jsonb,'critical',true,true,ARRAY['diagnóstico','sintoma','urgência','falha','causa'],'mte_nr12'),
('diagnostico_codigos','diagnostico','codigos','Códigos de falha e alarmes','O significado de código depende de fabricante, família, modelo, série, módulo eletrônico e versão do manual.',
 '["Solicitar foto do painel, código exato, modelo e série.","Não reutilizar tabela de código de outra máquina.","Alarmes críticos seguem a orientação do painel e do manual; o agente não deve ensinar a apagar falha sem corrigir a causa."]'::jsonb,'{"scope":"model_specific"}'::jsonb,'critical',true,true,ARRAY['código de falha','alarme','painel','diagnóstico'],'mte_nr12'),
('tributacao_classificacao_servico','tributacao','classificacao','Classificação fiscal do serviço','Tributação depende da atividade efetiva, CNAE cadastrado, item da lista de serviços, município, regime e contrato.',
 '["Coletar município de incidência, descrição real do serviço, regime, CNAE e período.","Não escolher CNAE ou item de serviço apenas para reduzir imposto.","Encaminhar cálculo e enquadramento para contador responsável."]'::jsonb,'{"jurisdiction":"Brazil"}'::jsonb,'critical',false,true,ARRAY['imposto','CNAE','serviço','enquadramento','contador'],'ibge_cnae'),
('tributacao_iss','tributacao','iss','ISS em serviços','A LC 116 fornece regras nacionais do ISS e lista de serviços, mas a incidência e a alíquota aplicável exigem leitura da legislação municipal e do caso.',
 '["Não responder com alíquota universal.","Confirmar município competente, item do serviço, retenção e cadastro do prestador.","Registrar a fonte e a data da consulta."]'::jsonb,'{"tax":"ISS"}'::jsonb,'critical',false,true,ARRAY['ISS','ISSQN','alíquota','retenção','município'],'planalto_lc116'),
('tributacao_simples','tributacao','simples_nacional','Simples Nacional','A apuração no Simples depende de opção válida, receita, atividade, anexos, segregações e regras vigentes no período.',
 '["Não inferir anexo ou alíquota somente pelo nome terraplanagem.","Confirmar CNAEs, receitas e enquadramento com a contabilidade.","Usar a norma vigente no período de apuração."]'::jsonb,'{"tax_regime":"Simples Nacional"}'::jsonb,'critical',false,true,ARRAY['Simples Nacional','DAS','anexo','alíquota efetiva'],'receita_cgsn140'),
('tributacao_nfse','tributacao','documento_fiscal','NFS-e','A emissão deve refletir prestador, tomador, município, item do serviço, valores, retenções e regras do emissor aplicável.',
 '["Não emitir ou alterar nota sem dados fiscais completos e autorização.","Validar se o município usa o padrão nacional ou sistema próprio.","O agente pode preparar rascunho; a emissão exige confirmação e integração fiscal específica."]'::jsonb,'{"document":"NFS-e"}'::jsonb,'critical',false,true,ARRAY['NFS-e','nota fiscal','tomador','retenção','município'],'gov_nfse')
)
INSERT INTO public.agent_technical_knowledge
  (knowledge_key,domain,topic,title,summary,guidance,applicability,risk_level,requires_model_manual,requires_professional,tags)
SELECT knowledge_key,domain,topic,title,summary,guidance,applicability,risk_level,requires_model_manual,requires_professional,tags
FROM entries;

WITH links(knowledge_key,source_key) AS (VALUES
('termos_corte_aterro','dnit_ipr742'),('termos_emprestimo_bota_fora','dnit_ipr742'),('termos_volumes','dnit_ipr742'),
('termos_talude_berma','dnit_ipr742'),('termos_greide_cota_estaca','dnit_ipr742'),('solos_identificacao','dnit_ipr742'),
('solos_adequacao','dnit_ipr742'),('solos_umidade_compactacao','dnit_ipr742'),('solos_drenagem','dnit_ipr742'),
('planejamento_balanco_massas','dnit_ipr742'),('planejamento_ciclo_produtividade','dnit_ipr742'),('planejamento_selecao_equipamento','dnit_ipr742'),
('planejamento_rota_transporte','mte_nr11'),('planejamento_rota_transporte','mte_nr18'),('equipamento_escavadeira','mte_nr12'),
('equipamento_trator_esteira','dnit_ipr742'),('equipamento_trator_esteira','mte_nr12'),('equipamento_carregadeira','mte_nr12'),
('equipamento_motoniveladora','dnit_ipr742'),('equipamento_motoniveladora','mte_nr12'),('equipamento_compactador','dnit_ipr742'),
('equipamento_compactador','mte_nr12'),('equipamento_transporte','mte_nr11'),('equipamento_transporte','mte_nr12'),
('implemento_cacambas','mte_nr12'),('implemento_rompedor','mte_nr12'),('implemento_ripper','dnit_ipr742'),
('implemento_ripper','mte_nr12'),('implemento_engate_rapido','mte_nr12'),('seguranca_escavacoes','mte_nr18'),
('seguranca_redes_interferencias','mte_nr18'),('seguranca_maquinas','mte_nr12'),('seguranca_manutencao_bloqueio','mte_nr12'),
('manutencao_inspecao_diaria','mte_nr12'),('manutencao_fluidos_filtros','mte_nr12'),('manutencao_lubrificacao','mte_nr12'),
('manutencao_arrefecimento','mte_nr12'),('manutencao_hidraulica','mte_nr12'),('manutencao_rodante_pneus','mte_nr12'),
('manutencao_registro_horimetro','mte_nr12'),('diagnostico_classificacao','mte_nr12'),('diagnostico_codigos','mte_nr12'),
('tributacao_classificacao_servico','ibge_cnae'),('tributacao_classificacao_servico','planalto_lc116'),
('tributacao_iss','planalto_lc116'),('tributacao_simples','receita_cgsn140'),('tributacao_nfse','gov_nfse'),('tributacao_nfse','planalto_lc116')
)
INSERT INTO public.agent_technical_knowledge_sources(knowledge_key,source_key)
SELECT knowledge_key,source_key FROM links;

CREATE INDEX agent_technical_knowledge_domain_idx
  ON public.agent_technical_knowledge(domain) WHERE active;
CREATE INDEX agent_technical_knowledge_tags_idx
  ON public.agent_technical_knowledge USING gin(tags);
CREATE INDEX agent_technical_knowledge_search_idx
  ON public.agent_technical_knowledge USING gin(
    to_tsvector('portuguese', title || ' ' || summary)
  );
CREATE INDEX agent_technical_sources_source_idx
  ON public.agent_technical_knowledge_sources(source_key);

CREATE OR REPLACE FUNCTION public.search_agent_technical_knowledge(
  p_query text DEFAULT NULL,
  p_domains text[] DEFAULT NULL,
  p_limit integer DEFAULT 8
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH input AS (
    SELECT nullif(trim(p_query),'') AS query,
      greatest(1,least(coalesce(p_limit,8),20)) AS result_limit
  ), ranked AS (
    SELECT k.*,
      CASE WHEN i.query IS NULL THEN 0::real ELSE
        ts_rank_cd(
          to_tsvector('portuguese',k.title || ' ' || k.summary),
          websearch_to_tsquery('portuguese',i.query)
        ) END AS rank
    FROM public.agent_technical_knowledge k CROSS JOIN input i
    WHERE k.active
      AND (p_domains IS NULL OR k.domain = ANY(p_domains))
      AND (i.query IS NULL OR
        to_tsvector('portuguese',k.title || ' ' || k.summary)
          @@ websearch_to_tsquery('portuguese',i.query)
        OR array_to_string(k.tags,' ') ILIKE '%' || i.query || '%')
    ORDER BY rank DESC,k.knowledge_key
    LIMIT (SELECT result_limit FROM input)
  )
  SELECT coalesce(jsonb_agg(
    (to_jsonb(r) - 'rank') || jsonb_build_object('sources',(
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'source_key',s.source_key,'authority',s.authority,'title',s.title,
        'document_code',s.document_code,'edition',s.edition,'url',s.source_url,
        'verified_on',s.verified_on
      ) ORDER BY s.source_key),'[]'::jsonb)
      FROM public.agent_technical_knowledge_sources l
      JOIN public.agent_knowledge_sources s ON s.source_key=l.source_key AND s.active
      WHERE l.knowledge_key=r.knowledge_key
    )) ORDER BY r.rank DESC,r.knowledge_key
  ),'[]'::jsonb)
  FROM ranked r;
$$;

REVOKE ALL ON FUNCTION public.search_agent_technical_knowledge(text,text[],integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_agent_technical_knowledge(text,text[],integer)
  TO service_role;

UPDATE public.agent_module_knowledge
SET source_tables=ARRAY['agent_technical_knowledge','agent_knowledge_sources'],
    knowledge_version=2,
    updated_at=now(),
    business_rules=business_rules || '["Toda resposta técnica deve trazer as fontes retornadas pela busca.","Os registros legados de machine_knowledge não são fonte aprovada até revisão documental.","Perguntas tributárias exigem município, atividade, regime e período; cálculo ou enquadramento precisa de contador."]'::jsonb
WHERE module_key='conhecimento_tecnico';
