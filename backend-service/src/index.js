import express from 'express';
import fs from 'fs';
import { config } from './config.js';
import { whatsAppBot } from './whatsapp/baileysClient.js';
import { reminderWorker } from './scheduler/reminderWorker.js';
import { remindersService } from './supabase/remindersService.js';
import { notionService } from './notion/notionClient.js';
import { processUserMessage } from './agent/geminiAgent.js';

const app = express();
app.use(express.json());

// Habilitar CORS para permitir comunicacion desde la app cliente
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Endpoint de estado del sistema
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsappConnected: whatsAppBot.isReady,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint para disparar un mensaje de prueba al WhatsApp del usuario
app.all('/api/send-test', async (req, res) => {
  try {
    const text =
      req.query?.text ||
      req.body?.text ||
      '¡Hola! Soy tu Asistente Catedra conectado a Notion y Recordatorios.';
    const destination = req.query?.recipient || req.body?.recipient || config.whatsapp.targetGroupJid || config.whatsapp.targetPhoneNumber;
    const success = await whatsAppBot.sendDirectMessage(destination, text);
    res.json({ success, recipient: destination });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para consultar informacion del grupo configurado
app.get('/api/group-info', async (req, res) => {
  try {
    const groupId = config.whatsapp.targetGroupJid || '120363414956595581@g.us';
    const meta = await whatsAppBot.sock?.groupMetadata(groupId);
    res.json({ subject: meta?.subject, id: meta?.id, participants: meta?.participants?.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint visual para escanear codigo QR de WhatsApp facilmente desde el navegador
app.get('/qr', (req, res) => {
  if (whatsAppBot.isReady) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>WhatsApp Conectado - Catedra</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #064e3b; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
          .card { background: #047857; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); max-width: 400px; }
          h1 { margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Dispositivo Vinculado</h1>
          <p>WhatsApp ya esta conectado correctamente a Catedra.</p>
          <div style="margin-top: 25px;">
            <a href="/reset" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;" onclick="return confirm('¿Deseas desvincular este WhatsApp y conectar otro número?')">Desvincular y Cambiar Número</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  const qr = whatsAppBot.latestQr;
  if (!qr) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Iniciando WhatsApp...</title>
        <meta http-equiv="refresh" content="2">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <h2>Generando codigo QR...</h2>
          <p>Por favor espera unos segundos...</p>
        </div>
      </body>
      </html>
    `);
  }

  const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=' + encodeURIComponent(qr);

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <title>Escanear QR de WhatsApp - Catedra</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="refresh" content="10">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; max-width: 440px; width: 100%; border: 1px solid #334155; }
        h1 { margin-top: 0; font-size: 1.5rem; color: #38bdf8; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 10px 0; }
        .qr-wrapper { background: white; padding: 16px; border-radius: 12px; display: inline-block; margin: 20px 0; }
        img { display: block; width: 280px; height: 280px; }
        .steps { text-align: left; background: #0f172a; padding: 14px 20px; border-radius: 8px; font-size: 0.85rem; color: #cbd5e1; margin-top: 15px; }
        .steps ol { margin: 0; padding-left: 20px; }
        .steps li { margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Vincular WhatsApp</h1>
        <p>Abre WhatsApp en tu teléfono y escanea este código:</p>
        <div class="qr-wrapper">
          <img src="${qrImageUrl}" alt="Codigo QR de WhatsApp" />
        </div>
        <div class="steps">
          <ol>
            <li>Abre <b>WhatsApp</b> en tu telefono</li>
            <li>Toca los tres puntos o <b>Ajustes</b></li>
            <li>Selecciona <b>Dispositivos vinculados</b></li>
            <li>Toca <b>Vincular un dispositivo</b> y apunta a la pantalla</li>
          </ol>
        </div>
        <p style="font-size: 0.8rem; color: #64748b; margin-top: 15px;">Se actualiza automaticamente si expira. Solo se escanea una vez.</p>
        <div style="margin-top: 15px;">
          <a href="/reset" style="color: #f87171; text-decoration: none; font-size: 0.85rem;" onclick="return confirm('¿Deseas desvincular y generar un nuevo QR?')">🔄 Desvincular / Cambiar de número</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Endpoint para reiniciar sesion de WhatsApp y generar un nuevo codigo QR
app.get('/reset', async (req, res) => {
  try {
    console.log('[WhatsApp] Reiniciando sesion para nuevo numero via /reset...');
    if (whatsAppBot.sock) {
      try {
        await whatsAppBot.sock.logout();
      } catch (_) {}
    }
    const authDir = config.whatsapp.authDir;
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    whatsAppBot.isReady = false;
    whatsAppBot.latestQr = null;
    await whatsAppBot.initialize();
    res.redirect('/qr');
  } catch (err) {
    res.status(500).send('Error al reiniciar sesion de WhatsApp: ' + err.message);
  }
});

// Endpoint para consultar recordatorios
app.get('/api/reminders', async (req, res) => {
  try {
    const list = await remindersService.listUpcomingReminders(50);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para crear recordatorio desde la app cliente
app.post('/api/reminders', async (req, res) => {
  try {
    const { title, description, dueDate, notifyBeforeMinutes } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: 'title y dueDate son obligatorios.' });
    }
    const created = await remindersService.createReminder({
      title,
      description,
      dueDate,
      notifyBeforeMinutes,
    });
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para listar notas desde Notion
app.get('/api/notion/notes', async (req, res) => {
  try {
    const dbId = config.notion.notesDatabaseId;
    if (!dbId) {
      return res.status(400).json({ error: 'NOTION_NOTES_DATABASE_ID no esta configurada.' });
    }
    const pages = await notionService.queryDatabase(dbId);
    const notes = pages.map((p) => {
      let title = 'Sin titulo';
      let tags = [];
      for (const key of Object.keys(p.properties)) {
        const prop = p.properties[key];
        if (prop.type === 'title') {
          title = prop.title?.[0]?.plain_text || 'Sin titulo';
        }
        if (prop.type === 'multi_select') {
          tags = prop.multi_select.map((s) => s.name);
        }
      }
      return {
        id: p.id,
        title,
        tags,
        createdAt: p.created_time,
        lastEditedTime: p.last_edited_time,
        url: p.url,
      };
    });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para crear nota en Notion desde la app cliente
app.post('/api/notion/notes', async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title es obligatorio.' });
    }
    const created = await notionService.createNote(title, content, tags);
    res.json({ success: true, id: created.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de prueba conversacional directa (agente NLP)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message es obligatorio.' });
    }
    const reply = await processUserMessage(message);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servicios
async function main() {
  console.log('Iniciando Ecosistema Asistente Notion y Recordatorios...');

  // 1. Iniciar servidor HTTP
  app.listen(config.server.port, () => {
    console.log(`[API Server] Servidor escuchando en http://localhost:${config.server.port}`);
  });

  // 2. Iniciar programador de recordatorios
  reminderWorker.start();

  // 3. Iniciar cliente WhatsApp Baileys
  await whatsAppBot.initialize();
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
});
