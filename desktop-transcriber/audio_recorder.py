import os
import time
import threading
import subprocess

class AudioRecorder:
    def __init__(self, sample_rate=16000, channels=1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.is_recording = False
        self.is_paused = False
        self.start_time = 0
        self.elapsed_seconds = 0
        self.output_path = ""
        self._thread = None
        self._stream = None
        self._file = None
        self._pause_lock = threading.Lock()

    def start(self, output_path):
        """Inicia la grabacion de audio en el archivo especificado."""
        self.output_path = output_path
        self.is_recording = True
        self.is_paused = False
        self.start_time = time.time()
        self.elapsed_seconds = 0

        # Directorio temporal si no existe
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        self._thread = threading.Thread(target=self._record_loop, daemon=True)
        self._thread.start()

    def _record_loop(self):
        try:
            import sounddevice as sd
            import soundfile as sf

            with sf.SoundFile(
                self.output_path,
                mode="w",
                samplerate=self.sample_rate,
                channels=self.channels,
                subtype="PCM_16"
            ) as self._file:
                def callback(indata, frames, time_info, status):
                    if self.is_recording and not self.is_paused:
                        self._file.write(indata)

                with sd.InputStream(
                    samplerate=self.sample_rate,
                    channels=self.channels,
                    dtype="int16",
                    callback=callback
                ):
                    while self.is_recording:
                        time.sleep(0.1)
                        if not self.is_paused:
                            self.elapsed_seconds = int(time.time() - self.start_time)
        except ImportError:
            # Fallback en caso de usar grabacion directa por FFmpeg
            self._record_with_ffmpeg()
        except Exception as e:
            print(f"[Error de Grabacion]: {e}")
            self.is_recording = False

    def _record_with_ffmpeg(self):
        cmd = [
            "ffmpeg",
            "-y",
            "-f", "dshow",
            "-i", "audio=virtual-audio-capturer",
            "-ac", str(self.channels),
            "-ar", str(self.sample_rate),
            self.output_path
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        while self.is_recording:
            time.sleep(0.5)
            self.elapsed_seconds = int(time.time() - self.start_time)
        proc.terminate()

    def pause(self):
        """Pausa la grabacion."""
        self.is_paused = True

    def resume(self):
        """Reanuda la grabacion."""
        self.is_paused = False

    def stop(self):
        """Detiene la grabacion y finaliza el archivo."""
        self.is_recording = False
        self.is_paused = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        return self.output_path

    def get_formatted_time(self):
        mins, secs = divmod(self.elapsed_seconds, 60)
        hours, mins = divmod(mins, 60)
        if hours > 0:
            return f"{hours:02d}:{mins:02d}:{secs:02d}"
        return f"{mins:02d}:{secs:02d}"
