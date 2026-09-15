/**
 * constantes.js — Catálogo canónico y utilidades compartidas del pipeline.
 *
 * Centraliza:
 *  - El catálogo de presas con IDs estables (slug), nombre canónico, coordenadas
 *    y pertenencia al promedio estatal de Sinaloa.
 *  - La normalización de nombres (desacentuación → slug) y de alias históricos.
 *  - El parseo seguro de valores numéricos (strings con comas, "-", "s/d", "" → null).
 *
 * Usado por aggregate_data.js y por convertir_a_json_*.js
 */

const fs = require('fs');
const path = require('path');

// Umbral mínimo de presas de Sinaloa para calcular el promedio estatal ponderado.
// Evita que los días con cobertura parcial dibujen caídas falsas (p.ej. 2023).
const MIN_PRESAS_SINALOA = 8;

// Catálogo canónico de presas.
//  - id/slug estable: se usa como clave en data.json y presas.json.
//  - sinaloa: true → participa en el promedio estatal ponderado por capacidad NAMO.
//    (Santa Maria y Picachos se miden en el boletín pero no son parte del acumulado estatal.)
const PRESAS_CATALOGO = [
    { slug: 'luis-donaldo-colosio', nombre: 'Luis Donaldo Colosio', lat: 26.84444, lon: -108.36806, sinaloa: true },
    { slug: 'miguel-hidalgo-y-costilla', nombre: 'Miguel Hidalgo y Costilla', lat: 26.50889, lon: -108.58028, sinaloa: true },
    { slug: 'josefa-ortiz-de-dominguez', nombre: 'Josefa Ortiz de Domínguez', lat: 26.46194, lon: -108.70083, sinaloa: true },
    { slug: 'gustavo-diaz-ordaz', nombre: 'Gustavo Díaz Ordaz', lat: 25.79250, lon: -107.90944, sinaloa: true },
    { slug: 'guillermo-blake-aguilar', nombre: 'Guillermo Blake Aguilar', lat: 26.15000, lon: -108.28333, sinaloa: true },
    { slug: 'eustaquio-buelna', nombre: 'Eustaquio Buelna', lat: 25.49667, lon: -108.05194, sinaloa: true },
    { slug: 'adolfo-lopez-mateos', nombre: 'Adolfo López Mateos', lat: 25.09972, lon: -107.38778, sinaloa: true },
    { slug: 'sanalona', nombre: 'Sanalona', lat: 24.81417, lon: -107.15139, sinaloa: true },
    { slug: 'juan-guerrero-alcocer', nombre: 'Juan Guerrero Alcocer', lat: 24.62639, lon: -107.16056, sinaloa: true },
    { slug: 'jose-lopez-portillo', nombre: 'José López Portillo', lat: 24.09667, lon: -106.77250, sinaloa: true },
    { slug: 'aurelio-benassini-v', nombre: 'Aurelio Benassini V.', lat: 23.98917, lon: -106.57000, sinaloa: true },
    { slug: 'santiago-bayacora', nombre: 'Santiago Bayacora', lat: null, lon: null, sinaloa: true },
    { slug: 'guadalupe-victoria', nombre: 'Guadalupe Victoria', lat: null, lon: null, sinaloa: true },
    { slug: 'francisco-villa', nombre: 'Francisco Villa', lat: null, lon: null, sinaloa: true },
    { slug: 'caboraca', nombre: 'Caboraca', lat: null, lon: null, sinaloa: true },
    { slug: 'pena-del-aguila', nombre: 'Peña del Águila', lat: null, lon: null, sinaloa: true },
    { slug: 'santa-maria', nombre: 'Santa Maria', lat: 23.16667, lon: -105.67833, sinaloa: false },
    { slug: 'picachos', nombre: 'Picachos', lat: 23.47806, lon: -106.22361, sinaloa: false }
];

// Alias históricos de nombres en el boletín → slug canónico.
const ALIASES = {
    'josefa-o-de-dominguez': 'josefa-ortiz-de-dominguez',
    'pena-del-aguila': 'pena-del-aguila'
};

