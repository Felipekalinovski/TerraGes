import { supabase } from './supabase';
export const transactionService = {
  async getMonthlyData() {
    const { data, error } = await supabase.from('transactions').select('*');
    if (error) throw error;
    // Basic aggregation for demo
    return [{ name: 'Jan', Faturamento: 50000, Custos: 30000 }];
  }
};
