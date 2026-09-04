import React, { useState } from 'react';
import { sendAssistantMessage } from '../services/api';

export default function AssistantTab() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hola Gabriel. Puedes pedirme cambios en tus tablas de Notion (como posponer fechas de alumnos o filtrar filas) o pedirme que agende recordatorios.',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (textToSend) => {
    const msg = textToSend || input;
    if (!msg.trim() || loading) return;

    const newMessages = [...messages, { sender: 'user', text: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await sendAssistantMessage(msg);
      setMessages([...newMessages, { sender: 'bot', text: res.reply }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { sender: 'bot', text: 'Error al procesar: ' + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Pospone una semana mas la clase de Juan y Maria',
    'Recuerdame preparar la clase de manana a las 8am',
    'Busca bases de datos en mi espacio de Notion',
    'Lista mis proximos recordatorios pendientes',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '12px' }}>
        Asistente de Acciones Notion y Recordatorios
      </h2>

      {/* Sugerencias rapidas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            className="tag-badge"
            style={{ cursor: 'pointer', padding: '6px 10px', fontSize: '0.75rem', background: '#1E293B', color: '#60A5FA' }}
            onClick={() => handleSend(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Area de Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column' }}>
        {messages.map((m, i) => (
          <div key={i} className={m.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble-bot" style={{ color: 'var(--text-secondary)' }}>
            Procesando orden con Gemini y consultando Notion...
          </div>
        )}
      </div>

      {/* Input de Envio */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          className="input-field"
          style={{ marginBottom: 0 }}
          placeholder="Escribe una orden para Notion o un recordatorio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className="btn-primary"
          style={{ width: 'auto', whiteSpace: 'nowrap' }}
          onClick={() => handleSend()}
          disabled={loading}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
