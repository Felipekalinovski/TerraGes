---
name: processamento-financeiro-insights
description: Processa dados financeiros e gera insights. Use quando gestores pedirem relatórios financeiros ou análise de saúde financeira.
allowed-tools: None
---

# Skill de Processamento Financeiro com Insights

## Quando usar
- Gestor pede relatório financeiro
- Usuário quer análise de saúde financeira
- Necessidade de identificar tendências financeiras
- Projeção de caixa e previsão de receitas

## Dados Financeiros Disponíveis

### Fontes de Dados
```
1. Transações (transactions)
   - Receitas (income)
   - Despesas (expense)
   - Status (paid/pending)

2. Ordens de Serviço (service_orders)
   - Valor total
   - Forma de pagamento
   - Status

3. Agendamentos (schedules)
   - Receitas futuras
   - Despesas planejadas
```

### Estrutura de Transação
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
  user_id UUID REFERENCES auth.users(id)
);
```

## Métricas Financeiras

### Métricas Principais
```
1. Receita Total
   - Soma de todas as receitas
   - Por categoria
   - Por período

2. Despesa Total
   - Soma de todas as despesas
   - Por categoria
   - Por período

3. Margem/Lucro
   - Receita - Despesa
   - Margem (%): (Lucro / Receita) * 100

4. Pendências
   - Receitas pendentes
   - Despesas pendentes
   - Valor total a receber/pagar
```

### Métricas por Categoria

#### Receitas
| Categoria | Exemplos |
|-----------|----------|
| `Serviços` | OS concluídas, honorários |
| `Vendas` | Produtos, equipamentos |
| `Outros` | Multas, juros, outros |

#### Despesas
| Categoria | Exemplos |
|-----------|----------|
| `Combustível` | Gasolina, diesel, etanol |
| `Manutenção` | Reparos, peças, serviços |
| `Salários` | Folha de pagamento |
| `Administração` | Escritório, software, serviços |
| `Impostos` | Tributos, taxas |
| `Outros` | Diversos |

## Geração de Insights

### Insights de Saúde Financeira

#### 1. Análise de Margem
```
Entrada: Receita = R$ 50.000, Despesa = R$ 35.000
Saída: Margem = R$ 15.000 (30%)

Insight: "Margem de 30% está dentro da faixa saudável (20-40%)."
```

#### 2. Tendência de Receita
```
Entrada: Receita mês atual = R$ 50.000, Mês anterior = R$ 45.000
Saída: Crescimento de 11,1%

Insight: "Receita cresceu 11,1% em relação ao mês anterior. Tendência positiva."
```

#### 3. Despesas por Categoria
```
Entrada: Despesas por categoria
Saída: Top 3 categorias com maior gasto

Insight: "Combustível representa 35% das despesas. Considere otimização de rotas."
```

#### 4. Pendências de Cobrança
```
Entrada: Transações pendentes
Saída: Lista de pendências com valores e datas

Insight: "R$ 15.000 em pendências, com vencimento nos próximos 7 dias. Ação recomendada: Cobrar clientes."
```

### Projeção de Caixa

#### Método de Projeção
```
1. Receitas Projetadas
   - Receitas pendentes
   - Contratos futuros
   - Tendência histórica

2. Despesas Projetadas
   - Despesas pendentes
   - Contratos futuros
   - Tendência histórica

3. Saldo Projetado
   - Saldo atual + Receitas - Despesas
```

#### Exemplo de Projeção
```
Entrada: Saldo atual = R$ 10.000, Pendências = R$ 15.000, Despesas = R$ 8.000
Saída: Saldo futuro = R$ 17.000

Insight: "Saldo projetado de R$ 17.000 após 7 dias. Nível saudável."
```

## Prompt para LLM com Insights

### Prompt Estruturado
```
Você é um consultor financeiro especializado em empresas de terraplanagem.

DADOS FINANCEIROS (últimos 30 dias):

