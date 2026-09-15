# Isolamento e entrada do WhatsApp — 14/09/2026

> Registro da etapa 1. A fila, a retomada e a confirmação evoluíram na [etapa 2](whatsapp-reliable-workflow.md). As restrições de segurança e as pendências de credenciais continuam aplicáveis.

## Escopo implementado

- Autorização baseada em `private.tenant_memberships`, inacessível aos clientes. Metadados editáveis, telefone informado e campos de perfil não concedem privilégios.
- Cada gestor consulta dados operacionais exclusivamente da sua empresa. Cada operador consulta seus próprios lançamentos e máquinas explicitamente atribuídas. Perfis pessoais são visíveis apenas ao titular.
- RLS habilitado em todas as tabelas públicas; concessões anônimas e RPCs antigos privilegiados removidos. Referências entre empresas são rejeitadas no banco, inclusive nas escritas dos serviços.
- Usuários não podem alterar empresa, cargo, permissões, telefone verificado ou titularidade de registros pela API. Vínculos novos/mudanças de empresa exigem provisionamento administrativo verificado.
- Administradores antigos sem empresa receberam um espaço isolado por conta. Operadores sem empresa e registros sem titularidade confiável permanecem preservados e inacessíveis até conferência administrativa. Não houve associação automática por nome, e-mail ou telefone.
- Buckets privados; caminhos novos `empresa/usuario/arquivo`; links assinados por cinco minutos. Propriedade de comprovantes legados derivada somente do proprietário de Storage, congelada em tabela privada. Arquivos sem proprietário verificado permanecem inacessíveis.
- `wa-agent` e `whatsapp-bot` usam a mesma entrada autenticada, com segredo exclusivo e instância fixa. Código de vínculo aleatório, uso único e validade de dez minutos, criado na conta autenticada e apresentado pelo WhatsApp.
- Limite de 128 KB por envelope; mídia até 10 MB; limite de tamanho efetivo durante leitura; validação de MIME e assinatura de arquivo; URL de download somente do provedor HTTPS configurado no servidor.
- Áudio OGG/MP3/WAV/M4A, imagem JPG/PNG/WebP, PDF, TXT/CSV. Outros formatos, incluindo DOCX/XLSX, são recusados nesta etapa. A validação de formato não equivale a antivírus ou certificação do conteúdo.
- Deduplicação por instância + identificador de mensagem. Conteúdo recebido não executa ferramentas, SQL nem lançamentos. Transcrição e extração vão para conferência humana na caixa de entrada. Não há confirmação automática de dados operacionais ou financeiros.
- Falhas são registradas sem detalhes sensíveis de provedores. Mídia validada é preservada antes da inferência. Reenvio de um evento duplicado não reprocessa falha; o usuário deve enviar uma nova mensagem. Recuperação automática de tarefas interrompidas ainda não implementada.
- Rotinas antigas `cron-notifications`, `cron-insights`, `generate-embedding`, `upx-sync` e funções de debug ficam suspensas (HTTP 401 sem autenticação; 503 quando autenticadas) enquanto não têm autorização por empresa validada. `ai-proxy` exige usuário autenticado e empresa ativa.
- Removida configuração com credencial administrativa do estado atual do repositório. O histórico continua exigindo rotação da credencial.

## Configuração necessária antes de liberar WhatsApp real

1. **Rotacionar a credencial administrativa Supabase exposta no histórico.** A chave `service_role` ignora RLS. Remover o arquivo não revoga a chave. Fazer a rotação pelo painel Supabase, atualizar dependências legítimas e verificar que a credencial antiga foi invalidada. Esta rotação não está disponível no conector desta sessão. Não enviar segredos por chat nem commitar novas chaves.
2. Definir `WA_WEBHOOK_SECRET` nas Edge Function Secrets: segredo aleatório exclusivo, mínimo 32 caracteres. Configurar o provedor para enviar exatamente esse valor no cabeçalho `x-webhook-secret`. Não usar a chave global Evolution ou a chave Supabase como segredo do webhook. Sem esta configuração, ambas as entradas retornam 503 e não processam mensagens.
3. Confirmar `EVOLUTION_INSTANCE`, `EVOLUTION_API_URL` HTTPS e `EVOLUTION_API_KEY` no servidor. A URL não pode conter credenciais ou parâmetros. Adaptador atual atende envelopes Evolution Go (`Message`/`Info`/`Message`) e Evolution (`messages.upsert`/`key`/`message`); download usa `/chat/getBase64FromMediaMessage`. Validar a versão do provedor com conteúdo sintético antes de liberar clientes.
4. Confirmar `GROQ_API_KEY` para áudio; `OPENROUTER_API_KEY` e `AI_MODEL_VISION` com capacidade de imagem/PDF nativo. `AI_MODEL_TEXT` para o chat. Não existe fallback silencioso para modelos descontinuados.
5. Abrir `/whatsapp-inbox`, gerar `VINCULAR ...` na conta de cada pessoa e enviar pelo número que ela controla ao número oficial. Gerar outro código invalida o anterior. Um número já vinculado não é transferido silenciosamente para outra conta.
6. Conferir administrativamente empresas, operadores e máquinas pendentes, usando evidência do proprietário. Não consolidar as empresas provisórias por semelhança de cadastro. As atribuições de máquinas são permitidas apenas a gestores da mesma empresa.
7. Fazer testes reais com duas empresas e dois operadores por empresa, usando somente dados sintéticos e números autorizados. Esta etapa não envia WhatsApp real automaticamente.

## Verificação reproduzível

- Node 24: `npm run test:security` — 13 cenários de autenticação, vinculação, tentativas de injeção, duplicidade, tamanho e formato.
- `tests/security/isolation.sql`: executar em UMA transação após a migração e terminar com `ROLLBACK`. Cria quatro usuários sintéticos, não deve ser executado com commit. Verifica RLS, alteração de perfil, referências entre empresas, operadores, arquivos, permissões anônimas, escrita do serviço e consumo do vínculo.
- `npm run build` — compilação do site.
- Typecheck direcionado dos módulos compartilhados/testes passa. O typecheck global já apresenta erros em `RelatorioCliente`, backups antigos e mistura dos ambientes Deno e navegador; não é um gate verde deste projeto.

## Limites e próximos incrementos

Não há garantia absoluta contra vazamento enquanto houver credencial privilegiada antiga válida. Também faltam teste real no provedor, antivírus para anexos, recuperação durável de eventos interrompidos, limites de consumo por empresa, provisionamento administrativo com trilha de auditoria e fluxo transacional de aprovação dos lançamentos. Arquivos/LLM são conteúdo não confiável; a tela mostra o texto como texto, sem interpretar HTML.

As regras de contenção não devem ser revertidas para restaurar rotinas antigas. Para corrigir problemas de acesso, verificar os vínculos e aplicar uma migração aditiva específica. Migrações e Edge Functions precisam continuar versionadas junto com o site.


## Resultado no ambiente ativo

Migração inicial aplicada e suite SQL repetida com sucesso: 0 tabelas públicas sem RLS, 0 buckets públicos, 0 concessões de tabela para anon, 0 usuários de teste remanescentes. Há 20 vínculos ativos e quatro operadores antigos sem vínculo. Chamadas HTTP sem credenciais ao WhatsApp retornaram `secure_webhook_configuration_required` (503); chamadas ao proxy e rotinas de debug foram bloqueadas (401). A revisão automática de Supabase ainda indica bloqueios intencionais sem políticas, duas RPCs autenticadas de vínculo, extensão vector no esquema público e proteção de senhas vazadas desabilitada; não é uma certificação de segurança.
