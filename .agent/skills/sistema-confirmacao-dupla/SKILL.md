---
name: sistema-confirmacao-dupla
description: Gerencia confirmação dupla para ações críticas. Use quando administradores ou gestores realizarem ações que alterem dados do sistema.
allowed-tools: None
---

# Skill de Sistema de Confirmação Dupla

## Quando usar
- Gestor ou admin criar OS com dados sensíveis
- Gestor ou admin criar agendamentos importantes
- Qualquer ação que modifique dados do sistema
- Ações que não podem ser desfeitas facilmente

## Fluxo de Confirmação

```
┌─────────────────┐
│  Usuário pede   │
│   ação crít.    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Verificar Role │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   Admin   Gestor/Operator
    │         │
    │         │
┌───▼───┐  ┌──▼────────┐
│Direto │  │Confirmação│
│       │  │  Dupla    │
└───────┘  └─────┬─────┘
                  │
            ┌─────▼─────┐
            │ Mostrar   │
            │ Resumo    │
            └─────┬─────┘
                  │
            ┌─────▼─────┐
            │ "Sim/Não" │
            └─────┬─────┘
                  │
            ┌─────▼─────┐
            │ Executar  │
            │ ou Cancel │
            └───────────┘
```

## Tabela de Ações Pendentes

```sql
CREATE TABLE pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Tipos de Ações com Confirmação

| Ação | Nível | Confirmação | Exemplo |
|------|-------|-------------|---------|
| `CREATE_OS` | Alta | Sim | OS com valor > R$ 1000 |
| `CREATE_SCHEDULE` | Média | Sim | Agendamento importante |
| `DELETE_RECORD` | Alta | Sim | Exclusão de OS, RDO |
| `UPDATE_STATUS` | Média | Sim | Mudança de status crítico |

## Formato de Resumo

```
Vou criar OS com os seguintes dados:

Cliente: João Silva
Data: 01/06/2026
Horas: 8h
Valor: R$ 1.200,00
Forma de Pagamento: Cheque
Localização: Av. Paulista, 1000

Confirma (Sim/Não)?
```

## Estados de Ação

| Estado | Descrição | Próxima Ação |
|--------|-----------|--------------|
| `pending_confirmation` | Aguardando confirmação | Mostrar resumo ao usuário |
| `confirmed` | Confirmado e executado | Nenhuma |
| `cancelled` | Cancelado pelo usuário | Nenhuma |
| `executed` | Executado com sucesso | Nenhuma |
| `failed` | Falha na execução | Tentar novamente |

## Fluxo Completo

### Exemplo: Criação de OS

```
1. Usuário (Gestor): "Criar OS para João Silva, 8h, R$ 150/h, Cheque, Av Paulista 1000"

2. Sistema: Processar e salvar como pending
   → Status: pending_confirmation
   → Data: { client: "João Silva", hours: 8, rate: 150, payment: "Cheque", location: "Av Paulista 1000" }

3. Bot: "Vou criar OS para João Silva com 8h a R$ 150/h, pagamento em Cheque, localizado na Av Paulista 1000. Confirma (Sim/Não)?"

4. Usuário: "Sim"

5. Sistema: Executar ação
   → Atualizar status: executed
   → Inserir no banco de dados
   → Gerar ID da OS

6. Bot: "OS criada com sucesso! ID: OS-2026-00123"
```

### Exemplo: Cancelamento

```
1. Usuário (Gestor): "Criar OS para João Silva, 8h"

2. Bot: "Vou criar OS para João Silva com 8h. Confirma (Sim/Não)?"

3. Usuário: "Não"

4. Sistema: Cancelar ação
   → Atualizar status: cancelled
   → Remover dados temporários

5. Bot: "Ação cancelada."
```

## Verificação de Confirmação

### Código de Verificação
```typescript
async function handleUserConfirmation(phone: string, confirmed: boolean): Promise<string> {
  const { data: pendingAction } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('user_phone', phone)
    .eq('status', 'pending_confirmation')
    .single();
  
  if (!pendingAction) return 'Nenhuma ação pendente encontrada.';
  
  if (confirmed) {
    await supabase
      .from('pending_actions')
      .update({ status: 'executed' })
      .eq('id', pendingAction.id);
    
    return await executeAction(pendingAction.action_type, pendingAction.action_data);
  } else {
    await supabase
      .from('pending_actions')
      .update({ status: 'cancelled' })
      .eq('id', pendingAction.id);
    
    return 'Ação cancelada.';
  }
}
```

## Ações Diretas (Admin)

### Sem Confirmação
```typescript
async function executeActionDirectly(action: string, data: any): Promise<string> {
  if (action === 'CREATE_OS') {
    const { error } = await supabase.from('service_orders').insert([{
      ...data,
      status: 'pending'
    }]);
    
    if (error) return `Erro: ${error.message}`;
    return `OS criada com sucesso! ID: ${data.id || 'novo'}`;
  }
  
  return 'Ação realizada com sucesso!';
}
```

## Regras de Confirmação

### Sempre pedir confirmação para:
- ✅ OS com valor > R$ 500
- ✅ Agendamentos com data futura
- ✅ Exclusão de registros
- ✅ Mudança de status para "completed"
- ✅ Qualquer ação com dados sensíveis

### Pode pular confirmação para:
- ✅ Ações de admin (com alerta de responsabilidade)
- ✅ Consultas e leituras
- ✅ Confirmações de recebimento

## Alertas de Responsabilidade

### Para Gestor
```
⚠️ IMPORTANTE: Você está prestes a criar uma OS.
Esta ação será registrada no sistema.
Confirma (Sim/Não)?
```

### Para Admin
```
⚠️ IMPORTANTE: Você está prestes a criar uma OS diretamente.
Esta ação não pode ser desfeita facilmente.
Confirma (Sim/Não)?
```

## Boas Práticas

1. **Sempre mostrar resumo completo** antes de confirmar
2. **Usar formatação clara** para valores e datas
3. **Permitir cancelamento** a qualquer momento
4. **Logar todas as ações** para auditoria
5. **Expirar ações pendentes** após 1 hora
6. **Notificar** quando ação for executada com sucesso