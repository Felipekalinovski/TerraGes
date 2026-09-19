import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTerraGesKnowledgeContext,
  loadTerraGesKnowledge,
} from '../../supabase/functions/_shared/terrages-knowledge.ts';

const validModule = {
  module_key: 'financeiro',
  module_name: 'Financeiro',
  purpose: 'Controla receitas e despesas.',
  source_tables: ['transactions'],
  required_fields: [],
  optional_fields: [],
  generated_fields: [],
  states: {},
  permissions: {},
  business_rules: [],
  agent_actions: [],
  aliases: ['despesa'],
  knowledge_version: 1,
};

test('knowledge loader requests only selected modules and removes duplicates', async () => {
  let args: unknown;
  const db = {rpc: async (_name: string, input: unknown) => {
    args = input;
    return {data: [validModule]};
  }};
  const result = await loadTerraGesKnowledge(db, ['financeiro', 'financeiro']);
  assert.deepEqual(args, {p_module_keys: ['financeiro']});
  assert.equal(result[0].module_key, 'financeiro');
});

test('knowledge loader fails closed when the database contract is malformed', async () => {
  const db = {rpc: async () => ({data: [{module_key: 'financeiro'}]})};
  await assert.rejects(() => loadTerraGesKnowledge(db), /terrages_knowledge_unavailable/);
});

test('knowledge context carries identity and persistence rules', () => {
  const context = buildTerraGesKnowledgeContext([validModule] as any);
  assert.match(context, /Nunca aceite company_id/);
  assert.match(context, /identificador persistido/);
  assert.match(context, /America\/Sao_Paulo/);
});
