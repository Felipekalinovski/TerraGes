import { supabase } from './supabaseClient';

export interface Project {
    id: string;
    name: string;
    location?: string;
    status: 'active' | 'completed' | 'on_hold';
    created_at: string;
}

export const projectService = {
    async getAll(): Promise<Project[]> {
        const { data, error } = await supabase.from('projects').select('*').order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    },
    async create(project: Partial<Project>): Promise<Project> {
        const { data, error } = await supabase.from('projects').insert([project]).select().single();
        if (error) throw error;
        return data;
    }
};
