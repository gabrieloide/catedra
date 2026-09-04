import { config } from '../config.js';
import { notionService } from '../notion/notionClient.js';
import { remindersService } from '../supabase/remindersService.js';

// Definicion de herramientas (Tools) para Gemini Function Calling
const toolDeclarations = [
  {
    name: 'search_notion_databases',
    description: 'Busca bases de datos en Notion por nombre o palabra clave.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Termino de busqueda o nombre de la tabla/base de datos.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'query_notion_table',
    description: 'Consulta filas de una tabla de Notion con filtro opcional.',
    parameters: {
      type: 'OBJECT',
      properties: {
        database_id: { type: 'STRING', description: 'ID de la base de datos de Notion.' },
        property_name: { type: 'STRING', description: 'Nombre de la columna a filtrar (ej. Alumno, Estado, Materia).' },
        property_type: { type: 'STRING', description: 'Tipo de columna: title, rich_text, select, status, date.' },
        equals_value: { type: 'STRING', description: 'Valor exacto a buscar en la propiedad.' },
        contains_value: { type: 'STRING', description: 'Subcadena a buscar en la propiedad de texto.' },
      },
      required: ['database_id'],
    },
  },
  {
    name: 'shift_notion_class_dates',
    description: 'Desplaza las fechas de clases o actividades en una tabla de Notion (ej. posponer 7 dias para ciertos alumnos o filas coincidentes).',
    parameters: {
      type: 'OBJECT',
      properties: {
        database_id: { type: 'STRING', description: 'ID de la base de datos de Notion.' },
        filter_property: { type: 'STRING', description: 'Columna a filtrar (ej. Alumno o Nombre).' },
        filter_values: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Lista de nombres de alumnos o valores a filtrar (ej. ["Juan", "Maria"]). Si esta vacio, aplica a todos los registros encontrados.',
        },
        date_property_name: { type: 'STRING', description: 'Nombre de la columna de fecha a actualizar (ej. Fecha, Fecha de Clase).' },
        days_to_add: { type: 'INTEGER', description: 'Numero de dias a sumar a la fecha actual de cada fila (ej. 7 para una semana mas, -1 para restar un dia).' },
        new_exact_date: { type: 'STRING', description: 'Fecha exacta en formato YYYY-MM-DD si no se desea sumar dias sino fijar una fecha especifica.' },
      },
      required: ['database_id', 'date_property_name'],
    },
  },
  {
    name: 'create_reminder',
    description: 'Crea un recordatorio en el sistema con alerta proactiva por WhatsApp.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Titulo o descripcion corta del recordatorio.' },
        description: { type: 'STRING', description: 'Detalles adicionales.' },
        due_date_iso: { type: 'STRING', description: 'Fecha y hora limite en formato ISO 8601 (YYYY-MM-DDTHH:mm:ssZ).' },
        notify_before_minutes: { type: 'INTEGER', description: 'Minutos de anticipacion para enviar la alerta por WhatsApp (por defecto 30).' },
      },
      required: ['title', 'due_date_iso'],
    },
  },
  {
    name: 'list_reminders',
    description: 'Lista los proximos recordatorios pendientes en el sistema.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'Cantidad maxima de recordatorios a devolver.' },
      },
    },
  },
  {
    name: 'create_notion_note',
    description: 'Crea una nota rapida en la base de datos de Notas de Notion.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Titulo de la nota.' },
        content: { type: 'STRING', description: 'Cuerpo o contenido de la nota.' },
        tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Etiquetas o categorias.' },
      },
      required: ['title'],
    },
  },
];

