---
name: triagem-classificacao
description: Classifica intenções de mensagens do WhatsApp em categorias específicas. Use quando precisar identificar o tipo de requisição do usuário.
allowed-tools: None
---

# Skill de Triagem e Classificação de Intenções

## Quando usar
- Receber mensagem do usuário e precisar identificar a categoria
- Processar requisições para rotear para skills especializadas

## Categorias Disponíveis

| Categoria | Descrição | Exemplos |
|-----------|-----------|----------|
| `fleet` | Gestão de frota (máquinas, manutenção) | "Status da escavadeira", "Manutenção da pá carregadeira" |
| `machine_hours` | Registro de horas-máquina | "Registrar 8h da escavadeira", "Horímetro da retro" |
| `rdo` | Relatório diário de operações | "RDO de hoje", "Relatório diário" |
| `finance` | Finanças e relatórios financeiros | "Como estão as finanças?", "Relatório de despesas" |
| `schedule` | Agendamentos e planejamento | "Agendar manutenção", "Próximos compromissos" |
| `service_order` | Ordens de serviço | "Criar OS para cliente X", "OS pendentes" |
| `delete_record` | Exclusão de registros | "Excluir OS #123", "Remover registro" |
| `historical_query` | Análise de dados históricos | "Últimos 30 dias", "Relatório longo", "Histórico de X" |
| `off_scope` | Fora do escopo | "Como faço para sair?", "Outras dúvidas" |

## Classificação por Role do Usuário

### Operador
- Apenas pode registrar atividades
- Não tem acesso a finanças, relatórios, agenda
- Deve ser redirecionado para gestor para informações sensíveis

### Gestor
- Pode ver relatórios e pendências
- Pode criar OS e agendamentos
- Não pode excluir registros diretamente

### Admin
- Acesso total ao sistema
- Pode efetivar ações sem confirmação
- Pode excluir registros

## Regras de Classificação

1. **Sempre identifique o role do usuário primeiro**
2. **Classifique a intenção principal da mensagem**
3. **Retorne JSON com categoria e confiança (0-1)**
4. **Se houver dúvida, use 'off_scope'**

## Formato de Resposta

```json
{
  "category": "finance",
  "confidence": 0.95,
  "context": {
    "user_role": "manager",
    "keywords": ["finanças", "despesas", "receitas"]
  }
}
```

## Exemplos de Prompt para Classificação

```
Classifique a mensagem do usuário em uma categoria:

Categorias disponíveis:
- fleet: gestão de frota (máquinas, manutenção)
- machine_hours: registro de horas-máquina
- rdo: relatório diário de operações
- finance: finanças e relatórios financeiros
- schedule: agendamentos e planejamento
- service_order: ordens de serviço
- delete_record: exclusão de registros
- historical_query: análise de dados históricos
- off_scope: fora do escopo do sistema

Usuário é: manager

Mensagem: "Como estão as finanças da empresa?"

Responda apenas com a categoria e confiança (0-1).
```