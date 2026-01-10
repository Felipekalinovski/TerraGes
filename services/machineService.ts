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
    async getAll(): Promise<Machine[]> {
        const { data, error } = await supabase.from('machines').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async getById(id: string): Promise<Machine | null> {
        const { data, error } = await supabase.from('machines').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },
    async create(machineData: MachineFormData): Promise<Machine> {
        const { data, error } = await supabase.from('machines').insert([machineData]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, machineData: Partial<MachineFormData>): Promise<Machine> {
        const { data, error } = await supabase.from('machines').update(machineData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('machines').delete().eq('id', id);
        if (error) throw error;
    }
};
