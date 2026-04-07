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
        const { data, error } = await supabase
            .from('rdos')
            .select('*, projects(name)')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching RDOs:', error);
            throw error;
        }

        return data || [];
    },

    async create(rdoData: RDOFormData): Promise<RDO> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('rdos')
            .insert([{ ...rdoData, user_id: user?.id }])
            .select()
            .single();

        if (error) {
            console.error('Error creating RDO:', error);
            throw error;
        }

        // Trigger AI Analysis in background (don't block the UI)
        intelligenceService.analyzeRDO(data.id).catch(err => {
            console.error('Falha na análise automática do RDO:', err);
        });

        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('rdos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting RDO:', error);
            throw error;
        }
    }
};
