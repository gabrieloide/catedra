import os
import sys
import time
import threading
import tkinter as tk
from tkinter import messagebox, ttk

from audio_recorder import AudioRecorder
from gemini_transcriber import GeminiTranscriber
from notion_publisher import NotionClassPublisher
from config import GEMINI_API_KEY, NOTION_API_KEY, NOTION_CLASSES_DATABASE_ID

class TranscriberApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Catedra: Grabador y Transcriptor de Clases a Notion")
        self.geometry("640x520")
        self.minsize(560, 440)
        self.configure(bg="#F4F5F7")

        self.recorder = AudioRecorder()
        self.temp_audio_file = os.path.abspath("temp_class_audio.wav")

        self._create_widgets()
        self._update_timer()

    def _create_widgets(self):
        # Marco superior
        header_frame = tk.Frame(self, bg="#1E293B", padx=20, pady=16)
        header_frame.pack(fill=tk.X)

        title_label = tk.Label(
            header_frame,
            text="Catedra: Grabador y Transcriptor de Clases",
            font=("Segoe UI", 16, "bold"),
            fg="#FFFFFF",
            bg="#1E293B"
        )
        title_label.pack(anchor="w")

        subtitle_label = tk.Label(
            header_frame,
            text="Procesamiento en la nube sin consumo de CPU ni limites de cuota",
            font=("Segoe UI", 10),
            fg="#94A3B8",
            bg="#1E293B"
        )
        subtitle_label.pack(anchor="w")

        # Marco central de configuracion
        content_frame = tk.Frame(self, bg="#F4F5F7", padx=24, pady=16)
        content_frame.pack(fill=tk.BOTH, expand=True)

        # Campo: Materia o Asignatura
        lbl_materia = tk.Label(content_frame, text="Materia o Curso:", font=("Segoe UI", 10, "bold"), bg="#F4F5F7", fg="#334155")
        lbl_materia.pack(anchor="w", pady=(0, 4))
        self.ent_materia = ttk.Entry(content_frame, font=("Segoe UI", 11))
        self.ent_materia.insert(0, "Matematicas")
        self.ent_materia.pack(fill=tk.X, pady=(0, 12))

        # Campo: Titulo Opcional
        lbl_titulo = tk.Label(content_frame, text="Tema de la Sesion (Opcional):", font=("Segoe UI", 10, "bold"), bg="#F4F5F7", fg="#334155")
        lbl_titulo.pack(anchor="w", pady=(0, 4))
        self.ent_titulo = ttk.Entry(content_frame, font=("Segoe UI", 11))
        self.ent_titulo.pack(fill=tk.X, pady=(0, 16))

        # Cronometro
        self.lbl_timer = tk.Label(
            content_frame,
            text="00:00:00",
            font=("Consolas", 32, "bold"),
            fg="#0F172A",
            bg="#E2E8F0",
            padx=16,
            pady=8,
            relief=tk.GROOVE
        )
        self.lbl_timer.pack(pady=(0, 16))

        # Botones de Accion
        btn_frame = tk.Frame(content_frame, bg="#F4F5F7")
        btn_frame.pack(fill=tk.X, pady=(0, 16))

        self.btn_record = tk.Button(
            btn_frame,
            text="Iniciar Grabacion",
            font=("Segoe UI", 11, "bold"),
            bg="#16A34A",
            fg="#FFFFFF",
            activebackground="#15803D",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=16,
            pady=8,
            command=self._start_recording
        )
        self.btn_record.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)

        self.btn_pause = tk.Button(
            btn_frame,
            text="Pausar",
            font=("Segoe UI", 11),
            bg="#E2E8F0",
            fg="#475569",
            state=tk.DISABLED,
            relief=tk.FLAT,
            padx=12,
            pady=8,
            command=self._toggle_pause
        )
        self.btn_pause.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)

        self.btn_stop = tk.Button(
            btn_frame,
            text="Finalizar y Enviar a Notion",
            font=("Segoe UI", 11, "bold"),
            bg="#2563EB",
            fg="#FFFFFF",
            activebackground="#1D4ED8",
            activeforeground="#FFFFFF",
            state=tk.DISABLED,
            relief=tk.FLAT,
            padx=16,
            pady=8,
            command=self._stop_and_process
        )
        self.btn_stop.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)

        # Area de Estado / Log
        self.lbl_status = tk.Label(
            content_frame,
            text="Estado: Esperando inicio de clase.",
            font=("Segoe UI", 10),
            fg="#64748B",
            bg="#F4F5F7"
        )
        self.lbl_status.pack(anchor="w", pady=(0, 6))

        self.txt_log = tk.Text(content_frame, height=6, font=("Segoe UI", 9), bg="#FFFFFF", fg="#1E293B", relief=tk.SOLID, bd=1)
        self.txt_log.pack(fill=tk.BOTH, expand=True)

    def log(self, text):
        self.txt_log.insert(tk.END, f"{text}\n")
        self.txt_log.see(tk.END)
        self.lbl_status.config(text=f"Estado: {text}")

    def _update_timer(self):
        if self.recorder.is_recording and not self.recorder.is_paused:
            self.lbl_timer.config(text=self.recorder.get_formatted_time())
        self.after(500, self._update_timer)

    def _start_recording(self):
        if not GEMINI_API_KEY:
            messagebox.showwarning("Configuracion Requerida", "GEMINI_API_KEY no esta configurada en .env.")
            return

        self.btn_record.config(state=tk.DISABLED)
        self.btn_pause.config(state=tk.NORMAL, text="Pausar", bg="#F59E0B", fg="#FFFFFF")
        self.btn_stop.config(state=tk.NORMAL)
        self.ent_materia.config(state=tk.DISABLED)
        self.ent_titulo.config(state=tk.DISABLED)

        self.recorder.start(self.temp_audio_file)
        self.log("Grabando audio de clase en segundo plano...")

    def _toggle_pause(self):
        if not self.recorder.is_paused:
            self.recorder.pause()
            self.btn_pause.config(text="Reanudar", bg="#10B981")
            self.log("Grabacion en pausa.")
        else:
            self.recorder.resume()
            self.btn_pause.config(text="Pausar", bg="#F59E0B")
            self.log("Grabacion reanudada.")

    def _stop_and_process(self):
        self.btn_pause.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.DISABLED)
        self.log("Deteniendo grabacion y finalizando archivo...")

        self.recorder.stop()

        materia = self.ent_materia.get().strip() or "Clase General"
        titulo_manual = self.ent_titulo.get().strip()

        # Procesamiento en segundo plano para no congelar la interfaz grafica
        threading.Thread(
            target=self._process_pipeline,
            args=(materia, titulo_manual),
            daemon=True
        ).start()

    def _process_pipeline(self, materia, titulo_manual):
        try:
            self.log("Subiendo audio a Gemini Cloud API...")
            transcriber = GeminiTranscriber(GEMINI_API_KEY)
            class_data = transcriber.process_class_audio(self.temp_audio_file, subject=materia)

            if titulo_manual:
                class_data["titulo_sesion"] = titulo_manual

            self.log("Audio transcrito y estructurado. Publicando en Notion...")
            publisher = NotionClassPublisher(NOTION_API_KEY, NOTION_CLASSES_DATABASE_ID)
            page_url = publisher.publish_class(class_data, subject=materia, duration_str=self.recorder.get_formatted_time())

            self.log(f"Completado exitosamente! Publicado en: {page_url}")
            messagebox.showinfo("Proceso Exitoso", f"La clase fue transcrita y maquetada en Notion exitosamente.\n\nEnlace:\n{page_url}")

            # Limpiar archivo local
            if os.path.exists(self.temp_audio_file):
                os.remove(self.temp_audio_file)

        except Exception as err:
            self.log(f"Error durante el procesamiento: {err}")
            messagebox.showerror("Error en Procesamiento", f"Ocurrio un error: {err}")
        finally:
            self.btn_record.config(state=tk.NORMAL)
            self.ent_materia.config(state=tk.NORMAL)
            self.ent_titulo.config(state=tk.NORMAL)
            self.lbl_timer.config(text="00:00:00")

if __name__ == "__main__":
    app = TranscriberApp()
    app.mainloop()
