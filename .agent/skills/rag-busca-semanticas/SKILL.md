---
name: rag-busca-semanticas
description: Realiza buscas semânticas em registros históricos usando embeddings. Use para consultas de dados históricos e relatórios longos.
allowed-tools: None
---

# Skill de RAG (Recuperação Aumentada por Geração)

## Quando usar
- Usuário pede dados históricos (últimos 30 dias, mês anterior, etc)
- Usuário faz perguntas sobre relatórios longos
- Precisar buscar informações relevantes no histórico
- Gerar insights baseados em dados passados

## Arquitetura

```
┌─────────────────┐
│   Query User    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Gerar Embedding │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Buscar Similar │
│    Records      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Construir      │
│   Contexto      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Gerar Resposta│
└─────────────────┘
```

## Tabela de Embeddings

```sql
CREATE TABLE operational_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN ('rdo', 'service_order', 'machine_hours')),
  record_id UUID NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_vector 
  ON operational_embeddings (embedding vector_cosine_distance(1536));
```

## Geração de Embedding

### API OpenAI
```
POST https://api.openai.com/v1/embeddings
Authorization: Bearer {OPENROUTER_API_KEY}
Content-Type: application/json

{
  "input": "texto para embedding",
  "model": "text-embedding-ada-002"
}
```

### Resposta
```json
{
  "data": [
    {
      "embedding": [0.1, 0.2, ..., 0.9]
    }
  ]
}
```

## Busca de Similaridade

### Função RPC no Supabase
```sql
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  record_type TEXT,
  record_id UUID,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.record_type,
    e.record_id,
    e.content,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM operational_embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

## Fluxo de Consulta

### Exemplo: "Como foram as operações na obra X nos últimos 15 dias?"

```
1. Receber pergunta do usuário
2. Gerar embedding da pergunta
3. Buscar registros similares (top 10, threshold 0.7)
4. Filtrar por data (últimos 15 dias)
5. Construir contexto com os resultados
6. Enviar para LLM gerar resposta
```

## Formato de Contexto

```json
{
  "question": "Como foram as operações na obra X nos últimos 15 dias?",
  "results": [
    {
      "type": "service_order",
      "id": "uuid-123",
      "content": "OS #123 - Cliente: João Silva, Valor: R$ 5000, Data: 2026-05-20",
      "relevance": 0.92
    },
    {
      "type": "rdo",
      "id": "uuid-456",
      "content": "RDO de 2026-05-20 - Atividades: Terraplanagem, Máquinas: 3",
      "relevance": 0.88
    }
  ]
}
```

## Prompt para LLM

```
Usuário está perguntando: "Como foram as operações na obra X nos últimos 15 dias?"

Contexto relevante do histórico:
[
  {
    "type": "service_order",
    "id": "uuid-123",
    "content": "OS #123 - Cliente: João Silva, Valor: R$ 5000, Data: 2026-05-20",
    "relevance": 0.92
  },
  {
    "type": "rdo",
    "id": "uuid-456",
    "content": "RDO de 2026-05-20 - Atividades: Terraplanagem, Máquinas: 3",
    "relevance": 0.88
  }
]

Baseado nesse contexto, forneça uma resposta detalhada e precisa.
```

## Tipos de Registros Indexados

| Tipo | Descrição | Fonte |
|------|-----------|-------|
| `rdo` | Relatório Diário de Obra | Tabela `rdos` |
| `service_order` | Ordem de Serviço | Tabela `service_orders` |
| `machine_hours` | Horas-Máquina | Tabela `service_orders` (horímetro) |

## Parâmetros de Busca

| Parâmetro | Valor Padrão | Descrição |
|-----------|--------------|-----------|
| `match_threshold` | 0.7 | Mínimo de similaridade (0-1) |
| `match_count` | 10 | Número máximo de resultados |
| `date_filter` | variável | Filtro de data (ex: últimos 30 dias) |

## Boas Práticas

1. **Sempre filtrar por data** quando o usuário especificar período
2. **Limitar a 10 resultados** para não sobrecarregar o contexto
3. **Ordenar por similaridade** (mais relevantes primeiro)
4. **Incluir apenas campos relevantes** no contexto
5. **Verificar threshold** para evitar resultados ruins

## Exemplos de Consultas

### Exemplo 1: Relatório Mensal
```
Usuário: "Como foram as finanças do último mês?"

→ Buscar transações do último mês
→ Gerar resumo de receitas/despesas
→ Identificar categorias principais
```

### Exemplo 2: Análise de Frota
```
Usuário: "Qual o status das máquinas nos últimos 30 dias?"

→ Buscar RDOs e manutenções do período
→ Identificar paradas e falhas
→ Gerar relatório de disponibilidade
```

### Exemplo 3: Comparativo
```
Usuário: "Comparar janeiro e fevereiro"

→ Buscar dados de ambos os meses
→ Gerar comparação lado a lado
→ Identificar tendências
```