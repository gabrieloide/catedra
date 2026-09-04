import datetime
import requests
from config import NOTION_API_KEY, NOTION_CLASSES_DATABASE_ID

class NotionClassPublisher:
    def __init__(self, api_key=None, database_id=None):
        self.api_key = api_key or NOTION_API_KEY
        self.database_id = database_id or NOTION_CLASSES_DATABASE_ID
        if not self.api_key:
            raise ValueError("NOTION_API_KEY no esta configurada.")
        if not self.database_id:
            raise ValueError("NOTION_CLASSES_DATABASE_ID no esta configurada.")

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
        }

    def _create_heading(self, text, level=2):
        block_type = f"heading_{level}"
        return {
            "object": "block",
            "type": block_type,
            block_type: {
                "rich_text": [{"type": "text", "text": {"content": text[:2000]}}]
            }
        }

    def _create_paragraph(self, text):
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": text[:2000]}}]
            }
        }

    def _create_bullet(self, text):
        return {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": text[:2000]}}]
            }
        }

    def _create_todo(self, text):
        return {
            "object": "block",
            "type": "to_do",
            "to_do": {
                "rich_text": [{"type": "text", "text": {"content": text[:2000]}}],
                "checked": False
            }
        }

    def _split_text_to_chunks(self, text, max_len=1900):
        chunks = []
        while text:
            if len(text) <= max_len:
                chunks.append(text)
                break
            cut = text.rfind(" ", 0, max_len)
            if cut == -1:
                cut = max_len
            chunks.append(text[:cut].strip())
            text = text[cut:].strip()
        return chunks

    def publish_class(self, class_data, subject="Clase General", duration_str=""):
        """Publica el resumen estructurado y la transcripcion completa en Notion."""
        title = class_data.get("titulo_sesion", f"Clase de {subject}")
        now_iso = datetime.datetime.now().date().isoformat()

        # 1. Preparar propiedades de la pagina
        properties = {
            "Nombre": {
                "title": [{"text": {"content": title[:100]}}]
            }
        }

        # 2. Construir los bloques de contenido
        children = []

        # Resumen Ejecutivo
        children.append(self._create_heading("Resumen Ejecutivo", level=2))
        resumen = class_data.get("resumen_ejecutivo", "")
        for chunk in self._split_text_to_chunks(resumen):
            children.append(self._create_paragraph(chunk))

        # Conceptos Clave
        conceptos = class_data.get("conceptos_clave", [])
        if conceptos:
            children.append(self._create_heading("Conceptos Clave y Teoria", level=2))
            for c in conceptos:
                children.append(self._create_bullet(c))

        # Ejemplos y Casos Practicos
        ejemplos = class_data.get("ejemplos_y_casos", [])
        if ejemplos:
            children.append(self._create_heading("Ejemplos y Casos Practicos", level=2))
            for ej in ejemplos:
                children.append(self._create_bullet(ej))

        # Dudas y Preguntas de Alumnos
        dudas = class_data.get("preguntas_y_dudas", [])
        if dudas:
            children.append(self._create_heading("Dudas Resueltas en Clase", level=2))
            for d in dudas:
                children.append(self._create_bullet(d))

        # Tareas y Asignaciones
        tareas = class_data.get("tareas_y_asignaciones", [])
        if tareas:
            children.append(self._create_heading("Tareas y Fechas Limite", level=2))
            for t in tareas:
                children.append(self._create_todo(t))

        # Glosario
        glosario = class_data.get("glosario", [])
        if glosario:
            children.append(self._create_heading("Glosario de Terminos", level=2))
            for g in glosario:
                termino = g.get("termino", "")
                def_ = g.get("definicion", "")
                children.append(self._create_bullet(f"{termino}: {def_}"))

        # Transcripcion Completa en Bloque Desplegable (Toggle)
        transcripcion = class_data.get("transcripcion_completa", "")
        if transcripcion:
            toggle_children = []
            for chunk in self._split_text_to_chunks(transcripcion):
                toggle_children.append(self._create_paragraph(chunk))

            children.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "Ver Transcripcion Completa (Texto Verbatim)"}}],
                    "children": toggle_children[:100]  # Maximo 100 hijos directos
                }
            })

        # 3. Crear pagina en Notion
        create_page_url = "https://api.notion.com/v1/pages"
        payload = {
            "parent": {"database_id": self.database_id},
            "properties": properties,
            "children": children[:100]  # Limite por peticion inicial
        }

        print(f"[Notion Publisher] Creando pagina '{title}' en Notion...")
        res = requests.post(create_page_url, headers=self.headers, json=payload)
        if not res.ok:
            raise RuntimeError(f"Error al crear pagina en Notion ({res.status_code}): {res.text}")

        page_data = res.json()
        page_id = page_data["id"]
        page_url = page_data.get("url", "")
        print(f"[Notion Publisher] Pagina creada con exito! URL: {page_url}")

        # Si habian mas de 100 bloques, insertar los restantes
        remaining = children[100:]
        while remaining:
            batch = remaining[:100]
            remaining = remaining[100:]
            append_url = f"https://api.notion.com/v1/blocks/{page_id}/children"
            requests.patch(append_url, headers=self.headers, json={"children": batch})

        return page_url
