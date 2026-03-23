import { supabase } from './supabaseClient';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    company_id?: string;
    company_name?: string;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

class UserService {
    /**
     * Get current user profile
     */
    async getCurrentProfile(): Promise<UserProfile | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*, company:company_info(name)')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            return {
                ...data,
                company_name: data.company?.name
            };
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload user avatar
     */
    async uploadAvatar(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload file to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update profile with new avatar URL
            await this.updateProfile({ avatar_url: publicUrl });

            return { success: true, url: publicUrl };
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update user password
     */
    async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error updating password:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's notification settings
     */
    async getNotificationSettings() {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const { data, error } = await supabase
                .from('notification_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                // If settings don't exist, return defaults
                if (error.code === 'PGRST116') {
                    return {
                        pushMaintenance: true,
                        emailReports: true,
                        smsAlerts: false,
                        pushSchedule: true,
                        marketing: false
                    };
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            return {
                pushMaintenance: true,
                emailReports: true,
                smsAlerts: false,
                pushSchedule: true,
                marketing: false
            };
        }
    }

    /**
     * Update notification settings
     */
    async updateNotificationSettings(settings: any): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const { error } = await supabase
                .from('notification_settings')
                .upsert({
                    user_id: user.id,
                    ...settings,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error updating notification settings:', error);
            return { success: false, error: error.message };
        }
    }
}

export const userService = new UserService();
