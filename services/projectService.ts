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
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }

        return data || [];
    },

    async create(project: Partial<Project>): Promise<Project> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('projects')
            .insert([{ ...project, user_id: user?.id }])
            .select()
            .single();

        if (error) {
            console.error('Error creating project:', error);
            throw error;
        }

        return data;
    },

    async update(id: string, project: Partial<Project>): Promise<Project> {
        const { data, error } = await supabase
            .from('projects')
            .update(project)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating project:', error);
            throw error;
        }

        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }
};
