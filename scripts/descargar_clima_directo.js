const fs = require('fs');
const path = require('path');

// ============================================================
// Descarga directa de boletines meteorológicos desde cidh.org.mx
// sin necesidad de renderizar el sitio (sin Playwright).
// ============================================================

const AJAX_URL = process.env.WPFD_AJAX_URL || 'https://cidh.org.mx/wp-admin/admin-ajax.php?juwpfisadmin=false&action=wpfd&';
const SITIO_URL = 'https://cidh.org.mx/boletin-diario-del-clima/';
const ROOT_CATEGORY_ID = 71; // ID específico para Clima
const pageLimit = 10;
const MAX_INTENTOS = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OMITIR_FINES_SEMANA = false; // El clima suele publicarse diario

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function convertirFecha(fecha) {
    const [a, m, d] = fecha.split('-').map(Number);
    return { anio: a, mesNum: m, diaNum: d };
}

async function peticionJson(url) {
    const resp = await fetch(url, {
        headers: {
            'User-Agent': UA,
            'Referer': SITIO_URL,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
        },
        signal: AbortSignal.timeout(60000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} en ${url}`);
    return resp.json();
}

function urlCategorias(idCategoria) {
    return `${AJAX_URL}task=categories.display&view=categories&id=${idCategoria}&top=${ROOT_CATEGORY_ID}`;
}

function urlArchivos(idMes, pagina) {
    return `${AJAX_URL}task=files.display&view=files&id=${idMes}&rootcat=${ROOT_CATEGORY_ID}&page=${pagina}` +
        `&orderCol=created_time&orderDir=desc&page_limit=${pageLimit}&show_files=1`;
}

async function obtenerIdMes(anio, mesNum) {
    const raiz = await peticionJson(urlCategorias(ROOT_CATEGORY_ID));
    const anioCat = (raiz.categories || []).find(c => String(c.name) === String(anio));
    if (!anioCat) throw new Error(`No se encontró la categoría del año ${anio}`);

    const mesesResp = await peticionJson(urlCategorias(anioCat.term_id));
    const mesNombre = meses[mesNum - 1];
    const mesCat = (mesesResp.categories || []).find(c => c.name.toLowerCase() === mesNombre);
    if (!mesCat) throw new Error(`No se encontró la categoría del mes ${mesNombre} ${anio}`);

    return { mesId: mesCat.term_id, slugMes: mesCat.slug };
}

async function obtenerArchivosDeMes(idMes) {
    const archivos = [];
    for (let pag = 1; pag <= 12; pag++) {
        const data = await peticionJson(urlArchivos(idMes, pag));
        const lista = data.files || [];
        for (const f of lista) archivos.push(f);
        if (lista.length < pageLimit) break;
    }
    return archivos;
}

function buscarArchivo(archivos, anio, mesNum, diaNum) {
    const dd = String(diaNum).padStart(2, '0');
    const mm = String(mesNum).padStart(2, '0');
    const yyyy = String(anio);
    
    // Posibles patrones de título
    const patrones = [
        `${dd}-${mm}-${yyyy}`,
        `${dd}-${mm}-${yyyy.slice(-2)}`,
        `boletin-meteorologico-del-${dd}-${mm}-${yyyy}`
    ];

    return archivos.find(f => {
        const titulo = (f.post_title || '').toLowerCase();
        return patrones.some(p => titulo.includes(p.toLowerCase()));
    });
}

async function guardarPdf(destino, url) {
    const resp = await fetch(url, {
        headers: { 'User-Agent': UA, 'Referer': SITIO_URL },
        signal: AbortSignal.timeout(90000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar ${url}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(destino, buffer);
    return buffer.length;
}

async function descargarBoletin(fechaEspecifica = null) {
    let anio, mesNum, diaNum;
    if (fechaEspecifica) {
        ({ anio, mesNum, diaNum } = convertirFecha(fechaEspecifica));
    } else {
        const n = new Date();
        anio = n.getFullYear(); mesNum = n.getMonth() + 1; diaNum = n.getDate();
    }

    const formatoFecha = `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${String(anio)}`;
    const ruta = path.join(process.cwd(), 'data', 'clima', String(anio));
    if (!fs.existsSync(ruta)) fs.mkdirSync(ruta, { recursive: true });
    const destino = path.join(ruta, `BOLETIN-${formatoFecha}.pdf`);

    console.log(`\n--- Descarga Clima: ${formatoFecha} ---`);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        try {
            console.log(`   [Intento ${intento}/${MAX_INTENTOS}]`);
            const { mesId } = await obtenerIdMes(anio, mesNum);
            const archivos = await obtenerArchivosDeMes(mesId);
            const archivo = buscarArchivo(archivos, anio, mesNum, diaNum);
            
            if (!archivo) throw new Error('Boletín no encontrado');

            console.log(`   Descargando: ${archivo.linkdownload}`);
            const bytes = await guardarPdf(destino, archivo.linkdownload);
            console.log(`   ✓ Guardado (${bytes} bytes)`);
            return true;
        } catch (err) {
            console.error(`   Error: ${err.message}`);
            if (intento < MAX_INTENTOS) await new Promise(r => setTimeout(r, 2000));
        }
    }
    return false;
}

if (require.main === module) {
    const fechaParam = process.argv[2];
    descargarBoletin(fechaParam).then(ok => process.exit(ok ? 0 : 1));
}