// Ejecutor de herramientas locales
async function executeTool(name, args) {
  console.log(`[Agente Tool] Ejecutando: ${name}`, JSON.stringify(args));

  switch (name) {
    case 'search_notion_databases': {
      return await notionService.searchDatabases(args.query);
    }

    case 'query_notion_table': {
      let filter = null;
      if (args.property_name && (args.equals_value || args.contains_value)) {
        const pType = args.property_type || 'title';
        if (pType === 'title' || pType === 'rich_text') {
          filter = {
            property: args.property_name,
            [pType]: args.equals_value ? { equals: args.equals_value } : { contains: args.contains_value },
          };
        } else if (pType === 'select' || pType === 'status') {
          filter = {
            property: args.property_name,
            [pType]: { equals: args.equals_value },
          };
        }
      }
      const rows = await notionService.queryDatabase(args.database_id, filter);
      return rows.map((r) => {
        let titleVal = 'Sin titulo';
        for (const key of Object.keys(r.properties)) {
          if (r.properties[key].type === 'title') {
            titleVal = r.properties[key].title?.[0]?.plain_text || 'Sin titulo';
          }
        }
        return {
          id: r.id,
          title: titleVal,
          properties: r.properties,
        };
      });
    }

    case 'shift_notion_class_dates': {
      const rows = await notionService.queryDatabase(args.database_id);
      const filterValues = (args.filter_values || []).map((v) => v.toLowerCase().trim());
      const updates = [];

      for (const row of rows) {
        let match = false;
        let rowTitle = '';

        for (const key of Object.keys(row.properties)) {
          const prop = row.properties[key];
          if (prop.type === 'title') {
            rowTitle = prop.title?.[0]?.plain_text || '';
          }
        }

        if (filterValues.length === 0) {
          match = true;
        } else {
          const rowTextToCheck = `${rowTitle} ${args.filter_property ? JSON.stringify(row.properties[args.filter_property] || '') : ''}`.toLowerCase();
          match = filterValues.some((target) => rowTextToCheck.includes(target));
        }

        if (!match) continue;

        const currentProp = row.properties[args.date_property_name];
        let baseDate = new Date();

        if (currentProp && currentProp.type === 'date' && currentProp.date?.start) {
          baseDate = new Date(currentProp.date.start);
        }

        let finalDateStr = '';
        if (args.new_exact_date) {
          finalDateStr = args.new_exact_date;
        } else if (args.days_to_add) {
          const shifted = new Date(baseDate.getTime() + args.days_to_add * 86400000);
          finalDateStr = shifted.toISOString().split('T')[0];
        }

        if (finalDateStr) {
          updates.push({
            pageId: row.id,
            title: rowTitle,
            oldDate: currentProp?.date?.start || 'Sin fecha',
            newDate: finalDateStr,
            properties: {
              [args.date_property_name]: {
                date: { start: finalDateStr },
              },
            },
          });
        }
      }

      if (updates.length === 0) {
        return { message: 'No se encontraron filas que coincidan con los filtros especificados.', updatedCount: 0 };
      }

      const updateResult = await notionService.batchUpdatePages(updates);
      return {
        message: `Se actualizaron exitosamente ${updateResult.successful} filas en Notion.`,
        updatedCount: updateResult.successful,
        details: updates.map((u) => ({
          alumno_o_fila: u.title,
          fecha_anterior: u.oldDate,
          fecha_nueva: u.newDate,
        })),
      };
    }

    case 'create_reminder': {
      const created = await remindersService.createReminder({
        title: args.title,
        description: args.description || '',
        dueDate: args.due_date_iso,
        notifyBeforeMinutes: args.notify_before_minutes || 30,
      });
      return { message: 'Recordatorio creado exitosamente', reminder: created };
    }

    case 'list_reminders': {
      const list = await remindersService.listUpcomingReminders(args.limit || 10);
      return { total: list.length, reminders: list };
    }

    case 'create_notion_note': {
      const note = await notionService.createNote(args.title, args.content, args.tags);
      return { message: 'Nota creada en Notion correctamente', noteId: note.id };
    }

    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}

// Orquestador del agente NLP con llamadas de funciones iterativas
export async function processUserMessage(userMessage, conversationHistory = []) {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY no esta configurada en .env');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  const systemInstruction = {
    parts: [
      {
        text: `Eres el Asistente Personal de Gabriel para gestion de Notion, Recordatorios y Clases.
Tus capacidades principales son:
1. Modificar y consultar tablas de Notion (por ejemplo: posponer o mover fechas de clases de alumnos una semana mas, cambiar estados, filtrar filas).
2. Crear y listar recordatorios proactivos con alertas de WhatsApp.
3. Crear notas rapidas en Notion.

Reglas estrictas de comunicacion:
- Cero emojis en tus respuestas.
- Cero guiones o guiones largos en textos de interfaz.
- Responde siempre de forma concisa, educada y clara en espanol.
- Cuando realices cambios en Notion o crees un recordatorio, resume con precision lo que hiciste (ejemplo: 'Se actualizaron las fechas de 2 alumnos: Juan (10/09 a 17/09) y Maria (10/09 a 17/09)').
- Fecha y hora actual de referencia: ${new Date().toISOString()}`,
      },
    ],
  };

  const contents = [
    ...conversationHistory,
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ];

  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    iterations++;

    const payload = {
      system_instruction: systemInstruction,
      contents,
      tools: [{ function_declarations: toolDeclarations }],
      generationConfig: {
        temperature: 0.1,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Verificar si el modelo solicita ejecutar alguna herramienta
    const functionCallPart = parts.find((p) => p.functionCall);

    if (functionCallPart) {
      const call = functionCallPart.functionCall;
      const toolName = call.name;
      const toolArgs = call.args || {};

      contents.push({
        role: 'model',
        parts: [functionCallPart],
      });

      let toolResult;
      try {
        toolResult = await executeTool(toolName, toolArgs);
      } catch (err) {
        toolResult = { error: err.message };
      }

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: { content: toolResult },
            },
          },
        ],
      });

      continue; // Siguiente turno para que Gemini procese la respuesta de la herramienta
    }

    // Si no solicita mas herramientas, devolver el texto final generado
    const textPart = parts.find((p) => p.text);
    return textPart ? textPart.text : 'Operacion completada exitosamente.';
  }

  return 'Se alcanzo el limite de pasos para procesar la solicitud.';
}
