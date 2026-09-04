import React, { useState, useEffect } from 'react';
import { fetchReminders, createReminder } from '../services/api';

export default function RemindersTab() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notifyBefore, setNotifyBefore] = useState(30);
  const [error, setError] = useState(null);

  const loadReminders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReminders();
      setReminders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    try {
      await createReminder({
        title,
        description,
        dueDate: new Date(dueDate).toISOString(),
        notifyBeforeMinutes: parseInt(notifyBefore, 10),
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setShowForm(false);
      loadReminders();
    } catch (err) {
      alert('Error al guardar recordatorio: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recordatorios con Alerta WhatsApp</h2>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px' }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nuevo Recordatorio'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateReminder} className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', fontWeight: 600 }}>Crear Recordatorio</h3>
          <input
            className="input-field"
            placeholder="Titulo de la tarea o evento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="input-field"
            placeholder="Detalles adicionales..."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Fecha y Hora Limite:
          </label>
          <input
            type="datetime-local"
            className="input-field"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Anticipacion de alerta por WhatsApp:
          </label>
          <select
            className="input-field"
            value={notifyBefore}
            onChange={(e) => setNotifyBefore(e.target.value)}
          >
            <option value="15">15 minutos antes</option>
            <option value="30">30 minutos antes</option>
            <option value="60">1 hora antes</option>
            <option value="120">2 horas antes</option>
          </select>
          <button type="submit" className="btn-primary">Guardar Recordatorio</button>
        </form>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Cargando recordatorios...</p>}
      {error && (
        <div className="card" style={{ borderColor: '#EF4444', color: '#F87171' }}>
          <p>No se pudieron cargar los recordatorios. Verifica la conexion con el backend o Supabase.</p>
        </div>
      )}

      {!loading && reminders.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No hay recordatorios pendientes registrados.</p>
      )}

      {reminders.map((rem) => (
        <div key={rem.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="card-title">{rem.title}</div>
            <span
              className="status-badge"
              style={{
                backgroundColor: rem.status === 'notified' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: rem.status === 'notified' ? '#34D399' : '#FBBF24',
              }}
            >
              {rem.status === 'notified' ? 'Alerta Enviada' : 'Pendiente'}
            </span>
          </div>
          {rem.description && (
            <p style={{ fontSize: '0.85rem', color: '#CBD5E1', marginBottom: '8px' }}>
              {rem.description}
            </p>
          )}
          <div className="card-meta">
            Vence: {new Date(rem.due_date).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
            {' '}| Alerta: {rem.notify_before_minutes || 30} min antes
          </div>
        </div>
      ))}
    </div>
  );
}
