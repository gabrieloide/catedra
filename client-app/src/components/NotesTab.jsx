import React, { useState, useEffect } from 'react';
import { fetchNotes, createNote } from '../services/api';

export default function NotesTab() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState(null);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotes();
      setNotes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createNote({
        title,
        content,
        tags: tag ? [tag.trim()] : [],
      });
      setTitle('');
      setContent('');
      setTag('');
      setShowForm(false);
      loadNotes();
    } catch (err) {
      alert('Error al guardar nota en Notion: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Notas Sincronizadas con Notion</h2>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px' }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nueva Nota'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateNote} className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', fontWeight: 600 }}>Crear Nota en Notion</h3>
          <input
            className="input-field"
            placeholder="Titulo de la nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="input-field"
            placeholder="Contenido de la nota..."
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="Etiqueta (ej. Universidad, Personal)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <button type="submit" className="btn-primary">Guardar en Notion</button>
        </form>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Cargando notas de Notion...</p>}
      {error && (
        <div className="card" style={{ borderColor: '#EF4444', color: '#F87171' }}>
          <p>No se pudieron cargar las notas. Verifica que NOTION_NOTES_DATABASE_ID este configurada en el backend.</p>
        </div>
      )}

      {!loading && notes.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)' }}>No hay notas en la base de datos de Notion.</p>
      )}

      {notes.map((note) => (
        <div key={note.id} className="card">
          <div className="card-title">{note.title}</div>
          {note.tags && note.tags.map((t) => (
            <span key={t} className="tag-badge">{t}</span>
          ))}
          <div className="card-meta" style={{ marginTop: '8px' }}>
            Modificado: {new Date(note.lastEditedTime).toLocaleDateString('es-ES')}
          </div>
        </div>
      ))}
    </div>
  );
}
