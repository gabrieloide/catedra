import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

class RemindersService {
  constructor() {
    this.client = null;
    if (config.supabase.url && config.supabase.serviceRoleKey) {
      this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    } else {
      console.warn('[Supabase] Credenciales no configuradas. Los recordatorios funcionaran en memoria local.');
      this.localReminders = [];
    }
  }

  // Obtener recordatorios listos para notificar
  async getDueReminders() {
    if (!this.client) {
      const now = new Date();
      return this.localReminders.filter((r) => {
        if (r.status !== 'pending') return false;
        const due = new Date(r.due_date);
        const notifyTime = new Date(due.getTime() - (r.notify_before_minutes || 30) * 60000);
        return now >= notifyTime;
      });
    }

    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('due_date', new Date(Date.now() + 60 * 60 * 1000).toISOString()); // Trae proximos a 1 hora

    if (error) {
      console.error('[Supabase Error] Fallo al consultar recordatorios:', error.message);
      return [];
    }

    const now = new Date();
    return (data || []).filter((r) => {
      const due = new Date(r.due_date);
      const notifyTime = new Date(due.getTime() - (r.notify_before_minutes || 30) * 60000);
      return now >= notifyTime;
    });
  }

  // Marcar recordatorio como notificado
  async markAsNotified(id) {
    if (!this.client) {
      const item = this.localReminders.find((r) => r.id === id);
      if (item) item.status = 'notified';
      return;
    }

    const { error } = await this.client
      .from('reminders')
      .update({ status: 'notified', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[Supabase Error] Fallo al marcar notificado:', error.message);
    }
  }

  // Crear un nuevo recordatorio
  async createReminder({ title, description = '', dueDate, notifyBeforeMinutes = 30 }) {
    const payload = {
      title,
      description,
      due_date: new Date(dueDate).toISOString(),
      notify_before_minutes: notifyBeforeMinutes,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!this.client) {
      const localItem = { id: 'local_' + Date.now(), ...payload };
      this.localReminders.push(localItem);
      return localItem;
    }

    const { data, error } = await this.client
      .from('reminders')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[Supabase Error] Fallo al crear recordatorio:', error.message);
      throw error;
    }

    return data;
  }

  // Listar recordatorios proximos
  async listUpcomingReminders(limit = 10) {
    if (!this.client) {
      return this.localReminders.slice(0, limit);
    }

    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Supabase Error] Fallo al listar recordatorios:', error.message);
      return [];
    }

    return data || [];
  }
}

export const remindersService = new RemindersService();
