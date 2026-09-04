# Catedra: Suite Docente, Notion y Recordatorios

Suite integrada de uso personal, disenada para operar a costo cero ($0.00 USD) y optimizada para equipos ligeros (Intel Core i3 de 6ta generacion, 8 GB de RAM DDR3), con sistema de auto actualizacion continua mediante GitHub.

---

## Modulos del Sistema

### 1. `backend-service` (Node.js)
Servicio central en segundo plano que gestiona:
* **Bot de WhatsApp con Baileys**: Permite interactuar mediante mensajes de texto y recibir alertas proactivas. Se vincula una sola vez por codigo QR y almacena las credenciales en `auth_session/`.
* **Agente de IA para Notion (Gemini Flash con Function Calling)**: Permite enviar instrucciones por WhatsApp para:
  * Desplazar fechas de clases de alumnos (ejemplo: sumar 7 dias a alumnos especificos).
  * Consultar y filtrar filas en bases de datos de Notion.
  * Actualizar estados de tablas.
  * Agendar recordatorios en lenguaje natural.
* **Control de Rate Limiting**: Limitador de tasa y semaforo concurrente a 3 peticiones por segundo con reintentos y backoff exponencial ante respuestas 429/529 de Notion.
* **Programador de Recordatorios (Scheduler)**: Monitoreo cada minuto de la tabla `reminders` en Supabase para despachar alertas de WhatsApp con la anticipacion programada (ejemplo: 30 minutos antes).
* **API REST**: Expone endpoints locales para la aplicacion cliente (`/health`, `/api/notion/notes`, `/api/reminders`, `/api/chat`).

### 2. `desktop-transcriber` (Python)
Aplicacion de escritorio ultraliviana para grabacion y procesamiento de clases:
* **Captura de Audio con Cero Carga**: Graba microfono en formato comprimido (16.000 Hz mono).
* **Transcripcion y Resumen en la Nube (Costo $0.00)**: Sube el audio a la API de archivos de Google Gemini Flash. Procesa clases extensas en menos de 45 segundos en la nube sin exigir CPU ni saturar los 8 GB de RAM del equipo.
* **Publicacion Automatizada en Notion**: Crea la pagina en la base de datos de clases, estructurando:
  * Resumen ejecutivo.
  * Conceptos clave y teoria explicada.
  * Ejemplos y casos practicos.
  * Dudas de alumnos resueltas.
  * Tareas y fechas limite.
  * Glosario de terminos.
  * Transcripcion completa palabra por palabra dentro de un bloque desplegable (toggle).

### 3. `client-app` (React + Vite + Capacitor)
Aplicacion multiplataforma para PC Windows y Android:
* **Pestana Notas**: Sincronizada directamente con la base de datos de Notas en Notion.
* **Pestana Recordatorios**: Administracion de tareas alojadas en Supabase con fecha limite y seleccion de anticipacion para la alerta de WhatsApp.
* **Pestana Asistente Bot**: Terminal de chat interactiva para probar o ejecutar comandos directos hacia Notion y recordatorios.
* **Auto Actualizacion OTA**: Integrado con `@capgo/capacitor-updater` para descargar y aplicar automaticamente las ultimas versiones publicadas en GitHub Releases sin reinstalar el archivo APK.

---

## Auto Actualizacion Continua desde GitHub

* **En la PC**: El lanzador `start-suite.bat` ejecuta un `git fetch` y `git pull` automatico cada vez que se inicia, asegurando que el equipo secundario siempre tenga la ultima version del codigo y sus dependencias.
* **En Android (OTA)**: Cada `git push` a la rama `main` activa el flujo de GitHub Actions (`.github/workflows/deploy-and-release.yml`), compilando el cliente web y adjuntando `dist.zip` en un nuevo Release. Al abrir la app en el telefono, esta detecta la version nueva, la descarga y la aplica en segundo plano de inmediato.

---

## Guia de Puesta en Marcha

### Paso 1: Configurar Supabase
1. Abre tu proyecto en Supabase (o crea uno gratuito en [supabase.com](https://supabase.com)).
2. Ingresa al **SQL Editor** y ejecuta el script:
   `backend-service/supabase_schema.sql`
3. Copia la URL del proyecto y la clave `service_role` (Settings -> API).

### Paso 2: Configurar Notion y Gemini
1. Crea una integracion en [notion.so/my-integrations](https://www.notion.so/my-integrations) y copia el Token de integracion (`ntn_...`).
2. Conecta la integracion a tus bases de datos de Notas y Clases en Notion (Menu de tres puntos -> Conexiones -> Agregar tu integracion).
3. Obtiene una clave de API gratuita en [Google AI Studio](https://aistudio.google.com/).

### Paso 3: Configurar Archivos de Entorno
Crea un archivo `.env` dentro de `backend-service/` tomando como base `.env.example`:
```env
NOTION_API_KEY=ntn_tu_clave_notion
NOTION_NOTES_DATABASE_ID=id_base_datos_notas
NOTION_CLASSES_DATABASE_ID=id_base_datos_clases
SUPABASE_URL=https://tu_proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_clave_service_role
GEMINI_API_KEY=tu_clave_gemini
TARGET_PHONE_NUMBER=584120000000
```

Crea un archivo `.env` dentro de `desktop-transcriber/` tomando como base `.env.example`:
```env
GEMINI_API_KEY=tu_clave_gemini
NOTION_API_KEY=ntn_tu_clave_notion
NOTION_CLASSES_DATABASE_ID=id_base_datos_clases
```

### Paso 4: Iniciar Suite
Ejecuta con doble clic el lanzador:
```powershell
start-suite.bat
```
Al iniciar el backend por primera vez, escanea el codigo QR desde WhatsApp (Dispositivos vinculados).
