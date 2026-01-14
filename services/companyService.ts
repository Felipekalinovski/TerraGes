import { supabase } from './supabaseClient';

export interface CompanyProfile {
    id: string;
    name: string;
    cnpj?: string;
    address?: string;
    website?: string;
    logo_url?: string;
    created_at?: string;
    updated_at?: string;
}

class CompanyService {
    /**
     * Get company profile
     */
    async getCompanyProfile(): Promise<CompanyProfile | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .eq('owner_id', user.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No company profile found, return default
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching company profile:', error);
            return null;
        }
    }

    /**
     * Update company profile
     */
    async updateCompanyProfile(updates: Partial<CompanyProfile>): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const { error } = await supabase
                .from('companies')
                .upsert({
                    owner_id: user.id,
                    ...updates,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error updating company profile:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload company logo
     */
    async uploadLogo(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No authenticated user');
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-company-${Math.random()}.${fileExt}`;
            const filePath = `company-logos/${fileName}`;

            // Upload file to storage
            const { error: uploadError } = await supabase.storage
                .from('company-logos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('company-logos')
                .getPublicUrl(filePath);

            // Update company profile with new logo URL
            await this.updateCompanyProfile({ logo_url: publicUrl });

            return { success: true, url: publicUrl };
        } catch (error: any) {
            console.error('Error uploading logo:', error);
            return { success: false, error: error.message };
        }
    }
}

export const companyService = new CompanyService();
