import { supabase } from './supabase';
import { intelligenceService } from './intelligenceService';

export const rdoService = {
    async getAll() {
        const { data, error } = await supabase.from('rdos').select('*, projects(name)').order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async create(rdoData: any) {
        const { data, error } = await supabase.from('rdos').insert([rdoData]).select().single();
        if (error) throw error;
        intelligenceService.analyzeRDO(data.id).catch(console.error);
        return data;
    },
    async delete(id: string) {
        const { error } = await supabase.from('rdos').delete().eq('id', id);
        if (error) throw error;
    }
};
