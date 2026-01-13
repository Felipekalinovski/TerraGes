import { supabase } from './supabase';
export const maintenanceService = {
  async getAll() {
    const { data, error } = await supabase.from('maintenance_records').select('*, machines(name)');
    if (error) throw error;
    return data || [];
  }
};