// Nombres alternativos con los que se ha citado cada presa en el boletín (solo para metadatos).
const ALIASES_NOMBRES = {
    'josefa-ortiz-de-dominguez': ['Josefa O. de Dominguez'],
    'pena-del-aguila': ['Peña del Aguila']
};

// Convierte un nombre a un slug estable: minúsculas, sin acentos, separadores a '-'.
function normalizeKey(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Resuelve cualquier variante de nombre a su slug canónico (o crea uno nuevo).
function slugFromNombre(nombre) {
    const key = normalizeKey(nombre);
    if (ALIASES[key]) return ALIASES[key];
    return key;
}

// Parsea un valor a número. Devuelve null si es nulo o un marcador no numérico ("-", "s/d", "", etc.).
function parseNum(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return Number.isFinite(val) ? val : null;
    const s = String(val).trim().replace(/,/g, '');
    if (s === '' || s === '-' || /^[-–—]?$/.test(s)) return null;
    const lower = s.toLowerCase();
    if (lower === 's/d' || lower === 'n/a' || lower === 'nd' || lower === 'nan' || lower === 'sin dato') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

// Catálogo indexado por slug, con acceso rápido por clave normalizada.
const PRESAS_POR_SLUG = Object.fromEntries(PRESAS_CATALOGO.map(p => [p.slug, p]));

// Convierte un nombre en un patrón regex donde los acentos son opcionales y los
// caracteres especiales quedan escapados. Permite buscar "Josefa Ortiz de Domínguez"
// en textos que la escriben sin acentos.
function escapeoAccento(nombre) {
    let out = '';
    for (const ch of String(nombre)) {
        const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (base !== ch) {
            out += `[${base}${ch}]`;
        } else if (/[a-zA-Z0-9 ]/.test(ch)) {
            out += ch;
        } else {
            out += '\\' + ch;
        }
    }
    return out;
}

function buscarPresaPorSlug(slug) { return PRESAS_POR_SLUG[slug] || null; }

// Nombre canónico para un slug (con fallback al slug si no existe).
function nombreCanonico(slug) {
    const p = PRESAS_POR_SLUG[slug];
    return p ? p.nombre : slug;
}

// Lee las carpetas json/YYYY y devuelve un mapa fecha -> array de registros crudos.
function leerDatosCrudos(inputDir) {
    const raw = {};
    if (!fs.existsSync(inputDir)) return raw;
    const years = fs.readdirSync(inputDir).filter(f => {
        const stat = fs.lstatSync(path.join(inputDir, f));
        return stat.isDirectory() && /^\d{4}$/.test(f);
    });
    years.forEach(year => {
        const yearDir = path.join(inputDir, year);
        if (!fs.existsSync(yearDir)) return;
        const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'));
        files.forEach(file => {
            const m = file.match(/datos-(\d{2})-(\d{2})-(\d{2})\.json/);
            if (!m) return;
            const [_, day, month, yy] = m;
            const y4 = yy.length === 2 ? '20' + yy : yy;
            const date = `${y4}-${month}-${day}`;
            try {
                raw[date] = JSON.parse(fs.readFileSync(path.join(yearDir, file), 'utf8'));
            } catch (e) {
                console.warn(`  [advertencia] No se pudo leer ${file}: ${e.message}`);
            }
        });
    });
    return raw;
}

// Extrae las fechas existentes en src/data/data.json (compatible con el esquema
// nuevo, `periodos[]`, y con el antiguo, objeto fecha -> presas).
function fechasEnDataJson(pathData) {
    if (!fs.existsSync(pathData)) return [];
    const data = JSON.parse(fs.readFileSync(pathData, 'utf8'));
    if (data && Array.isArray(data.periodos)) return data.periodos.map(p => p.fecha);
    if (data && typeof data === 'object') return Object.keys(data);
    return [];
}

module.exports = {
    MIN_PRESAS_SINALOA,
    PRESAS_CATALOGO,
    PRESAS_POR_SLUG,
    ALIASES,
    ALIASES_NOMBRES,
    normalizeKey,
    slugFromNombre,
    parseNum,
    escapeoAccento,
    buscarPresaPorSlug,
    nombreCanonico,
    leerDatosCrudos,
    fechasEnDataJson
};