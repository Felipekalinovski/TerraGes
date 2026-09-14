
import { supabase } from './supabaseClient';
import { uploadPrivateFile, resolvePrivateFile } from './storageService';
import { Employee } from './employeeService';
import { Machine } from './machineService';
import { intelligenceService } from './intelligenceService';

export interface ServiceOrder {
    id: string;
    date: string;
    client: string;
    machine_id: string;
    operator_id: string;
    start_hour: number;
    end_hour: number;
    total_hours: number;
    hourly_rate: number;
    total_value: number;
    payment_method: 'Pix' | 'Cartão' | 'Boleto' | 'Faturado' | 'Dinheiro';
    status: 'pending' | 'completed' | 'cancelled';
    location?: string;
    description?: string;
    receipt_url?: string;
    machine?: Partial<Machine>;
    operator?: Partial<Employee>;
}

export type ServiceOrderFormData = Omit<ServiceOrder, 'id' | 'total_hours' | 'total_value' | 'machine' | 'operator'>;

export const serviceOrderService = {
    // Buscar todas as ordens
    async getAll(): Promise<ServiceOrder[]> {
        const { data, error } = await supabase
            .from('service_orders')
            .select(`
                *,
                machine:machines(name, image_url),
                operator:employees(name, image_url)
            `)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching service orders:', error);
            throw error;
        }

        return Promise.all((data || []).map(async order=>({...order,receipt_url:await resolvePrivateFile(order.receipt_url)})));
    },

    // Buscar por ID
    async getById(id: string): Promise<ServiceOrder | null> {
        const { data, error } = await supabase
            .from('service_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching service order:', error);
            throw error;
        }

        return data ? {...data, receipt_url:await resolvePrivateFile(data.receipt_url)} : null;
    },

    // Criar nova ordem
    async create(orderData: ServiceOrderFormData): Promise<ServiceOrder> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('service_orders')
            .insert([{ ...orderData, user_id: user?.id }])
            .select()
            .single();

        if (error) {
            console.error('Error creating service order:', error);
            throw error;
        }

        if (data.status === 'completed') {
            intelligenceService.analyzeServiceOrder(data.id).catch(err => {
                console.error('Erro ao analisar O.S. com IA:', err);
            });
        }

        return data;
    },

    // Atualizar ordem
    async update(id: string, updates: Partial<ServiceOrderFormData>): Promise<ServiceOrder> {
        const { data, error } = await supabase
            .from('service_orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating service order:', error);
            throw error;
        }

        if (data.status === 'completed') {
            intelligenceService.analyzeServiceOrder(data.id).catch(err => {
                console.error('Erro ao analisar O.S. com IA:', err);
            });
        }

        return data;
    },

    // Upload de comprovante/recibo
    async uploadReceipt(file: File): Promise<string | null> {
        try {
            return await uploadPrivateFile('service-receipts',file);
        } catch (error) {
            console.error('Error uploading receipt:', error);
            return null;
        }
    }
};
