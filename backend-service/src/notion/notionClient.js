import { Client } from '@notionhq/client';
import { config } from '../config.js';

class NotionService {
  constructor() {
    this.client = new Client({ auth: config.notion.apiKey });
    this.lastRequestTime = 0;
    this.minIntervalMs = 350; // Respetar limite promedio de 3 req/s
  }

  // Control estricto de concurrencia y rate limit local
  async throttle() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLast;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  // Wrapper con reintento y backoff para codigos 429 y 529
  async executeWithRetry(fn, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await this.throttle();
        return await fn();
      } catch (error) {
        attempt++;
        const status = error.status || error.statusCode;

        if ((status === 429 || status === 529) && attempt < maxRetries) {
          const retryAfter = error.headers?.get?.('retry-after') || 1;
          const waitMs = Math.max(parseInt(retryAfter, 10) * 1000, 1000 * Math.pow(2, attempt));
          console.warn(`[Notion Rate Limit] Codigo ${status}. Esperando ${waitMs}ms antes de reintentar...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        console.error(`[Notion Error] Error en intento ${attempt}:`, error.message);
        throw error;
      }
    }
  }

  // Buscar bases de datos accesibles por nombre
  async searchDatabases(query = '') {
    return this.executeWithRetry(async () => {
      const response = await this.client.search({
        query,
        filter: { value: 'database', property: 'object' },
      });
      return response.results.map((db) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Sin titulo',
        properties: Object.keys(db.properties).map((key) => ({
          name: key,
          type: db.properties[key].type,
        })),
      }));
    });
  }

  // Obtener esquema detallado de una base de datos
  async getDatabase(databaseId) {
    return this.executeWithRetry(async () => {
      return await this.client.databases.retrieve({ database_id: databaseId });
    });
  }

  // Consultar filas con filtro dinamico y paginacion
  async queryDatabase(databaseId, filter = null, sorts = []) {
    return this.executeWithRetry(async () => {
      const payload = { database_id: databaseId, page_size: 100 };
      if (filter && Object.keys(filter).length > 0) {
        payload.filter = filter;
      }
      if (sorts && sorts.length > 0) {
        payload.sorts = sorts;
      }

      const results = [];
      let cursor = undefined;

      do {
        if (cursor) payload.start_cursor = cursor;
        const res = await this.client.databases.query(payload);
        results.push(...res.results);
        cursor = res.has_more ? res.next_cursor : undefined;
      } while (cursor && results.length < 500);

      return results;
    });
  }

  // Actualizar una pagina/fila individual
  async updatePage(pageId, properties) {
    return this.executeWithRetry(async () => {
      return await this.client.pages.update({
        page_id: pageId,
        properties,
      });
    });
  }

  // Actualizar multiples filas en lote con semaforo secuencial
  async batchUpdatePages(updates) {
    const results = [];
    const errors = [];

    for (const item of updates) {
      try {
        const updated = await this.updatePage(item.pageId, item.properties);
        results.push({ pageId: item.pageId, success: true, title: item.title || '' });
      } catch (err) {
        errors.push({ pageId: item.pageId, error: err.message });
      }
    }

    return { total: updates.length, successful: results.length, errors, results };
  }

  // Crear una nueva fila o nota
  async createPage(databaseId, properties, children = []) {
    return this.executeWithRetry(async () => {
      return await this.client.pages.create({
        parent: { database_id: databaseId },
        properties,
        children: children.length > 0 ? children : undefined,
      });
    });
  }

  // Crear una nota rapida en la base de datos de notas
  async createNote(title, content, tags = []) {
    const dbId = config.notion.notesDatabaseId;
    if (!dbId) throw new Error('NOTION_NOTES_DATABASE_ID no esta configurado en .env');

    const properties = {
      Nombre: {
        title: [{ text: { content: title } }],
      },
    };

    if (tags && tags.length > 0) {
      properties.Etiquetas = {
        multi_select: tags.map((t) => ({ name: t })),
      };
    }

    const children = [];
    if (content) {
      const chunks = content.match(/[\s\S]{1,1900}/g) || [content];
      for (const chunk of chunks) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }],
          },
        });
      }
    }

    return await this.createPage(dbId, properties, children);
  }
}

export const notionService = new NotionService();
