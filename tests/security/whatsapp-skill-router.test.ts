import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listWhatsAppSkills,selectWhatsAppSkill} from '../../supabase/functions/_shared/whatsapp-skill-router.ts';

test('skill router selects one deterministic skill before any model call',()=>{
 assert.equal(selectWhatsAppSkill('Registre um RDO de hoje'),'actions');
 assert.equal(selectWhatsAppSkill('Quais máquinas estão disponíveis?'),'operational_queries');
 assert.equal(selectWhatsAppSkill('Calcule o volume de 10 m por 5 m por 2 m de argila'),'earthwork_quote');
 assert.equal(selectWhatsAppSkill('CONFIRMAR'),'actions');
 assert.equal(selectWhatsAppSkill('Bom dia'),'fallback');
 assert.deepEqual(listWhatsAppSkills().map(x=>x.id),['actions','operational_queries','earthwork_quote']);
});
