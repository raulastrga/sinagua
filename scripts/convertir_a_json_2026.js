const fs = require('fs');
const path = require('path');
const {
    PRESAS_POR_SLUG,
    ALIASES_NOMBRES,
    escapeoAccento,
    nombreCanonico
} = require('./constantes');

// Presas monitoreadas en 2026 (slugs canónicos).
const PRESAS_2026 = [
    'luis-donaldo-colosio', 'miguel-hidalgo-y-costilla', 'josefa-ortiz-de-dominguez',
    'gustavo-diaz-ordaz', 'guillermo-blake-aguilar', 'eustaquio-buelna',
    'adolfo-lopez-mateos', 'sanalona', 'juan-guerrero-alcocer', 'jose-lopez-portillo',
    'aurelio-benassini-v', 'santa-maria', 'picachos'
];

function variantesNombre(slug) {
    const cat = PRESAS_POR_SLUG[slug];
    const nombres = [cat.nombre, ...(ALIASES_NOMBRES[slug] || [])];
    return nombres.map(n => escapeoAccento(n));
}

function parsearTextoAJSON_2026(anio) {
    const carpetaDocs = path.join(__dirname, '..', 'docs', anio);
    const carpetaJson = path.join(__dirname, '..', 'json', anio);

    if (!fs.existsSync(carpetaJson)) fs.mkdirSync(carpetaJson, { recursive: true });

    if (!fs.existsSync(carpetaDocs)) {
        console.log(`Carpeta docs/${anio} no existe.`);
        return;
    }

    const archivos = fs.readdirSync(carpetaDocs).filter(f => f.endsWith('.txt'));

    archivos.forEach(archivo => {
        const texto = fs.readFileSync(path.join(carpetaDocs, archivo), 'utf8');
        const datosJSON = [];

        PRESAS_2026.forEach(slug => {
            // Regex insensible a acentos y tolerante a comas en los números.
            // NOMBRE + CAPAC + ELEV + CAPAC NAMO + ELEV NAMO + TOTAL + %
            const patron = `(?:${variantesNombre(slug).join('|')})\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)`;
            const match = texto.match(new RegExp(patron, 'i'));

            if (match) {
                // Quitar comas de miles (p.ej. "3,202.9")
                const limpiar = (val) => val.replace(/,/g, '');
                datosJSON.push({
                    nombre: nombreCanonico(slug),
                    capacidadConservacion: limpiar(match[1]),
                    elevacionConservacion: limpiar(match[2]),
                    capacidadNamo: limpiar(match[3]),
                    elevacionNamo: limpiar(match[4]),
                    almacenamientoActualMm3: limpiar(match[5]),
                    porcentaje: limpiar(match[6])
                });
            }
        });

        if (datosJSON.length > 0) {
            const fecha = archivo.replace('texto-', '').replace('.txt', '');
            const nombreJson = `datos-${fecha}.json`;
            fs.writeFileSync(path.join(carpetaJson, nombreJson), JSON.stringify(datosJSON, null, 2));
            console.log(`Generado: ${path.join('json', anio, nombreJson)}`);
        }
    });
}

parsearTextoAJSON_2026('2026');