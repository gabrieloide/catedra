import React, { useState, useEffect } from 'react';
import NotesTab from './components/NotesTab';
import RemindersTab from './components/RemindersTab';
import AssistantTab from './components/AssistantTab';
import { fetchHealth, getApiBaseUrl, setApiBaseUrl } from './services/api';
import { checkAndUpdateFromGitHub, CURRENT_APP_VERSION } from './services/updater';

export default function App() {
  const [activeTab, setActiveTab] = useState('notes');
  const [serverOnline, setServerOnline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(getApiBaseUrl());
  const [updaterStatus, setUpdaterStatus] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await fetchHealth();
        setServerOnline(health.status === 'ok');
      } catch {
        setServerOnline(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  // Comprobar actualizaciones de GitHub al iniciar
  useEffect(() => {
    checkAndUpdateFromGitHub((status) => setUpdaterStatus(status)).then((result) => {
      if (result?.hasUpdate) {
        setUpdateAvailable(result);
      }
    });
  }, []);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setApiBaseUrl(apiUrlInput.trim());
    setShowSettings(false);
    window.location.reload();
  };

  const handleManualUpdateCheck = async () => {
    setUpdaterStatus('Buscando actualizaciones...');
    const result = await checkAndUpdateFromGitHub((status) => setUpdaterStatus(status));
    if (result?.hasUpdate) {
      setUpdateAvailable(result);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div>
          <div className="app-title">Catedra</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Asistente Docente, Notion y Recordatorios (v{CURRENT_APP_VERSION})
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`status-badge ${serverOnline ? 'connected' : ''}`}>
            {serverOnline ? 'Backend Activo' : 'Sin Conexion'}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Ajustes
          </button>
        </div>
      </header>

      {/* Aviso de Actualizacion Disponible */}
      {updateAvailable && (
        <div style={{ padding: '10px 16px', background: 'rgba(37, 99, 235, 0.2)', borderBottom: '1px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#93C5FD' }}>
            Nueva version v{updateAvailable.newVersion} disponible en GitHub.
          </span>
          {updateAvailable.downloadUrl && (
            <a
              href={updateAvailable.downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.75rem', color: '#FFFFFF', background: 'var(--accent-blue)', padding: '4px 8px', borderRadius: '4px', textDecoration: 'none' }}
            >
              Descargar
            </a>
          )}
        </div>
      )}

      {/* Modal de Configuracion y Actualizaciones */}
      {showSettings && (
        <div style={{ padding: '16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Direccion del Servidor Backend</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Para Android, ingresa la IP local de tu PC (ejemplo: http://192.168.1.100:3000).
          </p>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              className="input-field"
              style={{ marginBottom: 0 }}
              value={apiUrlInput}
              onChange={(e) => setApiUrlInput(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Guardar</button>
          </form>

          <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Actualizaciones Continuas (GitHub Releases)</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Estado: {updaterStatus || 'Sistema al dia'}
          </p>
          <button
            onClick={handleManualUpdateCheck}
            className="btn-primary"
            style={{ width: 'auto', background: '#334155' }}
          >
            Buscar Actualizaciones Ahora
          </button>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="main-content">
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'reminders' && <RemindersTab />}
        {activeTab === 'assistant' && <AssistantTab />}
      </main>

      {/* Barra de Navegacion Inferior */}
      <nav className="nav-bar">
        <button
          className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Notas Notion
        </button>
        <button
          className={`nav-item ${activeTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveTab('reminders')}
        >
          Recordatorios
        </button>
        <button
          className={`nav-item ${activeTab === 'assistant' ? 'active' : ''}`}
          onClick={() => setActiveTab('assistant')}
        >
          Asistente Bot
        </button>
      </nav>
    </div>
  );
}
