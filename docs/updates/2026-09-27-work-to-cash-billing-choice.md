# Work-to-Cash — escolha fiscal por serviço

Implementado em 27/09/2026.

## Fluxo
Serviço/OS -> medição -> documento -> cobrança -> recebimento -> conciliação.

Cada OS tem `billing_document_type`:
- `nfse`: prepara NFS-e e exige aprovação fiscal antes de qualquer emissão.
- `receipt`: gera OS/recibo e não dispara NFS-e.
- `deferred`: mantém o faturamento para uma etapa posterior.

O padrão de novas OS é `receipt`, adequado ao caso de serviços pequenos quando a empresa optar por não emitir NFS-e naquele lançamento. Isso não transforma o recibo em documento fiscal nem dispensa obrigação legal aplicável.

## Banco
Criadas as tabelas `service_measurements`, `service_measurement_items`, `billing_documents`, `billing_charges` e `payment_reconciliations`, todas isoladas por empresa e restritas a gestores.

A conclusão de OS continua gerando receita pendente. Ela também cria o estado documental correspondente:
- NFS-e -> `awaiting_approval`
- OS/recibo -> `ready`
- faturar depois -> `deferred`

## WhatsApp
O agente pergunta a escolha fiscal ao criar OS, mostra essa escolha na prévia e só grava após CONFIRMAR. O valor do documento não é calculado pela LLM; usa os valores determinísticos da OS.

A integração efetiva com emissor NFS-e permanece desacoplada e deverá exigir provedor/credenciais e aprovação de gestor.
