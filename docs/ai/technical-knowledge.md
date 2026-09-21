# Conhecimento técnico do agente TerraGes

Esta etapa adiciona conhecimento técnico rastreável para respostas sobre terraplanagem, solos, planejamento, equipamentos, implementos, segurança, manutenção, diagnóstico e tributação.

## Estrutura

- `agent_knowledge_sources`: órgão, documento, edição, URL oficial e data de verificação.
- `agent_technical_knowledge`: orientação curada, aplicação, nível de risco, tags e necessidade de manual ou profissional.
- `agent_technical_knowledge_sources`: vínculo obrigatório entre orientação e fonte.
- `search_agent_technical_knowledge`: busca textual por assunto e domínio, acessível somente pelo agente servidor.

O conteúdo antigo de `machine_knowledge` não participa da nova busca porque contém números específicos sem referência documental suficiente.

## Domínios

| Domínio | Conteúdo |
|---|---|
| Terminologia | Corte, aterro, empréstimo, bota-fora, estados de volume, taludes e topografia |
| Solos | Identificação preliminar, adequação, umidade, compactação e drenagem |
| Planejamento | Balanço de massas, produtividade, seleção de frota e rotas |
| Equipamentos | Escavadeira, trator de esteiras, carregadeira, motoniveladora, compactadores e transporte |
| Implementos | Caçambas, rompedor, ripper e engate rápido |
| Segurança e normas | NR-11, NR-12, NR-18, interferências, escavações e bloqueio |
| Manutenção | Inspeção, fluidos, filtros, lubrificação, arrefecimento, hidráulica, rodante e histórico |
| Diagnóstico | Separação entre sintoma, causa possível, verificação e diagnóstico confirmado |
| Tributação | CNAE, ISS, Simples Nacional e NFS-e, sempre com validação contábil |

## Política de resposta

O agente pode explicar conceitos gerais e organizar uma verificação. Valores de pressão, torque, fluido, capacidade, peça, intervalo, código de falha, inclinação segura ou limite operacional exigem fabricante, modelo, série e documento aplicável. Situações de risco recebem orientação de parada segura e encaminhamento ao responsável da obra ou da manutenção.

Questões tributárias exigem atividade real, município, regime e período. O agente pode coletar dados e preparar um rascunho, mas não define enquadramento, alíquota ou emissão fiscal sem integração específica e validação contábil.

## Fontes iniciais

- DNIT/IPR 742, versão corrigida em abril de 2025.
- NR-11, NR-12 e NR-18 do Ministério do Trabalho e Emprego.
- Lei Complementar 116/2003.
- Resolução CGSN 140/2018 e Portal do Simples Nacional.
- Portal Nacional da NFS-e.
- Consulta CNAE da Receita Federal/IBGE-CONCLA.
