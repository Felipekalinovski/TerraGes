import { supabase } from './supabaseClient';

export type ManagerNotification = {
  id: string;
  company_id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  message: string;
  field_entry_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

export const managerNotificationService = {
  async getRecent(limit = 20): Promise<ManagerNotification[]> {
    const { data, error } = await supabase
      .from('manager_notifications')
      .select('id,company_id,recipient_user_id,type,title,message,field_entry_id,read_at,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as ManagerNotification[];
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  subscribe(onChange: () => void) {
    const channel = supabase
      .channel('manager-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'manager_notifications' },
        () => onChange(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
