import { supabase } from './supabaseClient';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

class UserService {
    async getCurrentProfile(): Promise<UserProfile | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    }

    async updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
            const { error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', user.id);
            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadAvatar(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { cacheControl: '3600', upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
            await this.updateProfile({ avatar_url: publicUrl });
            return { success: true, url: publicUrl };
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            return { success: false, error: error.message };
        }
    }
}

export const userService = new UserService();
