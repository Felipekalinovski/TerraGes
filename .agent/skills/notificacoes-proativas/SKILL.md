---
name: notificacoes-proativas
description: Gerencia notificações automáticas e agendadas para operadores e gestores. Use para enviar alertas e lembretes automáticos.
allowed-tools: None
---

# Skill de Notificações Proativas

## Quando usar
- Enviar alertas de fim de turno para operadores
- Enviar relatórios semanais para gestores
- Lembretes de pagamentos pendentes
- Alertas de manutenção de máquinas

## Tipos de Notificações

| Tipo | Destinatário | Horário | Frequência | Descrição |
|------|--------------|---------|------------|-----------|
| `end_of_shift` | Operator | 18:00 | Diário | Lembrete de fechamento de turno |
| `daily_report` | Manager | 09:00 | Diário | Relatório diário do dia anterior |
| `pending_payments` | Manager | 10:00 | Semanal | Alerta de pagamentos pendentes |
| `machine_maintenance` | Operator | Variável | Sob demanda | Alerta de manutenção programada |

## Tabela de Notificações Agendadas

```sql
CREATE TABLE scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('end_of_shift', 'daily_report', 'pending_payments', 'machine_maintenance')),
  target_role TEXT NOT NULL CHECK (target_role IN ('operator', 'manager', 'admin')),
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Cron Job de Envio

### Função de Envio
```typescript
async function sendScheduledNotifications() {
  const now = new Date().toISOString();
  
  // Buscar notificações agendadas para o momento atual
  const { data: notifications } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('scheduled_time', now)
    .eq('sent', false);
  
  for (const notification of notifications) {
    // Buscar usuários do target_role
    const { data: users } = await supabase
      .from('profiles')
      .select('phone')
      .eq('role', notification.target_role);
    
    // Enviar notificações via WhatsApp
    for (const user of users) {
      await sendMessage(user.phone, notification.message, EVOLUTION_API_KEY);
    }
    
    // Marcar como enviada
    await supabase
      .from('scheduled_notifications')
      .update({ sent: true })
      .eq('id', notification.id);
  }
}
```

## Exemplos de Notificações

### 1. Fim de Turno para Operador
```
Tipo: end_of_shift
Destinatário: operator
Horário: 18:00 diário
Mensagem:
"⏰ FIM DE TURNO

Olá [Nome]!

Lembrete: Feche a máquina e registre as horas trabalhadas.

Como fazer:
1. Parar a máquina
2. Registrar horas no app
3. Anotar o horímetro final

Obrigado pela colaboração!"
```

### 2. Relatório Diário para Gestor
```
Tipo: daily_report
Destinatário: manager
Horário: 09:00 diário
Mensagem:
"📊 RELATÓRIO DIÁRIO

Hoje é [Data]

FROTA:
- Máquinas ativas: [X]
- Em manutenção: [Y]

OS HOJE:
- Concluídas: [Z]
- Pendentes: [W]

FINANCEIRO:
- Receitas: R$ [Valor]
- Despesas: R$ [Valor]

Próximos compromissos:
- [Agendamento 1]
- [Agendamento 2]"
```

### 3. Pendências de Pagamento
```
Tipo: pending_payments
Destinatário: manager
Horário: 10:00 segunda-feira
Mensagem:
"⚠️ PENDÊNCIAS DE COBRANÇA

Atenção, há pagamentos pendentes:

1. [Cliente] - R$ [Valor] - Vence em [Data]
2. [Cliente] - R$ [Valor] - Vence em [Data]
3. [Cliente] - R$ [Valor] - Vence em [Data]

Total pendente: R$ [Valor Total]

Ação recomendada: Contatar clientes para pagamento."
```

### 4. Manutenção de Máquina
```
Tipo: machine_maintenance
Destinatário: operator
Horário: 07:30 (antes do turno)
Mensagem:
"🔧 MANUTENÇÃO AGENDADA

Olá [Nome]!

A máquina [Nome da Máquina] precisa de manutenção hoje às [Horário].

Detalhes:
- Tipo: [Preventiva/Corretiva]
- Estimativa: [Duração]
- Peças necessárias: [Lista]

Por favor, prepare a máquina para a manutenção."
```

## Agendamento de Notificações

### Exemplo: Agendar Fim de Turno
```typescript
async function scheduleEndOfShiftNotifications() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0); // 18:00
  
  await supabase
    .from('scheduled_notifications')
    .insert({
      type: 'end_of_shift',
      target_role: 'operator',
      message: 'Lembrete: Fechar a máquina e registrar horas trabalhadas.',
      scheduled_time: tomorrow.toISOString()
    });
}
```

### Agendamento Recorrente
```typescript
async function scheduleDailyReports() {
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  
  // Agendar para os próximos 7 dias
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    await supabase
      .from('scheduled_notifications')
      .insert({
        type: 'daily_report',
        target_role: 'manager',
        message: 'Relatório diário do sistema.',
        scheduled_time: date.toISOString()
      });
  }
}
```

## Monitoramento de Envio

### Tabela de Logs
```sql
CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID REFERENCES scheduled_notifications(id),
  user_phone VARCHAR(20),
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Status de Envio
| Status | Descrição |
|--------|-----------|
| `sent` | Notificação enviada com sucesso |
| `failed` | Falha no envio |
| `pending` | Aguardando envio |
| `scheduled` | Agendada para envio futuro |

## Boas Práticas

1. **Agendar com antecedência** (pelo menos 1 minuto antes)
2. **Logar todos os envios** para auditoria
3. **Repetir notificações falhadas** (máx 3 vezes)
4. **Evitar horários de sono** (00:00-06:00)
5. **Personalizar mensagens** com nome do usuário
6. **Monitorar taxas de sucesso** e ajustar se necessário
7. **Permitir desativação** de notificações por usuário

## Integração com Edge Function

### Endpoint de Teste
```
GET /functions/v1/cron-notifications
Executa o envio de notificações agendadas
```

### Endpoint de Agendamento
```
POST /functions/v1/cron-notifications/schedule
{
  "type": "end_of_shift",
  "target_role": "operator",
  "message": "Mensagem personalizada",
  "scheduled_time": "2026-06-02T18:00:00Z"
}
```

## Testes de Notificação

### Teste Manual
```
1. Agendar notificação para 1 minuto
2. Aguardar
3. Verificar se foi enviada
4. Verificar log de envio
```

### Teste de Carga
```
1. Agendar 100 notificações
2. Verificar tempo de processamento
3. Verificar taxas de sucesso
4. Verificar erros de rate limiting
```