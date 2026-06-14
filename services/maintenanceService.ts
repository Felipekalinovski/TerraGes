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
    // Buscar todas as manutenções
    async getAll(): Promise<MaintenanceRecord[]> {
        const { data, error } = await supabase
            .from('maintenance_records')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching maintenance records:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar manutenções por máquina
    async getByMachine(machineId: string): Promise<MaintenanceRecord[]> {
        const { data, error } = await supabase
            .from('maintenance_records')
            .select('*')
            .eq('machine_id', machineId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching maintenance records by machine:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar manutenção por ID
    async getById(id: string): Promise<MaintenanceRecord | null> {
        const { data, error } = await supabase
            .from('maintenance_records')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching maintenance record:', error);
            throw error;
        }

        return data;
    },

    // Criar nova manutenção
    async create(maintenanceData: MaintenanceFormData): Promise<MaintenanceRecord> {
        const { data: machine, error: machineError } = await supabase
            .from('machines')
            .select('id')
            .eq('id', maintenanceData.machine_id)
            .single();

        if (machineError || !machine) {
            throw new Error('Máquina não encontrada. Selecione um equipamento válido.');
        }

        const { data, error } = await supabase
            .from('maintenance_records')
            .insert([maintenanceData])
            .select()
            .single();

        if (error) {
            console.error('Error creating maintenance record:', error);
            if (error.code === '23503') {
                throw new Error('Equipamento não existe ou foi removido.');
            }
            throw error;
        }

        const boost = maintenanceData.type === 'preventive' ? 30 : 50;
        intelligenceService.restoreMachineHealth(data.machine_id, boost, `Manutenção ${data.type}`).catch(err => {
            console.error('Erro ao restaurar saúde da máquina:', err);
        });

        return data;
    },

    // Atualizar manutenção
    async update(id: string, maintenanceData: Partial<MaintenanceFormData>): Promise<MaintenanceRecord> {
        const { data, error } = await supabase
            .from('maintenance_records')
            .update(maintenanceData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating maintenance record:', error);
            if (error.code === 'PGRST116') {
                throw new Error('Registro de manutenção não encontrado. Pode ter sido excluído.');
            }
            throw error;
        }

        return data;
    },

    // Deletar manutenção
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('maintenance_records')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting maintenance record:', error);
            throw error;
        }
    },

    // Buscar estatísticas
    async getStats(): Promise<{
        totalCost: number;
        totalRecords: number;
        byType: { preventive: number; corrective: number; predictive: number };
    }> {
        const { data, error } = await supabase
            .from('maintenance_records')
            .select('type, cost');

        if (error) {
            console.error('Error fetching maintenance stats:', error);
            throw error;
        }

        const stats = {
            totalCost: 0,
            totalRecords: data?.length || 0,
            byType: { preventive: 0, corrective: 0, predictive: 0 }
        };

        data?.forEach(record => {
            stats.totalCost += record.cost || 0;
            if (record.type === 'preventive') stats.byType.preventive++;
            else if (record.type === 'corrective') stats.byType.corrective++;
            else if (record.type === 'predictive') stats.byType.predictive++;
        });

        return stats;
    },

    // Buscar manutenções do mês atual
    async getThisMonth(): Promise<MaintenanceRecord[]> {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data, error } = await supabase
            .from('maintenance_records')
            .select('*')
            .gte('date', firstDay.toISOString().split('T')[0])
            .lte('date', lastDay.toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching this month maintenance records:', error);
            throw error;
        }

        return data || [];
    },
};
