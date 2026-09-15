# Etapa 3 — conclusão confiável de OS e recebimento

## Problema e comportamento
Reabrir e concluir novamente uma OS gerava receita duplicada. Escolher Pix, cartão, boleto ou dinheiro marcava o valor como pago sem confirmar recebimento. A folha impressa também confundia conclusão com pagamento.

A migração `20260915014620_service_order_settlement.sql`, criada pela CLI Supabase 2.117.0 e alinhada à versão registrada na publicação, estabelece um vínculo privado único entre cada nova conclusão e sua receita, com responsável e snapshot. Somente gestores podem concluir. A receita inicia pendente para qualquer método. A OS concluída não pode ser reaberta, apagada ou ter seus dados de execução/cobrança alterados. O valor vinculado no financeiro também fica protegido; o gestor continua podendo atualizar a situação do recebimento. Serviços antigos não reduzem o horímetro atual.

A tela de OS valida os dados, explica a receita pendente e pede confirmação com o valor antes de concluir. Ordens concluídas ficam disponíveis para consulta. Uma resposta de carregamento antiga não pode substituir os dados de outra OS. A referência permanente do comprovante é preservada no formulário, sem salvar URLs temporárias de visualização.

O financeiro identifica as receitas vinculadas por uma RPC que retorna somente IDs da empresa do gestor. As alterações enviam apenas o status, e a exclusão fica indisponível. O saldo considera somente valores recebidos/pagos. A folha de OS informa a situação do serviço e esclarece que não comprova quitação.

## Segurança e validação
- `npm run test:security`: 22 testes aprovados, incluindo validação de conclusão e regressões do WhatsApp. Job de segurança adicionado ao GitHub Actions com Node 24.
- Build Vite e TypeScript dos quatro componentes alterados e suas dependências: aprovados.
- Migração + `tests/security/isolation.sql` + `tests/security/service-order-settlement.sql`: executados em uma transação no Supabase, terminada em ROLLBACK. Testes de autorização, empresa estrangeira, repetição, recebimento pendente/confirmado, valores/exclusão protegidos, horímetro, auditoria e metadados da RPC aprovados. Zero usuários sintéticos remanescentes.
- RPC pública usa SECURITY INVOKER; a leitura privilegiada fica no schema privado, com auth.uid(), papel de gestor e empresa conferidos, search_path vazio e privilégios explícitos. O registro privado não é acessível diretamente por clientes.
- Advisors antes e depois da publicação: avisos existentes sobre schema pessoal, extensão vector, RPCs anteriores de vínculo WhatsApp e proteção de senhas. Nenhum aviso novo de nível WARN/ERROR após a migração. A tabela privada acrescenta somente o informativo esperado de RLS sem políticas, pois clientes não a consultam diretamente. Nenhuma correção fora desta etapa foi aplicada.
- Verificação visual indisponível: a instalação do Chrome pelo agent-browser falhou por certificado UnknownIssuer. Build e testes não substituem teste visual nem fluxo autenticado completo no navegador.

## Publicação e limites
A migração foi aplicada no Supabase como `20260915014620_service_order_settlement` antes do merge/deploy do frontend. As duas suites SQL foram repetidas sobre a versão instalada, com sucesso e ROLLBACK. O PR #3 integra as telas e o SQL publicado; o deploy automático deve ser conferido pelo SHA integrado na main.

Não há reconciliação automática por título/valor de receitas históricas. OS já concluídas também ficam protegidas; seus vínculos antigos não são inferidos. Ordens antigas que já estivessem reabertas exigem conferência histórica. Estorno e ajuste de OS concluídas precisam de um fluxo explícito posterior.

A configuração segura do recebimento WhatsApp e a rotação da credencial antiga continuam com o estado registrado na etapa 2. Esta atualização não realiza pagamentos nem envia mensagens.

Referência de privilégios e search_path: https://supabase.com/docs/guides/database/functions
