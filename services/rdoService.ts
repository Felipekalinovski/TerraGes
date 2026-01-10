import { supabase } from './supabaseClient';
import { intelligenceService } from './intelligenceService';

export interface RDO {
    id: string;
    project_id: string;
    operator_id?: string;
    date: string;
    weather?: string;
    team_size?: number;
    activities: string;
    machines?: string[];
    occurrences?: string;
    created_at: string;
}

export interface RDOFormData {
    project_id: string;
    operator_id?: string;
    date: string;
    weather?: string;
    team_size?: number;
    activities: string;
    machines?: string[];
    occurrences?: string;
}

export const rdoService = {
    async getAll(): Promise<RDO[]> {
        const { data, error } = await supabase.from('rdos').select('*, projects(name)').order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async create(rdoData: RDOFormData): Promise<RDO> {
        const { data, error } = await supabase.from('rdos').insert([rdoData]).select().single();
        if (error) throw error;
        intelligenceService.analyzeRDO(data.id).catch(console.error);
        return data;
    },
    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('rdos').delete().eq('id', id);
        if (error) throw error;
    }
};
