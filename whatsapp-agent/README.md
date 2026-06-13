# TerraGes WhatsApp Agent Harness

## Visão Geral

Este projeto implementa um sistema de agentes de IA para WhatsApp usando o framework **wa-agent**, projetado para substituir gradualmente o sistema monolítico atual no `supabase/functions/whatsapp-bot/index.ts`.

## Estrutura do Projeto

```
whatsapp-agent/
├── agents/                    # Configurações de agentes YAML
│   ├── triage-bot.yaml       # Agente de triagem principal
│   └── ...                   # Outros agentes especializados
├── tools/                     # Ferramentas personalizadas TypeScript
│   ├── triage-tool.ts         # Ferramenta de classificação
│   ├── route-tool.ts          # Ferramenta de roteamento
│   └── forward-tool.ts        # Ferramenta de encaminhamento
├── config/                    # Configurações
│   └── wa-agent.yaml         # Configuração principal do wa-agent
├── package.json              # Dependências e scripts
├── tsconfig.json             # Configuração de TypeScript
└── README.md                 # Documentação
```

## Características

### ✅ Funcionalidades Existentes (Preservadas)

- **Processamento Multimodal**: Texto, áudio (Groq Whisper), imagens (Gemini OCR)
- **Autenticação de Usuários**: Supabase com roles (operator, manager, admin)
- **Sistema de Triagem**: Classificação de mensagens em categorias
- **Ações com Confirmação**: Sistema de criação de ordens de serviço
- **Memória de Conversa**: Histórico de mensagens no Supabase
- **Suporte a Evolution API**: v1 e v2

### 🚀 Novas Funcionalidades (wa-agent)

- **Arquitetura Multi-Agente**: Múltiplos agentes especializados
- **Memória Avançada**: Perfis de usuários, resumos de conversas
- **Sistema de Ferramentas**: Ferramentas personalizadas e reutilizáveis
- **Roteamento Avançado**: Roteamento por JID, grupo, regex
- **Rate Limiting**: Controles de taxa por agente e por chat
- **Mensagens Agendadas**: Gatilhos cron
- **Transferência Humana**: Escalada para operadores humanos

## Configuração

### Pré-requisitos

```bash
npm install
```

### Configuração de Ambiente

Crie um arquivo `.env` com as seguintes variáveis:

```env
# OpenRouter (para classificação e IA)
OPENROUTER_API_KEY=sua_chave_aqui
OPENROUTER_MODEL=qwen/qwen3-4b:free

# Evolution API (para WhatsApp)
EVOLUTION_API_URL=sua_url_aqui
EVOLUTION_API_KEY=sua_chave_aqui
EVOLUTION_INSTANCE=sua_instancia
EVOLUTION_API_VERSION=v2

# Supabase (para integração)
SUPABASE_URL=sua_url_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui

# Groq (para transcrição de áudio)
GROQ_API_KEY=sua_chave_aqui

# Gemini (para OCR)
GEMINI_API_KEY=sua_chave_aqui

# Tavily (para web search)
TAVILY_API_KEY=sua_chave_aqui
```

## Começando

### 1. Inicializar o Projeto

```bash
npm run wa-agent:agents
```

### 2. Iniciar o Agente

```bash
npm run wa-agent:dev
```

### 3. Verificar Configuração

```bash
npm run wa-agent:agents
```

## Arquitetura

### Fluxo de Trabalho Atual

```
WhatsApp → Evolution API → Supabase Edge Function (monolítico) → OpenRouter → Resposta
```

### Fluxo de Trabalho wa-agent

```
WhatsApp → Evolution API → wa-agent (triage-bot) → Especialistas → Resposta
```

## Migração Gradual

### Fase 1: Configuração Básica

1. **Agente de Triagem**: `triage-bot.yaml` roteia mensagens para o sistema existente
2. **Ferramentas Personalizadas**: Reutiliza toda a lógica existente do Supabase
3. **Integração**: Mantém Evolution API e Supabase funcionando

### Fase 2: Memória Avançada

1. **Perfis de Usuários**: Extração automática de fatos sobre usuários
2. **Resumos de Conversas**: Resumos automáticos de conversas longas
3. **Contexto Persistente**: Mantém contexto entre conversas

### Fase 3: Especialistas

1. **Agentes Especializados**: `fleet-bot`, `finance-bot`, `rdo-bot`, etc.
2. **Roteamento Avançado**: Roteamento por JID, grupo, regex
3. **Ferramentas Especializadas**: Ferramentas específicas para cada domínio

### Fase 4: Otimização

1. **Rate Limiting**: Controles de taxa por agente e por chat
2. **Mensagens Agendadas**: Gatilhos cron
3. **Transferência Humana**: Escalada para operadores

## Desenvolvimento

### Adicionar Novo Agente

1. **Criar arquivo YAML** em `agents/`
2. **Definir ferramentas** no arquivo `tools/`
3. **Configurar roteamento** no arquivo YAML do agente
4. **Testar** com `npm run wa-agent:dev`

### Adicionar Nova Ferramenta

1. **Criar arquivo TypeScript** em `tools/`
2. **Exportar usando `defineTool()`**
3. **Adicionar à lista de ferramentas** no YAML do agente
4. **Testar** com `npm run wa-agent:dev`

## Testes

### Testar Agentes

```bash
npm test
```

### Testar Ferramentas

```bash
# Escreva testes unitários para cada ferramenta
# Exemplo: tools/triage-tool.test.ts
```

## Monitoramento

### Verificar Status

```bash
npm run wa-agent:agents
```

### Logs

- **wa-agent**: Logs estruturados em JSON
- **Supabase**: Logs padrão do Supabase
- **Ferramentas personalizadas**: Logs específicos por ferramenta

## Segurança

### Controles de Acesso

- **Rate Limiting**: Por agente e por chat
- **Cooldown**: Evita respostas muito rápidas
- **Permissões**: Baseadas em roles do Supabase
- **Autenticação**: Verificação de telefone por mensagem

### Proteção de Dados

- **Criptografia**: Todas as comunicações são criptografadas
- **Auditoria**: Logs de todas as ações
- **Conformidade**: GDPR, LGPD compatível

## Manutenção

### Atualizar Dependências

```bash
npm update
```

### Fazer Backup

```bash
# Fazer backup da configuração
cp -r config/ config_backup_$(date +%Y%m%d)

# Fazer backup dos agentes
cp -r agents/ agents_backup_$(date +%Y%m%d)
```

### Recuperar

```bash
# Restaurar da backup
cp -r config_backup_*/config/* config/
cp -r agents_backup_*/agents/* agents/
```

## Contribuição

### Diretrizes de Código

- **TypeScript**: ^5.0.0
- **Linting**: Usar ESLint
- **Formatting**: Usar Prettier
- **Testes**: Usar Jest

### Processo de PR

1. **Criar issue** para discutir as mudanças
2. **Criar branch** com `feature/` prefixo
3. **Fazer commits** com mensagens descritivas
4. **Enviar PR** para revisão
5. **Executar testes** antes de merge

## Licença

MIT

## Contato

Para dúvidas ou problemas:
- **GitHub Issues**: https://github.com/terrages/whatsapp-agent
- **Documentação**: https://docs.terrages.app

---

*Este projeto está em desenvolvimento ativo. Novas funcionalidades serão adicionadas gradualmente.*