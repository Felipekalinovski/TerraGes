---
name: processamento-os-novos-campos
description: Processa Ordens de Serviço com novos campos (CPF, contato, localização). Use ao criar ou atualizar OS.
allowed-tools: None
---

# Skill de Processamento de OS com Novos Campos

## Quando usar
- Criar nova OS via WhatsApp
- Atualizar OS existente
- Validar dados da OS antes de salvar
- Processar comando `[[CREATE_OS:...]]`

## Novos Campos Obrigatórios

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `client_cpf` | TEXT | CPF ou CNPJ do cliente | "123.456.789-00" |
| `client_contact` | TEXT | Telefone do cliente | "(11) 98888-1111" |
| `location` | TEXT | Endereço completo do serviço | "Av. Paulista, 1000" |
| `payment_method` | TEXT | Forma de pagamento | "Pix", "Cheque", etc |

## Formato do Comando

### Estrutura Completa
```
[[CREATE_OS:{"client":"Nome do Cliente","client_cpf":"123.456.789-00","client_contact":"(11) 98888-1111","date":"2026-06-01","start_hour":8,"end_hour":16,"hourly_rate":150,"payment_method":"Cheque","location":"Av. Paulista, 1000","description":"Serviços de terraplanagem","save":"draft"}]]
```

### Estrutura Simplificada (com campos extras)
```
[[CREATE_OS:{"client":"João Silva","client_cpf":"123.456.789-00","client_contact":"(11) 98888-1111","date":"2026-06-01","payment_method":"Cheque","location":"Av. Paulista 1000","description":"Terraplanagem","save":"direct"}]]
```

## Validação de Dados

### Regras de Validação
```
✅ client: obrigatório, texto não vazio
✅ client_cpf: obrigatório, formato válido (11 dígitos ou CNPJ)
✅ client_contact: obrigatório, formato válido (DDD + número)
✅ date: obrigatório, formato YYYY-MM-DD
✅ payment_method: obrigatório, um dos valores permitidos
✅ location: obrigatório, texto não vazio
✅ start_hour: obrigatório, número entre 0-24
✅ end_hour: obrigatório, número entre 0-24
✅ hourly_rate: obrigatório, número positivo
✅ description: opcional, texto
✅ save: "draft" ou "direct"
```

### Validação de CPF/CNPJ
```
CPF: 11 dígitos (ex: 12345678900 ou 123.456.789-00)
CNPJ: 14 dígitos (ex: 12345678000190 ou 12.345.678/0001-90)
```

### Validação de Telefone
```
Formato: (XX) 9XXXX-XXXX
Ou: XX9XXXXXXXX
Mínimo: 10 dígitos
Máximo: 11 dígitos
```

## Formas de Pagamento Permitidas

| Método | Descrição | Status Inicial |
|--------|-----------|----------------|
| `Pix` | Pagamento imediato via Pix | `paid` |
| `Cartão` | Pagamento via cartão | `paid` |
| `Boleto` | Pagamento por boleto bancário | `pending` |
| `Faturado` | Pagamento futuro (faturamento) | `pending` |
| `Dinheiro` | Pagamento em dinheiro | `paid` |
| `Cheque` | Pagamento por cheque | `pending` |

## Status da Transação

| Forma de Pagamento | Status da Transação | Descrição |
|--------------------|---------------------|-----------|
| `Pix` | `paid` | Pagamento imediato |
| `Cartão` | `paid` | Pagamento imediato |
| `Dinheiro` | `paid` | Pagamento imediato |
| `Boleto` | `pending` | Aguardando pagamento |
| `Faturado` | `pending` | Aguardando faturamento |
| `Cheque` | `pending` | Aguardando compensação |

## Processamento de Comando

