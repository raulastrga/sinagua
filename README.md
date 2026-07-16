# SinAgua - Monitoreo de Presas de Sinaloa

SinAgua es una plataforma web dedicada al análisis, visualización y monitoreo histórico del nivel de almacenamiento de las presas en el estado de Sinaloa, México. El proyecto facilita la toma de decisiones informadas para productores agrícolas y la ciudadanía en general mediante datos precisos y una interfaz intuitiva.

## 🚀 Características Principales

*   **Dashboard Interactivo:** Visualización dinámica de los niveles de almacenamiento porcentual.
*   **Vista Diaria:** Análisis detallado del estado de todas las presas en una fecha seleccionada.
*   **Vista Histórica:** Seguimiento de la evolución porcentual de una presa específica a lo largo del tiempo.
*   **Histórico Anual:** Agrupación y cálculo automático de promedios anuales por presa.
*   **Vista de Mapa:** Geolocalización interactiva de todas las presas con indicadores de porcentaje actual sobre un mapa estilizado.
*   **Diseño Moderno:** Interfaz responsiva desarrollada con Tailwind CSS para una óptima visualización en escritorio y dispositivos móviles.

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** HTML5, CSS3 (Tailwind CSS), JavaScript.
*   **Visualización de Datos:** Chart.js (gráficas), Leaflet.js (mapas).
*   **Backend (Procesamiento):** Node.js (scripts de agregación de datos).

## 📂 Estructura del Proyecto

```text
/
├── JSON/              # Datos crudos estructurados por año y día
├── public/            # Archivos del sitio web (index.html, JS, CSS, assets)
├── scripts/           # Herramientas de procesamiento (aggregate_data.js)
└── README.md
```

## ⚙️ Configuración y Uso

### 1. Procesamiento de Datos
Para consolidar los archivos JSON individuales en el archivo maestro (`public/data.json`) necesario para el sitio web, ejecuta:

```bash
node scripts/aggregate_data.js
```

### 2. Visualización
Debido a las restricciones de seguridad de los navegadores para cargar archivos locales vía `fetch`, es necesario servir el proyecto mediante un servidor web local:

1.  Navega a la carpeta `/public`:
    ```bash
    cd public
    ```
2.  Inicia un servidor web local (ejemplo con Python):
    ```bash
    python3 -m http.server 8000
    ```
3.  Accede a `http://localhost:8000` en tu navegador.

## 📊 Fuente de Datos
Los datos presentados son obtenidos y procesados a partir de la información oficial proporcionada por la **[Comisión para la Investigación y Defensa de las Hortalizas de Sinaloa (CIDH)](https://cidh.org.mx/)**.

---
*© 2026 SinAgua - Todos los derechos reservados.*
