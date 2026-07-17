# SinAgua - Dashboard de Monitoreo de Presas de Sinaloa

SinAgua es una plataforma web dedicada al análisis, visualización y monitoreo histórico del nivel de almacenamiento de las presas en el estado de Sinaloa, México. El proyecto proporciona una visión panorámica y detallada, facilitando la toma de decisiones informadas para productores agrícolas y la ciudadanía.

## 🚀 Características del Dashboard

*   **Panel Unificado:** Vista integral con todas las gráficas y mapas visibles simultáneamente en una interfaz responsiva (Grid de 2 columnas en escritorio, 1 en móvil).
*   **Estadísticas Generales:** Resumen del porcentaje promedio estatal con indicadores de variación vs. ayer y vs. el mes pasado.
*   **Estado Diario:** Visualización rápida del almacenamiento actual de todas las presas.
*   **Evolución Temporal:** Gráficas de línea con filtros dinámicos por presa y rango de tiempo (1 semana, 1 mes, 3 meses, 1 año, Histórico).
*   **Promedio Anual:** Análisis de tendencias estatales o por presa agrupado por años.
*   **Vista de Mapa:** Geolocalización interactiva con indicadores porcentuales en tiempo real.

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** HTML5, CSS3 (Tailwind CSS), JavaScript.
*   **Visualización de Datos:** Chart.js (gráficas), Leaflet.js (mapas).
*   **Backend (Procesamiento):** Node.js con Playwright para web scraping y estructuración de datos.

## 📂 Estructura del Proyecto

```text
/
├── json/              # Datos crudos estructurados por año
├── src/
│   ├── assets/        # Imágenes y logos
│   ├── data/          # Archivo 'data.json' consolidado para el sitio
│   └── js/            # Lógica del dashboard (script.js)
├── scripts/           # Herramientas de scraping y agregación de datos
├── .github/workflows/ # Automatización de actualización diaria
└── index.html         # Página principal del dashboard
```

## ⚙️ Configuración y Uso

### 1. Procesamiento de Datos
Para actualizar el archivo maestro `src/data/data.json` con los datos más recientes:

```bash
node scripts/aggregate_data.js
```

### 2. Visualización Local
1.  Inicia un servidor web local en la raíz del proyecto (ejemplo con Python):
    ```bash
    python3 -m http.server 8000
    ```
2.  Accede a `http://localhost:8000` en tu navegador.

## 📊 Fuente de Datos
Los datos presentados son obtenidos y procesados a partir de la información oficial proporcionada por la **[Comisión para la Investigación y Defensa de las Hortalizas de Sinaloa (CIDH)](https://cidh.org.mx/)**.

---
*© 2026 SinAgua - Todos los derechos reservados.*
