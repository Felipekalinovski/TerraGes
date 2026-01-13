import { supabase } from './supabase';
export const userService = {
  async getCurrentProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (error) return null;
    return data;
  },
  async updateProfile(profile: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('user_profiles').upsert({ id: user?.id, ...profile });
    return { success: !error, error: error?.message };
  }
};
