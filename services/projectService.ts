import { supabase } from './supabase';
export const projectService = {
  async getAll() {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw error;
    return data || [];
  },
  async create(project: any) {
    const { data, error } = await supabase.from('projects').insert([project]).select().single();
    if (error) throw error;
    return data;
  }
};
