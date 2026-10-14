# Cadastro simples de operadores pelo WhatsApp

O gestor conecta primeiro seu próprio número em **Mais → WhatsApp**. Depois pode enviar **Cadastrar operador** ao agente, informar o contato (ou número com DDD), o nome e confirmar com **SIM**. O agente mostra a empresa antes da confirmação. **CANCELAR** abandona o cadastro.

No aplicativo, o mesmo cadastro está em **Mais → Equipe → Acessos pelo WhatsApp**. São dois campos, uma conferência e a confirmação. A lista permite atualizar o status, bloquear e liberar novamente.

O operador envia um **oi** ao mesmo WhatsApp do TerraGes em até sete dias. Não precisa de senha, e-mail ou código de vínculo. A autorização cria apenas acesso de operador; consultas de gestão e financeiras continuam restritas. As regras existentes de atribuição de máquinas continuam aplicáveis.

## Segurança e funcionamento

- Empresa e gestor vêm do vínculo verificado do remetente e da associação privada no banco. Nem a conversa, nem uma extração por IA, nem metadados editáveis escolhem empresa ou papel.
- O cadastro só aceita mensagens de texto e contato compartilhado. Arquivos e transcrições não concedem acesso.
- A autorização fica pendente até a chegada de mensagem autenticada do número autorizado. O servidor usa Auth Admin para criar a identidade, e o trigger valida a autorização e cria perfil, associação, funcionário e vínculo na mesma transação. Não cria outra empresa para o operador.
- Telefones já cadastrados em outra empresa não são transferidos. Reativação reutiliza a identidade do operador da mesma empresa.
- O gestor pode revogar o acesso. A associação fica inativa e o vínculo é removido; cada operação do agente confere novamente a associação.
- Etapas e respostas são persistidas por evento para que reentregas do webhook não autorizem duas vezes.
- Conversas de cadastro expiram em 30 minutos; autorizações não ativadas expiram em sete dias.

## Publicação e verificação

As migrations criam tabelas privadas e RPCs com autorização explícita. `wa-agent` e `whatsapp-worker` precisam ser publicados juntos com as dependências compartilhadas. O código do agente foi reconciliado com as versões publicadas antes desta alteração, preservando o roteamento de habilidades, provedor de texto, cálculo de terraplanagem e orientações existentes.

- `npm run test:security`: valida webhook, contatos, ativação, repetição, isolamento de anexos e processador.
- `tests/security/whatsapp-operators.sql`: executar inteiro, incluindo `ROLLBACK`; testa conversa, duplicação, isolamento de empresas, papéis, ativação, revogação, reativação, expiração e tentativa de injetar empresa por metadados.
- Interface verificada em viewport móvel com Supabase simulado: confirmação antes da mutação, nome da empresa, liberação e bloqueio; sem mensagens externas enviadas.

A auditoria do banco sinaliza intencionalmente as três RPCs de gestor como SECURITY DEFINER executáveis por authenticated. Todas exigem associação ativa de gestor e limitam operações à empresa derivada da sessão. As tabelas privadas não têm políticas de acesso direto, por projeto. Os avisos antigos de outros esquemas, extensão vector e proteção de senhas estão fora desta alteração.
