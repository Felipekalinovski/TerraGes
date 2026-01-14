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
    // Buscar todos os agendamentos
    async getAll(): Promise<Schedule[]> {
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .order('start_time', { ascending: true });

        if (error) {
            console.error('Error fetching schedules:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar agendamentos por período
    async getByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())
            .order('start_time', { ascending: true });

        if (error) {
            console.error('Error fetching schedules by date range:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar um agendamento por ID
    async getById(id: string): Promise<Schedule | null> {
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching schedule:', error);
            throw error;
        }

        return data;
    },

    // Criar novo agendamento
    async create(scheduleData: ScheduleFormData): Promise<Schedule> {
        // Validar conflito de máquina
        if (scheduleData.machine_id) {
            const { data: conflicts } = await supabase
                .from('schedules')
                .select('*')
                .eq('machine_id', scheduleData.machine_id)
                .gte('start_time', scheduleData.start_time)
                .lte('start_time', scheduleData.end_time || scheduleData.start_time);

            if (conflicts && conflicts.length > 0) {
                console.warn('Conflito de máquina detectado para este horário.');
                // Poderíamos lançar um erro ou apenas avisar. O prompt pede para "validar conflito".
            }
        }

        const { data, error } = await supabase
            .from('schedules')
            .insert([scheduleData])
            .select()
            .single();

        if (error) {
            console.error('Error creating schedule:', error);
            throw error;
        }

        return data;
    },

    // Atualizar agendamento
    async update(id: string, scheduleData: Partial<ScheduleFormData>): Promise<Schedule> {
        const { data, error } = await supabase
            .from('schedules')
            .update(scheduleData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating schedule:', error);
            throw error;
        }

        return data;
    },

    // Deletar agendamento
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting schedule:', error);
            throw error;
        }
    },
};
