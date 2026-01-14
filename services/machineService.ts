import { supabase } from './supabaseClient';

export interface Machine {
    id: string;
    name: string;
    type: string;
    status: 'active' | 'maintenance' | 'inactive';
    hours: number;
    next_maintenance?: string;
    last_maintenance?: string;
    image_url?: string;
    model_year?: number;
    manufacturer?: string;
    health_score?: number;
    health_status?: 'normal' | 'atenção' | 'crítico';
    health_reason?: string;
    health_data_source?: string;
    created_at: string;
}

export interface MachineFormData {
    name: string;
    type: string;
    status: 'active' | 'maintenance' | 'inactive';
    hours: number;
    next_maintenance?: string;
    last_maintenance?: string;
    image_url?: string;
    model_year?: number;
    manufacturer?: string;
}

export const machineService = {
    // Buscar todas as máquinas
    async getAll(): Promise<Machine[]> {
        const { data, error } = await supabase
            .from('machines')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching machines:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar máquina por ID
    async getById(id: string): Promise<Machine | null> {
        const { data, error } = await supabase
            .from('machines')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching machine:', error);
            throw error;
        }

        return data;
    },

    // Buscar máquinas por status
    async getByStatus(status: 'active' | 'maintenance' | 'inactive'): Promise<Machine[]> {
        const { data, error } = await supabase
            .from('machines')
            .select('*')
            .eq('status', status)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching machines by status:', error);
            throw error;
        }

        return data || [];
    },

    // Criar nova máquina
    async create(machineData: MachineFormData): Promise<Machine> {
        const { data, error } = await supabase
            .from('machines')
            .insert([machineData])
            .select()
            .single();

        if (error) {
            console.error('Error creating machine:', error);
            throw error;
        }

        return data;
    },

    // Atualizar máquina
    async update(id: string, machineData: Partial<MachineFormData>): Promise<Machine> {
        const { data, error } = await supabase
            .from('machines')
            .update(machineData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating machine:', error);
            throw error;
        }

        return data;
    },

    // Deletar máquina
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('machines')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting machine:', error);
            throw error;
        }
    },

    // Buscar estatísticas
    async getStats(): Promise<{
        active: number;
        maintenance: number;
        inactive: number;
        total: number;
    }> {
        const { data, error } = await supabase
            .from('machines')
            .select('status');

        if (error) {
            console.error('Error fetching machine stats:', error);
            throw error;
        }

        const stats = {
            active: 0,
            maintenance: 0,
            inactive: 0,
            total: data?.length || 0
        };

        data?.forEach(machine => {
            if (machine.status === 'active') stats.active++;
            else if (machine.status === 'maintenance') stats.maintenance++;
            else if (machine.status === 'inactive') stats.inactive++;
        });

        return stats;
    },
};
