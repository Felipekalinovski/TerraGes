# TerraGes: atualização da experiência mobile

A interface prioriza a operação pelo celular: ações visíveis, navegação inferior, menu completo agrupado por tarefa e indicadores com período explícito. Cores: fundo claro, verde profundo para saldo e navegação, laranja para ações. Modo escuro preservado com preferência persistente.

## Escopo

- Nova estrutura de navegação para todas as telas, respeitando os perfis existentes.
- Painel de gestão e painel do operador; indicadores financeiros distinguem realizado e pendente. Consultas paginadas e falhas explícitas impedem apresentar totais truncados ou zeros como sucesso.
- Serviços: busca sem distinção de acentos por cliente, máquina, operador e ID; filtros reais; folha e edição acessíveis ao toque.
- WhatsApp: filtros de situação, vínculo recolhível e leitura por tipo de envio. Confirmação humana e arquivos privados preservados.
- Login com campos identificados, preenchimento automático e mostrar/ocultar senha. Formulários OS e RDO com leitura ampliada e rótulos associados; captura de imagem da OS compacta e opcional.
- CSS compilado localmente com Tailwind 3 para manter compatibilidade com as telas existentes; remoção do CDN de execução. Rotas carregadas sob demanda.
- Verificação TypeScript específica do frontend na integração contínua. Funções Deno continuam no fluxo próprio do Supabase.

## Verificação

- Build de produção concluído; verificação TypeScript do frontend aprovada.
- 24 testes passaram, incluindo isolamento, WhatsApp, conclusão da OS e novas verificações de cálculo financeiro e virada de ano.
- Revisão visual em navegador com componentes reais e dados fictícios isolados em `tests/ui`: 360, 390, 768 e 1440 pixels; texto ampliado a 200%; menu, busca, filtros e tema.
- O harness usa entrada separada de desenvolvimento, não é incluído no build e bloqueia gravações. Não é um modo de demonstração nem contorna a autenticação do aplicativo publicado.
- A validação autenticada com dados reais permanece necessária antes da adoção em produção. Não foram criados registros operacionais para testar o design.

## Publicação e continuidade

O Sites contém uma publicação privada para avaliação. O aplicativo usa o mesmo Supabase e exige a conta TerraGes normal; a proteção privada do Sites é adicional. O acesso por Google nesta nova origem depende de a URL estar na lista de redirecionamentos autorizados do Supabase. Nenhuma chave de serviço está no frontend ou no repositório.

Esta entrega não conclui a configuração manual do provedor de WhatsApp. As demais telas recebem a estrutura global; suas áreas de conteúdo podem ser modernizadas em entregas posteriores.

Referência técnica da compilação de estilos: https://v3.tailwindcss.com/docs/guides/vite
