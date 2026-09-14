import { supabase } from './supabaseClient';
import { uploadPrivateFile, resolvePrivateFile } from './storageService';
export type UserRole = 'admin' | 'gestor' | 'operator';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    company_id?: string;
    company_name?: string;
    avatar_url?: string;
    onboarding_completed?: boolean;
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
                company_name: data.company?.name,
                avatar_url: await resolvePrivateFile(data.avatar_url)
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
                    ...(updates.name !== undefined ? {name:updates.name} : {}),
                    ...(updates.avatar_url !== undefined ? {avatar_url:updates.avatar_url} : {}),
                    ...(updates.onboarding_completed !== undefined ? {onboarding_completed:updates.onboarding_completed} : {}),
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

            const reference = await uploadPrivateFile('avatars',file);
            const result = await this.updateProfile({avatar_url:reference});
            if (!result.success) throw new Error(result.error);
            return {success:true,url:await resolvePrivateFile(reference)};
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
