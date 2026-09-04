import os
import json
import time
import requests
from config import GEMINI_API_KEY

class GeminiTranscriber:
    def __init__(self, api_key=None):
        self.api_key = api_key or GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY no esta configurada.")

    def upload_audio_file(self, file_path):
        """Sube el archivo de audio a la API de archivos de Google AI."""
        file_size = os.path.getsize(file_path)
        mime_type = "audio/wav"
        if file_path.endswith(".mp3"):
            mime_type = "audio/mp3"
        elif file_path.endswith(".flac"):
            mime_type = "audio/flac"
        elif file_path.endswith(".ogg") or file_path.endswith(".opus"):
            mime_type = "audio/ogg"

        upload_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={self.api_key}"
        headers = {
            "X-Goog-Upload-Command": "start, upload, finalize",
            "X-Goog-Upload-Header-Content-Length": str(file_size),
            "X-Goog-Upload-Header-Content-Type": mime_type,
            "Content-Type": mime_type,
        }

        print(f"[Gemini Cloud] Subiendo archivo de audio ({file_size / (1024*1024):.2f} MB)...")
        with open(file_path, "rb") as f:
            response = requests.post(upload_url, headers=headers, data=f)

        if not response.ok:
            raise RuntimeError(f"Fallo al subir audio a Gemini ({response.status_code}): {response.text}")

        data = response.json()
        file_uri = data.get("file", {}).get("uri")
        file_name = data.get("file", {}).get("name")
        print(f"[Gemini Cloud] Archivo subido con exito. URI: {file_uri}")
        return file_uri, file_name

    def process_class_audio(self, audio_file_path, subject="Clase"):
        """Sube el audio, genera la transcripcion completa y el resumen estructurado en una sola llamada."""
        file_uri, file_name = self.upload_audio_file(audio_file_path)

        # Esperar estado ACTIVE si es necesario
        time.sleep(2)

        generate_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"

        prompt = f"""
Actua como un asistente academico especializado en transcripcion y analisis pedagogico de clases universitarias/escolares.
La materia o curso es: "{subject}".

Analiza exhaustivamente el audio adjunto de la clase y genera una respuesta en formato JSON estricto con la siguiente estructura:
{{
  "titulo_sesion": "Titulo claro y formal de la clase",
  "resumen_ejecutivo": "Sintesis concisa de 2 a 3 parrafos sobre los temas centrales abordados en la clase.",
  "conceptos_clave": [
    "Concepto 1 con su explicacion teorica",
    "Concepto 2 con su explicacion teorica"
  ],
  "ejemplos_y_casos": [
    "Caso o ejemplo practico 1 desarrollado por el profesor",
    "Caso o ejemplo practico 2"
  ],
  "preguntas_y_dudas": [
    "Pregunta de un alumno y la respuesta dada por el docente"
  ],
  "tareas_y_asignaciones": [
    "Tareas, lecturas, actividades o fechas limites mencionadas"
  ],
  "glosario": [
    {{"termino": "Termino tecnico", "definicion": "Definicion precisa segun la clase"}}
  ],
  "transcripcion_completa": "Transcripcion textual integra y continua, palabra por palabra de todo lo dicho en el audio, sin omitir partes."
}}

Reglas:
- No utilices ningun emoji en el texto generado.
- No uses guiones largos en las respuestas.
- El formato de salida debe ser exclusivamente JSON valido.
"""

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"file_data": {"file_uri": file_uri, "mime_type": "audio/wav"}},
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2
            }
        }

        print("[Gemini Cloud] Procesando transcripcion y resumen con Gemini Flash...")
        resp = requests.post(generate_url, json=payload)

        # Limpiar archivo temporal en Google Cloud
        try:
            delete_url = f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={self.api_key}"
            requests.delete(delete_url)
        except Exception:
            pass

        if not resp.ok:
            raise RuntimeError(f"Error en Gemini GenerateContent ({resp.status_code}): {resp.text}")

        result_data = resp.json()
        content_text = result_data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(content_text)
