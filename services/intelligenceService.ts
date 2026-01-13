import { supabase } from './supabase';
import { analyzeText } from './geminiService';

export const intelligenceService = {
  async analyzeRDO(rdoId: string) {
    const { data: rdo } = await supabase.from('rdos').select('*').eq('id', rdoId).single();
    if (!rdo) return;
    const prompt = `Analise este RDO: ${rdo.activities}. Retorne JSON com classification, severity e tags.`;
    const aiResponse = await analyzeText(prompt, rdo.activities);
    // Simple mock logic for now to ensure build
    return { classification: 'atividade produtiva', severity: 'baixa', tags: ['obra'] };
  }
};
