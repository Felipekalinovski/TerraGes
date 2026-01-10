import { supabase } from './supabaseClient';

export interface Transaction {
    id: string;
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    status: 'paid' | 'pending';
    created_at: string;
}

export interface TransactionFormData {
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    status: 'paid' | 'pending';
}

export const transactionService = {
    async getAll(): Promise<Transaction[]> {
        const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async create(transactionData: TransactionFormData): Promise<Transaction> {
        const { data, error } = await supabase.from('transactions').insert([transactionData]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, transactionData: Partial<TransactionFormData>): Promise<Transaction> {
        const { data, error } = await supabase.from('transactions').update(transactionData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
    }
};
