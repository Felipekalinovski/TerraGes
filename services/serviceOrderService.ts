
import { supabase } from './supabaseClient';
import { Employee } from './employeeService';
import { Machine } from './machineService';

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

        return data || [];
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

        return data;
    },

    // Criar nova ordem
    async create(orderData: ServiceOrderFormData): Promise<ServiceOrder> {
        const { data, error } = await supabase
            .from('service_orders')
            .insert([orderData])
            .select()
            .single();

        if (error) {
            console.error('Error creating service order:', error);
            throw error;
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

        return data;
    },

    // Upload de comprovante/recibo
    async uploadReceipt(file: File): Promise<string | null> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `receipt-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('service-receipts')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('service-receipts')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Error uploading receipt:', error);
            return null;
        }
    }
};
