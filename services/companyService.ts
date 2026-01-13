import { supabase } from './supabase';
export const companyService = {
  async getCompanyProfile() {
    const { data, error } = await supabase.from('company_profiles').select('*').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  async updateCompanyProfile(profile: any) {
    const { error } = await supabase.from('company_profiles').upsert(profile);
    return { success: !error, error: error?.message };
  }
};
