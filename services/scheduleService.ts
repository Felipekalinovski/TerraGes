import { supabase } from './supabaseClient';

export interface Schedule {
    id: string;
    title: string;
    type: 'excavation' | 'transport' | 'maintenance' | 'other';
    start_time: string;
    end_time?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    machine_id?: string;
    operator_id?: string;
    notes?: string;
    created_at: string;
}

export interface ScheduleFormData {
    title: string;
    type: 'excavation' | 'transport' | 'maintenance' | 'other';
    start_time: string;
    end_time?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    machine_id?: string;
    operator_id?: string;
    notes?: string;
}

export const scheduleService = {
    async getAll(): Promise<Schedule[]> {
        const { data, error } = await supabase.from('schedules').select('*').order('start_time', { ascending: true });
        if (error) throw error;
        return data || [];
    },
    async create(scheduleData: ScheduleFormData): Promise<Schedule> {
        const { data, error } = await supabase.from('schedules').insert([scheduleData]).select().single();
        if (error) throw error;
        return data;
    },
    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) throw error;
    },
    async getById(id: string): Promise<Schedule | null> {
        const { data, error } = await supabase.from('schedules').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },
    async update(id: string, scheduleData: Partial<ScheduleFormData>): Promise<Schedule> {
        const { data, error } = await supabase.from('schedules').update(scheduleData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }
};
