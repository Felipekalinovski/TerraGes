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
    // Buscar todas as transações
    async getAll(): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar transações por tipo
    async getByType(type: 'income' | 'expense'): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('type', type)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching transactions by type:', error);
            throw error;
        }

        return data || [];
    },

    // Buscar transação por ID
    async getById(id: string): Promise<Transaction | null> {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching transaction:', error);
            throw error;
        }

        return data;
    },

    // Criar nova transação
    async create(transactionData: TransactionFormData): Promise<Transaction> {
        const { data, error } = await supabase
            .from('transactions')
            .insert([transactionData])
            .select()
            .single();

        if (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }

        return data;
    },

    // Atualizar transação
    async update(id: string, transactionData: Partial<TransactionFormData>): Promise<Transaction> {
        const { data, error } = await supabase
            .from('transactions')
            .update(transactionData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }

        return data;
    },

    // Deletar transação
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        }
    },

    // Buscar estatísticas
    async getStats(): Promise<{
        totalIncome: number;
        totalExpense: number;
        balance: number;
        byCategory: Record<string, number>;
    }> {
        const { data, error } = await supabase
            .from('transactions')
            .select('type, amount, category');

        if (error) {
            console.error('Error fetching transaction stats:', error);
            throw error;
        }

        const stats = {
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            byCategory: {} as Record<string, number>
        };

        data?.forEach(transaction => {
            if (transaction.type === 'income') {
                stats.totalIncome += transaction.amount || 0;
            } else {
                stats.totalExpense += transaction.amount || 0;
            }

            // Group by category
            if (transaction.category) {
                stats.byCategory[transaction.category] = (stats.byCategory[transaction.category] || 0) + (transaction.amount || 0);
            }
        });

        stats.balance = stats.totalIncome - stats.totalExpense;

        return stats;
    },

    // Buscar transações do mês atual
    async getThisMonth(): Promise<Transaction[]> {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .gte('date', firstDay.toISOString().split('T')[0])
            .lte('date', lastDay.toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching this month transactions:', error);
            throw error;
        }

        return data || [];
    },
};
