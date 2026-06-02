---
name: autenticacao-role
description: Autentica usuários e verifica papéis (operador, gestor, admin). Use no início de qualquer interação para determinar permissões.
allowed-tools: None
---

# Skill de Autenticação por Role

## Quando usar
- Receber mensagem do usuário pela primeira vez
- Antes de processar qualquer ação
- Para determinar o nível de acesso do usuário

## Papéis Disponíveis

| Papel | Permissões | Acesso |
|-------|------------|--------|
| `operator` | Registrar atividades | Horas, OS (via gestor), RDO |
| `manager` | Visualizar e criar | Tudo exceto exclusões diretas |
| `admin` | Acesso total | Todas as ações sem restrições |

## Fluxo de Autenticação

```
1. Receber número do usuário (phone)
2. Buscar no banco de dados
3. Verificar role
4. Injetar no contexto da IA
5. Aplicar restrições de acesso
```

## Tabela de Usuários

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operator', 'manager', 'admin')),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Verificação de Permissões

### Operador
```
✅ Pode:
- Registrar horas-máquina
- Criar OS (rascunho)
- Enviar RDO

❌ Não pode:
- Ver finanças
- Ver agenda completa
- Ver frota detalhada
- Excluir registros
```

### Gestor
```
✅ Pode:
- Ver finanças
- Ver agenda
- Ver frota
- Criar OS (direto)
- Criar agendamentos

❌ Não pode:
- Excluir registros diretamente
- Acessar dados de outros usuários
```

### Admin
```
✅ Pode:
- Todas as permissões de gestor
- Excluir registros
- Gerenciar usuários
- Acessar todos os dados
```

## Middleware de Autenticação

### Código de Verificação
```typescript
async function authenticateUser(phone: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, phone, role, name')
    .eq('phone', phone)
    .single();
  
  if (error) return null;
  return {
    id: data.id,
    phone: data.phone,
    role: data.role as 'operator' | 'manager' | 'admin',
    name: data.name || ''
  };
}
```

### Verificação de Role
```typescript
function isAdmin(userRole: string): boolean {
  return userRole === 'admin';
}

function isManager(userRole: string): boolean {
  return userRole === 'manager';
}

function isOperator(userRole: string): boolean {
  return userRole === 'operator';
}
```

## Contexto Injetado na IA

### Para Operador
```
Você é o OperaAI, assistente do TerraGes.

ATENÇÃO: Você é OPERADOR e NÃO tem acesso aos dados da empresa.
Seu trabalho é confirmar o recebimento de informações e orientar o gestor.

Se o operador pedir informações sobre:
- Frota: "Apenas gestores têm acesso a informações da frota."
- Financeiro: "Apenas gestores têm acesso ao financeiro."
- Relatórios: "Peça ao gestor para gerar o relatório no app."
- Agenda: "Peça ao gestor para verificar a agenda."
- Máquinas: "Peça ao gestor para verificar as máquinas."

Se o operador informar dados para registro (horas, OS, etc):
- Responda: "Dados recebidos! Seu gestor vai confirmar e registrar no sistema."
- Não crie nenhum registro, apenas confirme o recebimento.

IMPORTANTE: Nunca revele dados financeiros, de frotas, agenda ou qualquer informação da empresa.
```

### Para Gestor
```
Você é o OperaAI, assistente inteligente do TerraGes.
Atende via WhatsApp. Seja direto, cordial e use português simples.
NUNCA invente dados. Use APENAS as informações abaixo.

=== FROTA ===
[Lista de máquinas]

=== FINANCEIRO ===
[Resumo financeiro com pendências]

=== PRÓXIMOS AGENDAMENTOS ===
[Lista de agendamentos]

=== INSTRUÇÕES DE AÇÕES (GESTOR) ===
Você pode criar OS, agendamentos e ver relatórios.
Para criar OS: [[CREATE_OS:{"client":"...","date":"...","payment_method":"...","description":"..."}]]
Para agendar: [[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"..."}]]
```

### Para Admin
```
Você é o OperaAI, assistente inteligente do TerraGes.
Atende via WhatsApp. Seja direto, cordial e use português simples.
NUNCA invente dados. Use APENAS as informações abaixo.

=== FROTA ===
[Lista de máquinas]

=== FINANCEIRO ===
[Resumo financeiro completo]

=== PRÓXIMOS AGENDAMENTOS ===
[Lista de agendamentos]

=== INSTRUÇÕES DE AÇÕES (ADMIN) ===
Você tem acesso total ao sistema.
Para criar OS: [[CREATE_OS:{"client":"...","date":"...","payment_method":"...","description":"...","save":"direct"}]]
Para agendar: [[CREATE_SCHEDULE:{"title":"...","type":"...","start_time":"..."}]]
Para excluir: [[DELETE_RECORD:type:id]]
```

## Restrições por Role

### Ações Bloqueadas para Operador
```
❌ Ver transações
❌ Ver agenda completa
❌ Ver frota detalhada
❌ Excluir registros
❌ Criar OS direto (apenas rascunho)
```

### Ações Bloqueadas para Gestor
```
❌ Excluir registros diretamente
❌ Gerenciar usuários
❌ Acessar dados sensíveis de outros usuários
```

### Ações Disponíveis para Admin
```
✅ Todas as ações
✅ Excluir registros
✅ Gerenciar usuários
✅ Acessar todos os dados
```

## Segurança

1. **Sempre verificar role antes de processar ação**
2. **Nunca expor dados sensíveis para operadores**
3. **Validar que usuário existe no banco**
4. **Logar tentativas de acesso não autorizadas**
5. **Atualizar cache de role se necessário**

## Exemplo de Uso

```
Usuário: "Qual o saldo da empresa?"

1. Autenticar usuário
2. Verificar role
3. Se operador: "Apenas gestores têm acesso ao financeiro."
4. Se gestor: Mostrar saldo atual
5. Se admin: Mostrar saldo e detalhes completos
```