=== RECEITAS ===
Total: R$ 50.000,00
Por categoria:
- Serviços: R$ 45.000 (90%)
- Vendas: R$ 5.000 (10%)

=== DESPESAS ===
Total: R$ 35.000,00
Por categoria:
- Combustível: R$ 12.000 (34%)
- Manutenção: R$ 8.000 (23%)
- Salários: R$ 10.000 (29%)
- Administração: R$ 5.000 (14%)

=== MÉTRICAS ===
Lucro: R$ 15.000 (30% de margem)
Pendências de receita: R$ 5.000
Pendências de despesa: R$ 2.000

=== ANÁLISE DE TENDÊNCIA ===
Receita mês anterior: R$ 45.000 (crescimento de 11,1%)

BASEADO NESSAS INFORMAÇÕES, FORNEÇA:

1. Resumo executivo (2-3 linhas)
2. Análise de saúde financeira
3. Principais pontos de atenção
4. Recomendações específicas
5. Projeção de caixa para próximos 7 dias

SEJA DIRETO, USE PORTUGUÊS BRASILEIRO E EVITE JARGÕES FINANCEIROS COMPLEXOS.
```

## Formato de Resposta com Insights

### Exemplo de Resposta
```
📊 RELATÓRIO FINANCEIRO - MÊS VIGENTE

=== RESUMO EXECUTIVO ===
A empresa registrou receita de R$ 50.000 e despesa de R$ 35.000, resultando em lucro de R$ 15.000 (30% de margem). A receita cresceu 11,1% em relação ao mês anterior.

=== SAÚDE FINANCEIRA ===
✅ Margem de 30% está saudável (meta: 20-40%)
⚠️ Pendências de R$ 5.000 precisam ser cobradas
✅ Despesas controladas (70% da receita)

=== PONTOS DE ATENÇÃO ===
1. Combustível representa 34% das despesas - otimizar rotas
2. Pendências de cobrança podem impactar fluxo de caixa

=== RECOMENDAÇÕES ===
1. Cobrar pendências nos próximos 7 dias
2. Negociar descontos com fornecedores de combustível
3. Considerar aumento de preços se margem diminuir

=== PROJEÇÃO DE CAIXA (7 dias) ===
Saldo atual: R$ 10.000
+ Receitas pendentes: R$ 5.000
- Despesas pendentes: R$ 2.000
= Saldo projetado: R$ 13.000
```

## Alertas Financeiros Proativos

### Alerta 1: Pendências de Cobrança
```
⚠️ PENDÊNCIAS DE COBRANÇA

Há R$ 15.000 em pendências, com vencimento nos próximos 7 dias:

1. Cliente A - R$ 5.000 - Vence em 05/06/2026
2. Cliente B - R$ 3.000 - Vence em 07/06/2026
3. Cliente C - R$ 7.000 - Vence em 10/06/2026

Ação recomendada: Contatar clientes para agendamento de pagamento.
```

### Alerta 2: Margem Baixa
```
⚠️ MARGEM COMPROMETIDA

A margem atual é de 15%, abaixo da meta de 20%.

Principais causas:
- Despesas com combustível aumentaram 25%
- Receita caiu 10% em relação ao mês anterior

Ação recomendada: Revisar preços e otimizar custos.
```

### Alerta 3: Crescimento Positivo
```
✅ CRESCIMENTO POSITIVO

Receita cresceu 20% em relação ao mês anterior!

Principais impulsionadores:
- 5 OS concluídas a mais que o mês anterior
- Aumento de 15% no valor médio das OS

Ação recomendada: Manter ritmo e considerar expansão de equipe.
```

## Boas Práticas

1. **Sempre mostrar both receitas e despesas** para contexto completo
2. **Identificar tendências** em relação ao mês anterior
3. **Destacar pendências** com datas específicas
4. **Fornecer recomendações** práticas e acionáveis
5. **Usar linguagem simples** e direta
6. **Incluir projeções** de caixa quando possível
7. **Destacar pontos de atenção** e oportunidades