---
name: memoria-conversacional
description: Gerencia estado e contexto de conversas do WhatsApp. Use para persistir informações entre mensagens do mesmo usuário.
allowed-tools: None
---

# Skill de Memória Conversacional

## Quando usar
- Usuário começa uma ação incompleta
- Precisar lembrar contexto da conversa atual
- Gerenciar estado de fluxos multi-passos
- Salvar preferências temporárias

## Estrutura de Estado

```typescript
interface ConversationState {
  currentAction: string;        // Ação atual sendo executada
  pendingFields: string[];      // Campos pendentes de preenchimento
  context: Record<string, any>; // Dados coletados até agora
}
```

## Fluxo de Estado

### Exemplo: Criação de OS
```
1. Usuário: "Quero criar OS para João"
   → Estado: { currentAction: "create_os", pendingFields: ["client", "date", "hours"] }

2. Bot: "Qual o nome completo do cliente?"
   → Aguardando: client

3. Usuário: "João da Silva"
   → Estado: { currentAction: "create_os", pendingFields: ["date", "hours"], context: { client: "João da Silva" } }

4. Bot: "Qual a data do serviço?"
   → Aguardando: date

5. Usuário: "Hoje"
   → Estado: { currentAction: "create_os", pendingFields: ["hours"], context: { client: "João da Silva", date: "2026-06-01" } }

6. Bot: "Quantas horas foram trabalhadas?"
   → Aguardando: hours

7. Usuário: "8 horas"
   → Estado: { currentAction: "completed", context: {...} }
   → Executar ação completa
```

## Tabela de Sessões

```sql
CREATE TABLE conversation_sessions (
  session_id UUID,
  user_phone VARCHAR(20) NOT NULL,
  user_role TEXT NOT NULL,
  current_state TEXT,
  context JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Estados Comuns

| Estado | Descrição | Ações |
|--------|-----------|-------|
| `idle` | Nenhuma ação em andamento | Processar nova mensagem normalmente |
| `awaiting_client` | Aguardando nome do cliente | Perguntar "Qual o nome do cliente?" |
| `awaiting_date` | Aguardando data | Perguntar "Qual a data do serviço?" |
| `awaiting_hours` | Aguardando horas | Perguntar "Quantas horas foram trabalhadas?" |
| `awaiting_machine` | Aguardando máquina | Perguntar "Qual foi a máquina operada?" |
| `awaiting_payment` | Aguardando forma de pagamento | Perguntar "Qual a forma de pagamento?" |
| `awaiting_location` | Aguardando localização | Perguntar "Onde foi realizado o serviço?" |
| `awaiting_confirmation` | Aguardando confirmação | Mostrar resumo e pedir "Sim/Não" |

## Persistência

### Salvar Estado
```typescript
await supabase
  .from('conversation_sessions')
  .upsert({
    user_phone: phone,
    current_state: state.currentAction,
    context: state.context,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_phone' });
```

### Carregar Estado
```typescript
const { data } = await supabase
  .from('conversation_sessions')
  .select('current_state, context')
  .eq('user_phone', phone)
  .single();
```

## Limpeza de Estado

- Expiração automática: 1 hora de inatividade
- Limpeza manual: Ao completar ação com sucesso
- Limpeza manual: Ao cancelar ação

## Exemplos de Uso

### Exemplo 1: Registro de Horas
```
Usuário: "Quero registrar horas"
→ Estado: { currentAction: "create_machine_hours", pendingFields: ["machine", "hours", "operator"] }

Bot: "Qual foi a máquina operada?"
→ Estado: { currentAction: "create_machine_hours", pendingFields: ["hours", "operator"], context: { machine: null } }

Usuário: "Escavadeira"
→ Estado: { currentAction: "create_machine_hours", pendingFields: ["hours", "operator"], context: { machine: "Escavadeira" } }

Bot: "Quantas horas foram trabalhadas?"
→ ...
```

### Exemplo 2: Cancelamento de Ação
```
Usuário: "Esquece, cancela"
→ Limpar estado
→ Estado: { currentAction: "idle", pendingFields: [], context: {} }
```

## Boas Práticas

1. **Sempre perguntar o que falta** quando houver campos pendentes
2. **Lembrar o contexto** entre mensagens
3. **Permitir cancelamento** a qualquer momento
4. **Limpar estado** após ação concluída
5. **Expirar sessões** após 1 hora de inatividade