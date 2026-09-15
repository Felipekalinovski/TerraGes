# Etapa 2 — retomada e confirmação de lançamentos

Base: merge `6877af0` do PR #1. Implementada em 14/09/2026.

## Comportamento

- O webhook autentica o provedor, resolve o vínculo verificado e grava evento e tarefa na mesma transação. Retorna 202 depois da persistência. Reentregas mantêm o conteúdo original.
- O processamento ocorre em background; uma fila privada permite recuperar interrupções. Cada tentativa recebe uma concessão de três minutos e um token exclusivo. Resultado/checkpoint de tentativa vencida não sobrescreve a tentativa nova. Um único trabalho por usuário é processado por vez; não há contexto conversacional nem promessa de ordenação de chegada do provedor.
- Falhas temporárias têm espera progressiva (60, 120, 240, 480 segundos) e no máximo cinco tentativas. Arquivos recusados não entram em repetição automática. O cron consulta a fila a cada minuto e solicita um trabalho por chamada; sem tarefas, não chama Edge nem IA. A primeira tentativa também é acionada pelo recebimento.
- Mídia já validada e armazenada é reutilizada. O telefone/JID e os dados de recuperação ficam em tabela privada. Nenhuma entrada pode escolher URL de download, empresa ou usuário.
- Em `/whatsapp-inbox`, o usuário prepara um rascunho de RDO, OS ou despesa a partir da transcrição e do arquivo original. Os campos são preenchidos/conferidos pela pessoa, não interpretados como comandos pela IA. Datas e máquinas não são adivinhadas.
- Salvar não gera lançamento. Confirmar exige rascunho salvo, versão atual e conferência explícita. Edições concorrentes geram conflito; confirmação repetida retorna o mesmo registro.
- O operador pode confirmar seu RDO com máquina autorizada; OS e despesas exigem gestor da empresa. OS nasce `pending` sem atualizar horímetro/gerar receita; despesa nasce `pending`, sem marcar pagamento. Totais da OS usam as colunas calculadas do banco.
- Registro, estado do rascunho, estado do evento e auditoria são gravados na mesma transação. O lançamento pertence ao usuário que confirmou; o rascunho mantém autor do envio e responsável pela confirmação. A auditoria conserva o conteúdo salvo/confirmado e não é acessível pelo cliente.
- O envio original é preservado ao descartar um rascunho.

## Publicado no Supabase

- Migrações `20260914143229_whatsapp_reliable_workflow` e `20260914143438_whatsapp_worker_extension_schema` aplicadas; nomes locais correspondem ao histórico remoto.
- `wa-agent` v51, `whatsapp-bot` v77 e `whatsapp-worker` v1 publicados.
- `terrages-whatsapp-recovery` ativo, `* * * * *`.
- O endereço do worker foi configurado em `private.whatsapp_worker_config.endpoint` para este projeto após o deploy. A credencial é gerada no banco e nunca impressa nem versionada. Para outro ambiente, configure seu próprio endpoint após publicar a função; o cron permanece inerte enquanto o endpoint for nulo.
- Worker usa autenticação própria: cron com segredo exclusivo ou usuário validado por `getUser` e RPC de autorização/repetição. Não concede ao usuário acesso à fila global. `verify_jwt=false` é necessário para a chamada interna e não elimina a autenticação no código.
- A segunda migração recriou a extensão recém-instalada `pg_net` em `extensions`, com fila vazia, para evitar metadados em `public`. Não usa CASCADE e recusa executar com trabalhos pendentes.

## Verificações realizadas

- `npm run test:security`: 19 testes passaram. Incluem autenticação do worker, retomada de mídia preservada, falha temporária, recusa de caminho de outra empresa e todo o conjunto da etapa 1.
- Executados `tests/security/isolation.sql` e `tests/security/whatsapp-workflow.sql` em uma transação terminada em `ROLLBACK`, antes e depois da migração. Passaram isolamento, alterações de privilégios, duplicidade, lease vencida, conflito de versão, três tipos de confirmação, NaN, descarte, backoff e limite de tentativas. Zero usuários sintéticos remanescentes.
- Build Vite e typecheck direcionado dos módulos alterados passaram. Adicionados tipos React fixados no lockfile e corrigida a assinatura de navegação do Layout para aceitar voltar no histórico.
- HTTP real: worker autenticado 202; worker sem autenticação 401; webhook sem configuração segura 503 (`secure_webhook_configuration_required`). Não foram enviados WhatsApps.
- Não houve homologação visual/interativa em navegador: instalação do Chrome bloqueada por certificado/download inválido. Não equivale a homologação ponta a ponta com o provedor ou com usuários reais.
- Revisão Supabase: tabelas privadas permanecem intencionalmente sem políticas de cliente. Não foi adicionado aviso de extensão em `public`. Avisos remanescentes: funções legadas do esquema `pessoal`, `vector` em `public`, RPCs autenticadas de vínculo e proteção de senhas vazadas desabilitada. Referências: [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extensão em public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [RPC privilegiada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Limites operacionais

- A interface depende do merge deste PR e do deploy Vercel. Backend já publicado é compatível com a tela anterior.
- A configuração segura do WhatsApp continua pendente no ambiente ativo. Conferir `WA_WEBHOOK_SECRET`, `EVOLUTION_INSTANCE` e configuração do provedor conforme o documento da etapa 1. Não remover os bloqueios para liberar o fluxo.
- A rotação da credencial privilegiada exposta no histórico não foi verificada nesta etapa.
- Eventos antigos sem tarefa privada não são migrados por inferência de telefone; falhas anteriores precisam de nova mensagem. Cinco tentativas esgotadas também exigem corrigir o problema e reenviar.
- Uma interrupção após chamar o modelo, antes de persistir o resultado, pode repetir inferência e consumo. Idempotência transacional cobre lançamentos, não cobrança externa do provedor.
- Falta homologar mídias reais autorizadas e a experiência completa no navegador. Correção/aprovação de medições, pagamentos, manutenção, conhecimento técnico com fontes e confirmação por resposta no próprio WhatsApp ficam para os próximos incrementos. A confirmação desta etapa ocorre no sistema.
