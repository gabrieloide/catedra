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

    const targetDestination = config.whatsapp.targetGroupJid || whatsAppBot.lastGroupJid || config.whatsapp.targetPhoneNumber;
    if (!targetDestination) {
      console.warn('[Scheduler] Ningun destinatario configurado en .env ni grupo detectado. No se pueden enviar alertas.');
      return;
    }

    for (const reminder of dueReminders) {
      const dueDateFormatted = new Date(reminder.due_date).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const message =
        `⏰ *¡Hola Grehyla! Te recuerdo:* ✨\n\n` +
        `📌 *${reminder.title}*` +
        (reminder.description ? `\n💬 ${reminder.description}` : '') +
        `\n\n🕒 *Hora programada:* ${dueDateFormatted} 😊`;

      const sent = await whatsAppBot.sendDirectMessage(targetDestination, message);
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
