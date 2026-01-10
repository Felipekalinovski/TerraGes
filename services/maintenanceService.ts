import { supabase } from './supabaseClient';
import { intelligenceService } from './intelligenceService';

export interface MaintenanceRecord {
    id: string;
    machine_id: string;
    date: string;
    type: 'preventive' | 'corrective' | 'predictive';
    description: string;
    cost: number;
    technician: string;
    hour_meter: number;
    created_at: string;
}

export interface MaintenanceFormData {
    machine_id: string;
    date: string;
    type: 'preventive' | 'corrective' | 'predictive';
    description: string;
    cost: number;
    technician: string;
    hour_meter: number;
}

export const maintenanceService = {
    async getAll(): Promise<MaintenanceRecord[]> {
        const { data, error } = await supabase.from('maintenance_records').select('*').order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async create(maintenanceData: MaintenanceFormData): Promise<MaintenanceRecord> {
        const { data, error } = await supabase.from('maintenance_records').insert([maintenanceData]).select().single();
        if (error) throw error;
        const boost = maintenanceData.type === 'preventive' ? 30 : 50;
        intelligenceService.restoreMachineHealth(data.machine_id, boost, `Manutenção ${data.type}`).catch(console.error);
        return data;
    },
    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('maintenance_records').delete().eq('id', id);
        if (error) throw error;
    },
    async getThisMonth(): Promise<MaintenanceRecord[]> {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const { data, error } = await supabase.from('maintenance_records').select('*').gte('date', firstDay.toISOString().split('T')[0]).lte('date', lastDay.toISOString().split('T')[0]).order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async getById(id: string): Promise<MaintenanceRecord | null> {
        const { data, error } = await supabase.from('maintenance_records').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },
    async update(id: string, maintenanceData: Partial<MaintenanceFormData>): Promise<MaintenanceRecord> {
        const { data, error } = await supabase.from('maintenance_records').update(maintenanceData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }
};
