import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { processUserMessage, transcribeAudio } from '../agent/geminiAgent.js';

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.isReady = false;
    this.latestQr = null;
    this.botSentMessageIds = new Set();
    this.messageStore = new Map();
    this.lastGroupJid = null;
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
      syncFullHistory: false,
      getMessage: async (key) => {
        return this.messageStore.get(key.id) || undefined;
      },
    });

    // Guardar credenciales actualizadas
    this.sock.ev.on('creds.update', saveCreds);

    // Eventos de conexion y codigo QR
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.latestQr = qr;
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
        this.latestQr = null;
        console.log('[WhatsApp] Sesion vinculada y activa correctamente.');
      }
    });

    // Procesamiento de mensajes entrantes
    this.sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type !== 'notify' && m.type !== 'append') return;

        for (const msg of m.messages) {
          if (!msg.message) continue;

          // Guardar mensaje en memoria para permitir reintentos criptograficos (soluciona "Esperando mensaje...")
          if (msg.key?.id && msg.message) {
            this.messageStore.set(msg.key.id, msg.message);
            if (this.messageStore.size > 1000) {
              const firstKey = this.messageStore.keys().next().value;
              this.messageStore.delete(firstKey);
            }
          }

          // Si el mensaje fue generado por el propio bot, ignorar para evitar bucles
          if (msg.key.id && this.botSentMessageIds.has(msg.key.id)) {
            this.botSentMessageIds.delete(msg.key.id);
            continue;
          }

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid.includes('broadcast') || remoteJid === 'status@broadcast') {
            continue;
          }

          const senderNumber = remoteJid.split('@')[0].split(':')[0];
          const myJidPrefix = this.sock.user?.id ? this.sock.user.id.split('@')[0].split(':')[0] : '';
          const myLidPrefix = this.sock.user?.lid ? this.sock.user.lid.split('@')[0].split(':')[0] : '';
          const targetNumber = config.whatsapp.targetPhoneNumber ? config.whatsapp.targetPhoneNumber.replace(/[^0-9]/g, '') : '';

          // Desenvolver mensaje en caso de mensajes efimeros o viewOnce
          const content =
            msg.message?.ephemeralMessage?.message ||
            msg.message?.viewOnceMessage?.message ||
            msg.message;

          const isGroup = remoteJid.endsWith('@g.us');

          if (isGroup) {
            // Si hay un grupo asignado para el asistente, ignorar completamente cualquier otro grupo (ej. familia, trabajo)
            const allowedGroup = config.whatsapp.targetGroupJid;
            if (allowedGroup && remoteJid !== allowedGroup) {
              continue;
            }
            console.log(`[WhatsApp Group Message] Mensaje recibido en grupo autorizado ${remoteJid}`);
            this.lastGroupJid = remoteJid;
          } else if (msg.key.fromMe) {
            // El usuario envio un mensaje desde su telefono. Solo atender si es en el chat consigo mismo
            const isSelfChat =
              (targetNumber && remoteJid.includes(targetNumber)) ||
              (myJidPrefix && remoteJid.includes(myJidPrefix)) ||
              (myLidPrefix && remoteJid.includes(myLidPrefix)) ||
              remoteJid.endsWith('@lid');

            if (!isSelfChat) {
              // El usuario esta chateando con otra persona, ignorar para no interferir
              continue;
            }
          } else {
            // Mensaje entrante 1 a 1 hacia el bot
            const isAuthorizedUser =
              (targetNumber && (senderNumber.includes(targetNumber) || remoteJid.includes(targetNumber))) ||
              (myJidPrefix && (senderNumber.includes(myJidPrefix) || remoteJid.includes(myJidPrefix))) ||
              (myLidPrefix && (senderNumber.includes(myLidPrefix) || remoteJid.includes(myLidPrefix))) ||
              remoteJid.endsWith('@lid');

            if (!isAuthorizedUser) {
              console.log(`[WhatsApp] Mensaje ignorado de numero no autorizado: ${senderNumber}`);
              continue;
            }
          }

          let messageText =
            content?.conversation ||
            content?.extendedTextMessage?.text ||
            content?.imageMessage?.caption ||
            '';

          const isAudio = Boolean(content?.audioMessage);
          if (isAudio) {
            console.log(`[WhatsApp Audio Inbound] Nota de voz recibida de ${senderNumber}. Descargando y transcribiendo con Gemini...`);
            await this.sock.sendPresenceUpdate('recording', remoteJid);
            try {
              const audioBuffer = await downloadMediaMessage(msg, 'buffer', {});
              const mimeType = content.audioMessage.mimetype?.split(';')[0] || 'audio/ogg';
              messageText = await transcribeAudio(audioBuffer, mimeType);
              console.log(`[WhatsApp Audio Transcrito] "${messageText}"`);
            } catch (audioErr) {
              console.error('[WhatsApp Audio Error] Fallo al procesar nota de voz:', audioErr);
              const errMsg = 'No se pudo procesar la nota de voz: ' + audioErr.message;
              const sent = await this.sock.sendMessage(remoteJid, { text: errMsg }, { quoted: msg });
              if (sent?.key?.id) {
                this.botSentMessageIds.add(sent.key.id);
              }
              continue;
            }
          }

          console.log(`[WhatsApp Inbound Event] tipo:${m.type} de:${senderNumber} texto:"${messageText}"`);

          if (!messageText.trim()) continue;

          console.log(`[WhatsApp Inbound] De ${senderNumber}: "${messageText}"`);

          // Indicador de escritura en WhatsApp
          await this.sock.sendPresenceUpdate('composing', remoteJid);

          const targetJid = isGroup
            ? remoteJid
            : targetNumber
              ? `${targetNumber}@s.whatsapp.net`
              : remoteJid;

          const sendOptions = { quoted: msg };

          try {
            const reply = await processUserMessage(messageText);
            const fullReply = isAudio ? `🎤 *Nota de voz:* "${messageText}"\n\n${reply}` : reply;
            const sent = await this.sock.sendMessage(targetJid, { text: fullReply }, sendOptions);
            if (sent?.key?.id) {
              this.botSentMessageIds.add(sent.key.id);
              if (sent.message) this.messageStore.set(sent.key.id, sent.message);
            }
            console.log(`[WhatsApp Outbound] Respuesta enviada con exito a ${targetJid}.`);
          } catch (agentError) {
            console.error('[WhatsApp Error] Error al procesar mensaje:', agentError);
            const errorMsg = 'Ocurrio un error al procesar la solicitud: ' + agentError.message;
            const sent = await this.sock.sendMessage(targetJid, { text: errorMsg }, sendOptions);
            if (sent?.key?.id) {
              this.botSentMessageIds.add(sent.key.id);
              if (sent.message) this.messageStore.set(sent.key.id, sent.message);
            }
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
  async sendDirectMessage(destination, text) {
    if (!this.sock || !this.isReady) {
      console.warn('[WhatsApp] No se puede enviar mensaje: socket no listo.');
      return false;
    }

    const jid = destination.includes('@')
      ? destination
      : `${destination.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    try {
      const sent = await this.sock.sendMessage(jid, { text });
      if (sent?.key?.id) {
        this.botSentMessageIds.add(sent.key.id);
        if (sent.message) this.messageStore.set(sent.key.id, sent.message);
      }
      console.log(`[WhatsApp Direct Sent] Mensaje despachado a ${jid}: "${text.slice(0, 50)}..."`);
      return true;
    } catch (err) {
      console.error(`[WhatsApp Error] Error al despachar mensaje a ${jid}:`, err.message);
      return false;
    }
  }
}

export const whatsAppBot = new WhatsAppBot();
