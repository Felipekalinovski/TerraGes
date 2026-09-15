# Sincronização Supabase/GitHub e próximo incremento — 14/09/2026

> Registro histórico. Em 15/09, o usuário autorizou o merge com deploy automático: PR #2 integrado na main (`84b9d29`) e produção publicada. A proposta abaixo evoluiu para a migração e telas descritas em [Etapa 3](2026-09-15-service-order-settlement.md).

## Alterações já publicadas
O commit `8b8c393f082ef1222705ef4948090db4677db4b4`, no PR #2, já contém as alterações da etapa 2. Foram conferidos os nomes das migrações `20260914143229_whatsapp_reliable_workflow` e `20260914143438_whatsapp_worker_extension_schema` no banco e no GitHub.

Os nove arquivos efetivamente presentes nos bundles publicados de `wa-agent` v51, `whatsapp-bot` v77 e `whatsapp-worker` v1 foram comparados com o conteúdo do GitHub: correspondência integral. O worker está configurado e o cron permanece ativo.

O procedimento de configuração do endpoint, executado após a publicação anterior, passa a ter um script reproduzível em `supabase/operations/configure-whatsapp-worker.sql`. Ele não inclui nem imprime segredos.

O PR #2 tem checks de Vercel/Netlify aprovados e não apresenta conflitos. O merge não foi executado: a revisão automática rejeitou a ação por distinguir a autorização de commit da autorização de integração na main/deploy. Não houve atualização direta da main nem tentativa alternativa de contornar esse bloqueio.

## Próximo incremento preparado
`supabase/proposals/service_order_settlement.sql` corrige três problemas constatados na rotina atual:
- Uma OS concluída podia ser reaberta e concluída novamente, gerando outra receita.
- O método de pagamento determinava automaticamente o estado pago; isso não comprova recebimento.
- Campos financeiros de uma OS concluída podiam divergir do lançamento gerado.

A proposta cria um registro privado único por conclusão, com vínculo ao lançamento financeiro, responsável e snapshot. A receita começa pendente para qualquer método. O gestor confirma o recebimento no financeiro pelo fluxo existente. O operador não pode concluir a OS; os vínculos por empresa continuam sendo verificados pelos gatilhos e RLS da etapa 1.

OS concluídas não podem ser reabertas, excluídas ou ter seus campos de execução/cobrança alterados silenciosamente. A mesma proteção cobre os valores do lançamento financeiro vinculado; o estado de recebimento continua editável pelo gestor. Horímetros usam o maior valor entre o atual e o serviço, sem regressão ao inserir um serviço antigo.

## Validação e limites
A proposta e a suite original de isolamento foram executadas no banco dentro de uma única transação, com os cenários adicionais de `tests/security/service-order-settlement.sql`. Todos passaram: autorização, empresa estrangeira, confirmação repetida, pagamento pendente para Pix, recebimento explícito, proteção de edição/exclusão, vínculo de auditoria, horas inválidas e horímetro sem regressão.

A transação terminou em ROLLBACK. Verificação posterior: tabela proposta inexistente e zero usuários sintéticos remanescentes. Nenhuma destas novas regras foi aplicada em produção.

O ambiente local está indisponível nesta sessão, portanto não houve build ou teste visual novo. A proposta permanece fora da pasta de migrações automáticas; antes de publicar, deve-se criar a migração pela CLI no ambiente de desenvolvimento, testar as mensagens/controles da tela de OS e aplicar o SQL revisado. O PR é empilhado sobre a branch da etapa 2.

Não há reconciliação automática de lançamentos históricos por título/valor nem alteração de pagamentos anteriores. Ordens já concluídas também ficam protegidas de reabertura, mas não recebem vínculos financeiros inferidos. Uma OS antiga que já estivesse reaberta antes da migração exige conferência histórica. Estorno e ajuste de ordens concluídas precisam de fluxo explícito posterior; não relaxar os bloqueios para corrigir registros.

A proposta não cria novos pagamentos nem envia mensagens. O recebimento real pelo WhatsApp e a rotação da credencial antiga mantêm as pendências registradas na etapa 2.
