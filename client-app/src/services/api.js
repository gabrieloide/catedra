// Cliente API para comunicarse con el backend local o en red
const DEFAULT_API_BASE = 'http://localhost:3000';

export function getApiBaseUrl() {
  return localStorage.getItem('API_BASE_URL') || DEFAULT_API_BASE;
}

export function setApiBaseUrl(url) {
  localStorage.setItem('API_BASE_URL', url);
}

export async function fetchHealth() {
  const res = await fetch(`${getApiBaseUrl()}/health`);
  if (!res.ok) throw new Error('Error al conectar con el backend');
  return await res.json();
}

export async function fetchNotes() {
  const res = await fetch(`${getApiBaseUrl()}/api/notion/notes`);
  if (!res.ok) throw new Error('Error al obtener notas desde Notion');
  return await res.json();
}

export async function createNote(noteData) {
  const res = await fetch(`${getApiBaseUrl()}/api/notion/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });
  if (!res.ok) throw new Error('Error al crear nota en Notion');
  return await res.json();
}

export async function fetchReminders() {
  const res = await fetch(`${getApiBaseUrl()}/api/reminders`);
  if (!res.ok) throw new Error('Error al obtener recordatorios');
  return await res.json();
}

export async function createReminder(reminderData) {
  const res = await fetch(`${getApiBaseUrl()}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reminderData),
  });
  if (!res.ok) throw new Error('Error al crear recordatorio');
  return await res.json();
}

export async function sendAssistantMessage(message) {
  const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Error al consultar al asistente');
  return await res.json();
}
