import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTechnicalKnowledgeContext,
  searchTechnicalKnowledge,
} from '../../supabase/functions/_shared/technical-knowledge.ts';

const entry = {
  knowledge_key: 'manutencao_fluidos_filtros',
  domain: 'manutencao',
  topic: 'fluidos',
  title: 'Fluidos e filtros',
  summary: 'Dados variam por modelo.',
  guidance: ['Solicite o manual.'],
  applicability: {scope: 'model_specific'},
  risk_level: 'critical',
  requires_model_manual: true,
  requires_professional: true,
  tags: ['óleo'],
  revision: 1,
  sources: [{
    source_key: 'mte_nr12', authority: 'MTE', title: 'NR-12',
    url: 'https://www.gov.br/example', verified_on: '2026-09-19',
  }],
};

test('technical search normalizes query, domains and result limit', async () => {
  let args: unknown;
  const db = {rpc: async (_name: string, input: unknown) => {
    args = input;
    return {data: [entry]};
  }};
  const result = await searchTechnicalKnowledge(db, '  óleo hidráulico  ', ['manutencao','manutencao'], 99);
  assert.deepEqual(args, {p_query: 'óleo hidráulico', p_domains: ['manutencao'], p_limit: 20});
  assert.equal(result[0].sources[0].source_key, 'mte_nr12');
});

test('technical search rejects unsourced or malformed knowledge', async () => {
  const db = {rpc: async () => ({data: [{...entry, sources: []}]})};
  await assert.rejects(() => searchTechnicalKnowledge(db, 'óleo'), /technical_knowledge_unavailable/);
});

test('technical context requires model manual, professional and citation handling', () => {
  const context = buildTechnicalKnowledgeContext([entry] as any);
  assert.match(context, /fabricante/);
  assert.match(context, /contador/);
  assert.match(context, /URL/);
});
