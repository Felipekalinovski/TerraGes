import { supabase } from './supabase';
export const machineService = {
  async getAll() {
    const { data, error } = await supabase.from('machines').select('*');
    if (error) throw error;
    return data || [];
  },
  async getStats() {
    const { data, error } = await supabase.from('machines').select('status');
    if (error) throw error;
    return { total: data.length, active: data.filter(m => m.status === 'active').length };
  }
};
