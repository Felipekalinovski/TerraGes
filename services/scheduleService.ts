import { supabase } from './supabase';
export const scheduleService = {
  async getAll() {
    const { data, error } = await supabase.from('schedules').select('*');
    if (error) throw error;
    return data || [];
  }
};
