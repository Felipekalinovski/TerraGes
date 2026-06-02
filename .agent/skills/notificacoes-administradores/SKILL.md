---
name: notificacoes-administradores
description: Notifica administradores sobre criação de registros. Use sempre que uma OS, agendamento ou outro registro for criado.
allowed-tools: None
---

# Skill de Notificações para Administradores

## Quando usar
- Nova OS criada pelo WhatsApp
- Novo agendamento criado
- Qualquer registro importante criado no sistema
- Necessidade de informar gestores sobre ações

## Tipos de Notificações Administrativas

| Tipo | Destinatário | Quando | Conteúdo |
|------|--------------|--------|----------|
| `new_service_order` | Administradores | Nova OS criada | Detalhes da OS e ID de controle |
| `new_schedule` | Administradores | Novo agendamento criado | Detalhes do agendamento e ID |
| `updated_status` | Administradores | Status de OS alterado | OS, status antigo e novo |
| `deleted_record` | Administradores | Registro excluído | Tipo e ID do registro |

## Formato de Notificação

### Notificação de Nova OS
```
✅ NOVA ORDEM DE SERVIÇO CRIADA

ID de Controle: OS-2026-00123
Cliente: João Silva
Data: 01/06/2026
Horas: 8h
Valor: R$ 1.200,00
Forma de Pagamento: Cheque
Localização: Av. Paulista, 1000
Descrição: Serviços de terraplanagem

Registro efetuado via WhatsApp pelo gestor [Nome].

ID de Controle: OS-2026-00123
```

### Notificação de Novo Agendamento
```
✅ NOVO AGENDAMENTO CRIADO

ID de Controle: SCH-2026-00045
Título: Manutenção Preventiva
Tipo: Manutenção
Data/Hora: 15/06/2026 às 08:00
Prioridade: Alta
Duração Estimada: 4h
Notas: Troca de óleo e filtros da escavadeira

Registro efetuado via WhatsApp pelo gestor [Nome].

ID de Controle: SCH-2026-00045
```

### Notificação de Status Alterado
```
🔄 STATUS ALTERADO

OS: OS-2026-00123
Cliente: João Silva
Status Anterior: pending
Status Atual: completed
Data: 01/06/2026

Alteração efetuada via WhatsApp pelo gestor [Nome].

ID de Controle: OS-2026-00123
```

### Notificação de Registro Excluído
```
❌ REGISTRO EXCLUÍDO

Tipo: Ordem de Serviço
ID: OS-2026-00123
Cliente: João Silva
Data: 01/06/2026
Valor: R$ 1.200,00

Exclusão efetuada via WhatsApp pelo administrador [Nome].

ID de Controle: OS-2026-00123
```

## Formato de ID de Controle

### Estrutura
```
[TIPO]-[ANO]-[NÚMERO]

Exemplos:
- OS-2026-00123 (Ordem de Serviço)
- SCH-2026-00045 (Agendamento)
- RDO-2026-00078 (Relatório Diário)
- MNT-2026-00112 (Manutenção)
```

### Geração de ID
```typescript
function generateControlId(type: string, id: string): string {
  const year = new Date().getFullYear();
  const paddedId = id.padStart(5, '0');
  return `${type}-${year}-${paddedId}`;
}

// Exemplos:
// generateControlId('OS', 'abc123') → 'OS-2026-00abc'
// generateControlId('SCH', 'def456') → 'SCH-2026-00def'
```

## Destinatários das Notificações

### Tabela de Administradores
```sql
SELECT phone, name 
FROM profiles 
WHERE role IN ('admin', 'manager', 'proprietario');
```

### Lista de Contatos
```
Administradores:
- João da Silva (Admin) - (11) 99999-1111
- Maria Oliveira (Gerente) - (21) 98888-2222
- Carlos Souza (Proprietário) - (31) 97777-3333
```

## Fluxo de Notificação

```
1. Usuário cria OS via WhatsApp
   ↓
2. Sistema processa e salva no banco
   ↓
3. Sistema gera ID de controle
   ↓
4. Sistema constrói mensagem de notificação
   ↓
5. Sistema busca lista de administradores
   ↓
6. Sistema envia notificação para cada administrador
   ↓
7. Sistema registra log de notificação
```

## Código de Notificação

### Função de Notificação
```typescript
async function notifyAdministrators(
  notificationType: string,
  recordData: any,
  userId: string,
  userName: string
): Promise<void> {
  // Buscar lista de administradores
  const { data: admins } = await supabase
    .from('profiles')
    .select('phone, name')
    .in('role', ['admin', 'manager', 'proprietario']);
  
  if (!admins || admins.length === 0) {
    console.log('Nenhum administrador encontrado');
    return;
  }
  
  // Construir mensagem baseada no tipo
  let message = '';
  if (notificationType === 'new_service_order') {
    message = buildNewOSNotification(recordData, userName);
  } else if (notificationType === 'new_schedule') {
    message = buildNewScheduleNotification(recordData, userName);
  }
  
  // Enviar para cada administrador
  for (const admin of admins) {
    await sendMessage(admin.phone, message, EVOLUTION_API_KEY);
    console.log(`Notificação enviada para ${admin.name} (${admin.phone})`);
  }
}
```

### Construção de Mensagem
```typescript
function buildNewOSNotification(osData: any, userName: string): string {
  return `✅ NOVA ORDEM DE SERVIÇO CRIADA

ID de Controle: ${generateControlId('OS', osData.id)}
Cliente: ${osData.client}
Data: ${formatDate(osData.date)}
Horas: ${osData.end_hour - osData.start_hour}h
Valor: R$ ${osData.total_value.toFixed(2)}
Forma de Pagamento: ${osData.payment_method}
Localização: ${osData.location}
${osData.description ? `Descrição: ${osData.description}` : ''}

Registro efetuado via WhatsApp pelo ${userName}.

ID de Controle: ${generateControlId('OS', osData.id)}`;
}
```

## Formato de Data

### Formatação Brasileira
```typescript
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Exemplo: "01/06/2026"
```

### Formatação de Data e Hora
```typescript
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Exemplo: "15/06/2026 08:00"
```

## Boas Práticas

1. **Sempre incluir ID de controle** para rastreamento
2. **Formatar valores monetários** com R$ e vírgula
3. **Incluir nome do usuário** que realizou a ação
4. **Usar formatação clara** com quebras de linha
5. **Enviar notificação imediatamente** após criação
6. **Logar todas as notificações** para auditoria
7. **Permitir desativação** de notificações por administrador

## Exemplo Completo

### Cenário: Gestor cria OS via WhatsApp

```
1. Gestor envia: "Criar OS para João Silva, CPF 123.456.789-00, contato (11) 98888-1111, Av Paulista 1000, 8h, R$ 150/h, Cheque"

2. Sistema processa e cria OS no banco
   → OS ID: "abc123def456"

3. Sistema gera notificação:
"✅ NOVA ORDEM DE SERVIÇO CRIADA

ID de Controle: OS-2026-00abc
Cliente: João Silva
Data: 01/06/2026
Horas: 8h
Valor: R$ 1.200,00
Forma de Pagamento: Cheque
Localização: Av. Paulista, 1000

Registro efetuado via WhatsApp pelo gestor Ana Pereira.

ID de Controle: OS-2026-00abc"

4. Sistema envia para:
   - João da Silva (Admin) - (11) 99999-1111
   - Maria Oliveira (Gerente) - (21) 98888-2222
   - Carlos Souza (Proprietário) - (31) 97777-3333

5. Todos os administradores recebem notificação
```