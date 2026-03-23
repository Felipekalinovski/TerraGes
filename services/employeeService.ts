
import { supabase } from './supabaseClient';

export interface Employee {
    id: string;
    name: string;
    role: string;
    status: 'active' | 'vacation' | 'leave' | 'inactive';
    contact: string;
    email?: string;
    cpf?: string;
    birth_date?: string;
    address?: string;
    admission_date?: string;
    certifications?: string[];
    image_url?: string;
    company_id?: string;
    created_at?: string;
}

export const employeeService = {
    // Buscar todos os funcionários
    async getAll(companyId?: string): Promise<Employee[]> {
        let query = supabase
            .from('employees')
            .select('*');
        
        if (companyId) {
            query = query.eq('company_id', companyId);
        }

        const { data, error } = await query.order('name', { ascending: true });

        if (error) {
            console.error('Error fetching employees:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar por ID
    async getById(id: string): Promise<Employee | null> {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching employee:', error);
            throw error;
        }

        return data;
    },

    // Criar funcionário
    async create(employeeData: Omit<Employee, 'id' | 'created_at'>): Promise<Employee> {
        const { data, error } = await supabase
            .from('employees')
            .insert([employeeData])
            .select()
            .single();

        if (error) {
            console.error('Error creating employee:', error);
            throw error;
        }

        return data;
    },

    // Atualizar funcionário
    async update(id: string, updates: Partial<Employee>): Promise<Employee> {
        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating employee:', error);
            throw error;
        }

        return data;
    },

    // Atualizar foto do funcionário
    async uploadAvatar(file: File): Promise<string | null> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `employee-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading avatar:', error);
            return null;
        }
    }
};
