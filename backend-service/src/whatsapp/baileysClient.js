import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { processUserMessage } from '../agent/geminiAgent.js';

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.isReady = false;
  }

  async initialize() {
    const authDir = config.whatsapp.authDir;
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`[WhatsApp] Iniciando cliente Baileys v${version.join('.')}...`);

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60000,
      browser: ['Notion Assistant', 'Chrome', '1.0.0'],
    });

    // Guardar credenciales actualizadas
    this.sock.ev.on('creds.update', saveCreds);

    // Eventos de conexion y codigo QR
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n[WhatsApp] Escanea el siguiente codigo QR con tu telefono (Dispositivos vinculados):\n');
        qrcode.generate(qr, { small: true });
        console.log('\n(Solo es necesario escanearlo una vez. Las credenciales se guardaran localmente).\n');
      }

      if (connection === 'close') {
        this.isReady = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.warn(`[WhatsApp] Conexion cerrada (codigo: ${statusCode}). Reconectando: ${shouldReconnect}`);
        if (shouldReconnect) {
          setTimeout(() => this.initialize(), 5000);
        } else {
          console.error('[WhatsApp] Sesion cerrada manualmente desde el telefono. Elimina auth_session para reiniciar.');
        }
      } else if (connection === 'open') {
        this.isReady = true;
        console.log('[WhatsApp] Sesion vinculada y activa correctamente.');
      }
    });

    // Procesamiento de mensajes entrantes
    this.sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          if (!msg.message) continue;
          if (msg.key.fromMe) continue; // Ignorar mensajes enviados por el propio bot

          const remoteJid = msg.key.remoteJid;
          const senderNumber = remoteJid.split('@')[0];

          // Si hay un numero objetivo configurado, verificar que sea el usuario autorizado
          if (config.whatsapp.targetPhoneNumber && !senderNumber.includes(config.whatsapp.targetPhoneNumber)) {
            console.log(`[WhatsApp] Mensaje ignorado de numero no autorizado: ${senderNumber}`);
            continue;
          }

          const messageText =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            '';

          if (!messageText.trim()) continue;

          console.log(`[WhatsApp Inbound] De ${senderNumber}: "${messageText}"`);

          // Indicador de escritura en WhatsApp
          await this.sock.sendPresenceUpdate('composing', remoteJid);

          try {
            const reply = await processUserMessage(messageText);
            await this.sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
            console.log(`[WhatsApp Outbound] Respuesta enviada con exito.`);
          } catch (agentError) {
            console.error('[WhatsApp Error] Error al procesar mensaje:', agentError);
            const errorMsg = 'Ocurrio un error al procesar la solicitud: ' + agentError.message;
            await this.sock.sendMessage(remoteJid, { text: errorMsg }, { quoted: msg });
          } finally {
            await this.sock.sendPresenceUpdate('available', remoteJid);
          }
        }
      } catch (err) {
        console.error('[WhatsApp Upsert Error]', err);
      }
    });
  }

  // Enviar un mensaje proactivo directo (usado por el planificador de recordatorios)
  async sendDirectMessage(phoneNumber, text) {
    if (!this.sock || !this.isReady) {
      console.warn('[WhatsApp] No se puede enviar mensaje: socket no listo.');
      return false;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const jid = `${cleanNumber}@s.whatsapp.net`;

    try {
      await this.sock.sendMessage(jid, { text });
      console.log(`[WhatsApp Reminder Sent] Mensaje despachado a ${cleanNumber}: "${text.slice(0, 50)}..."`);
      return true;
    } catch (err) {
      console.error(`[WhatsApp Error] Error al despachar mensaje a ${cleanNumber}:`, err.message);
      return false;
    }
  }
}

export const whatsAppBot = new WhatsAppBot();