### Código de Processamento
```typescript
const osMatch = aiResponse.match(/\[\[CREATE_OS:(.*?)\]\]/s);
if (osMatch) {
  const parsed = JSON.parse(osMatch[1]);
  const { save, ...osData } = parsed;
  
  // Validar campos obrigatórios
  if (!osData.client_cpf || !osData.client_contact || !osData.location) {
    return "Faltam dados obrigatórios (CPF, contato ou localização).";
  }
  
  if (save !== "draft") {
    // Verificar forma de pagamento e definir status
    const status = ['Boleto', 'Faturado', 'Cheque'].includes(osData.payment_method) 
      ? 'pending' 
      : 'completed';
    
    const { error } = await supabase.from("service_orders").insert([{
      ...osData,
      user_id: userId,
      status: status
    }]);
    
    if (error) {
      return `Erro ao criar OS: ${error.message}`;
    }
    
    return `OS criada com sucesso! ID: ${osData.id || 'novo'}`;
  } else {
    return "OS salva como rascunho — confirme no app.";
  }
}
```

## Exemplos de Uso

### Exemplo 1: OS Completa com Cheque
```
Usuário: "Registrar serviço de terraplanagem ontem para cliente André Costa, CPF 123.456.789-00, contato (11) 98888-1111, Av Paulista 1000, R$ 1200, pagamento em Cheque"

→ Processar e criar OS com:
  - client: "André Costa"
  - client_cpf: "123.456.789-00"
  - client_contact: "(11) 98888-1111"
  - location: "Av Paulista 1000"
  - payment_method: "Cheque"
  - total_value: 1200
  - status: "pending" (porque é Cheque)
```

### Exemplo 2: OS com Faturado
```
Usuário: "Criar OS para João Silva, CPF 456.789.123-00, contato (21) 99999-8888, Rua das Flores 500, serviço de escavação, R$ 3500, faturado para o mês que vem"

→ Processar e criar OS com:
  - client: "João Silva"
  - client_cpf: "456.789.123-00"
  - client_contact: "(21) 99999-8888"
  - location: "Rua das Flores 500"
  - payment_method: "Faturado"
  - total_value: 3500
  - status: "pending"
```

### Exemplo 3: OS com Pix (Pagamento Imediato)
```
Usuário: "OS para Maria Oliveira, CPF 789.123.456-00, (31) 97777-6666, Rua das Acácias 200, serviço de nivelamento, R$ 2800, Pix"

→ Processar e criar OS com:
  - client: "Maria Oliveira"
  - client_cpf: "789.123.456-00"
  - client_contact: "(31) 97777-6666"
  - location: "Rua das Acácias 200"
  - payment_method: "Pix"
  - total_value: 2800
  - status: "completed" (porque é Pix)
```

## Tabela de Service Orders (Estrutura)

```sql
CREATE TABLE service_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  client TEXT NOT NULL,
  client_cpf TEXT,  -- NOVO
  client_contact TEXT,  -- NOVO
  machine_id UUID REFERENCES machines(id),
  operator_id UUID REFERENCES employees(id),
  start_hour NUMERIC NOT NULL,
  end_hour NUMERIC NOT NULL,
  total_hours NUMERIC GENERATED ALWAYS AS (end_hour - start_hour) STORED,
  hourly_rate NUMERIC NOT NULL,
  total_value NUMERIC GENERATED ALWAYS AS ((end_hour - start_hour) * hourly_rate) STORED,
  payment_method TEXT CHECK (payment_method IN ('Pix', 'Cartão', 'Boleto', 'Faturado', 'Dinheiro', 'Cheque')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  location TEXT,  -- NOVO
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Boas Práticas

1. **Sempre validar CPF/CNPJ** antes de salvar
2. **Formatar telefone** corretamente
3. **Verificar forma de pagamento** para definir status
4. **Incluir localização completa** (rua, número, bairro, cidade)
5. **Salvar como rascunho** se dados incompletos
6. **Notificar usuário** quando OS for criada com sucesso
7. **Incluir ID da OS** na resposta de confirmação