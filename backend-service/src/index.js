import express from 'express';
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
