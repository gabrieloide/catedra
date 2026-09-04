import cron from 'node-cron';
import { config } from '../config.js';
import { remindersService } from '../supabase/remindersService.js';
import { whatsAppBot } from '../whatsapp/baileysClient.js';

class ReminderWorker {
  constructor() {
    this.cronTask = null;
    this.isProcessing = false;
  }

  start() {
    console.log(`[Scheduler] Iniciando programador de recordatorios (${config.scheduler.cronExpression})...`);

    this.cronTask = cron.schedule(config.scheduler.cronExpression, async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        await this.checkAndDispatchReminders();
      } catch (err) {
        console.error('[Scheduler Error] Error durante la ejecucion del ciclo:', err.message);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  async checkAndDispatchReminders() {
    const dueReminders = await remindersService.getDueReminders();
    if (!dueReminders || dueReminders.length === 0) return;

    console.log(`[Scheduler] ${dueReminders.length} recordatorio(s) listo(s) para enviar.`);

    const targetPhone = config.whatsapp.targetPhoneNumber;
    if (!targetPhone) {
      console.warn('[Scheduler] TARGET_PHONE_NUMBER no configurado en .env. No se pueden enviar alertas.');
      return;
    }

    for (const reminder of dueReminders) {
      const dueDateFormatted = new Date(reminder.due_date).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const message =
        `ALERTA DE RECORDATORIO\n\n` +
        `Titulo: ${reminder.title}\n` +
        (reminder.description ? `Detalles: ${reminder.description}\n` : '') +
        `Fecha Limite: ${dueDateFormatted}\n` +
        `Anticipacion: ${reminder.notify_before_minutes || 30} minutos`;

      const sent = await whatsAppBot.sendDirectMessage(targetPhone, message);
      if (sent) {
        await remindersService.markAsNotified(reminder.id);
      }
    }
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('[Scheduler] Programador detenido.');
    }
  }
}

export const reminderWorker = new ReminderWorker();
