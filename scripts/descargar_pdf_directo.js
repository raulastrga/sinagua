const fs = require('fs');
const path = require('path');

// ============================================================
// Descarga directa de informes de presas desde cidh.org.mx
// sin necesidad de renderizar el sitio (sin Playwright).
//
// El sitio usa el plugin "WP File Download" que expone los
// archivos mediante AJAX público (sin nonce ni cookies). Se
// aprovecha ese patrón para:
//   1. Listar categorías (años) desde la raíz (id=77)
//   2. Listar categorías (meses) de un año
//   3. Listar archivos de un mes (task=files.display)
//   4. Descargar el PDF directamente vía el campo linkdownload
// ============================================================

const AJAX_URL = 'https://cidh.org.mx/wp-admin/admin-ajax.php?juwpfisadmin=false&action=wpfd&';
const ROOT_CATEGORY_ID = 77;
const pageLimit = 10; // maximos por página que devuelve el plugin
const MAX_INTENTOS = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OMITIR_FINES_SEMANA = true;

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function convertirFecha(fecha) {
    const [a, m, d] = fecha.split('-').map(Number);
    return { anio: a, mesNum: m, diaNum: d };
}

function esFinDeSemana(anio, mesNum, diaNum) {
    const dia = new Date(anio, mesNum - 1, diaNum).getDay();
    return dia === 0 || dia === 6;
}

async function peticionJson(url) {
    const resp = await fetch(url, {
        headers: {
            'User-Agent': UA,
            'Referer': 'https://cidh.org.mx/almacenamiento-de-presas/',
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

// Obtiene el ID de categoría del mes objetivo de un año
async function obtenerIdMes(anio, mesNum) {
    // 1. Categorías raíz: los años
    const raiz = await peticionJson(urlCategorias(ROOT_CATEGORY_ID));
    const anioCat = (raiz.categories || []).find(c => String(c.name) === String(anio));
    if (!anioCat) throw new Error(`No se encontró la categoría del año ${anio}`);

    // 2. Subcategorías del año: los meses
    const mesesResp = await peticionJson(urlCategorias(anioCat.term_id));
    const mesNombre = meses[mesNum - 1];
    const mesCat = (mesesResp.categories || []).find(c => c.name.toLowerCase() === mesNombre);
    if (!mesCat) throw new Error(`No se encontró la categoría del mes ${mesNombre} ${anio}`);

    return { mesId: mesCat.term_id, slugMes: mesCat.slug };
}

// Obtiene todos los archivos de un mes (itera la paginación interna)
async function obtenerArchivosDeMes(idMes) {
    const archivos = [];
    for (let pag = 1; pag <= 12; pag++) {
        const data = await peticionJson(urlArchivos(idMes, pag));
        const lista = data.files || [];
        for (const f of lista) archivos.push(f);
        if (lista.length < pageLimit) break; // última página
    }
    return archivos;
}

// Busca el archivo cuyo título o fecha coincida con el día objetivo
function buscarArchivo(archivos, anio, mesNum, diaNum, formatos) {
    const dia = String(diaNum).padStart(2, '0');
    const mes = String(mesNum).padStart(2, '0');
    const anioShort = String(anio).slice(-2);
    const patronTitulo = formatos.map(p => p.toLowerCase());
    const fechaCorta = `${dia}-${mes}-${anioShort}`;
    const fechaLarga = `${dia}-${mes}-${anio}`;

    for (const f of archivos) {
        const titulo = (f.post_title || '').toLowerCase();
        if (patronTitulo.some(p => titulo.includes(p))) return f;
    }
    // Fallback por fecha explícita (campo created: DD-MM-YYYY)
    return archivos.find(f => f.created === fechaLarga || f.created === fechaCorta) || null;
}

async function descargarInforme(fechaEspecifica = null) {
    let anio, mesNum, diaNum;
    if (fechaEspecifica) {
        ({ anio, mesNum, diaNum } = convertirFecha(fechaEspecifica));
    } else {
        const n = new Date();
        anio = n.getFullYear(); mesNum = n.getMonth() + 1; diaNum = n.getDate();
    }

    if (OMITIR_FINES_SEMANA && esFinDeSemana(anio, mesNum, diaNum)) {
        console.log(`   Día ${fechaEspecifica} es fin de semana. Omitiendo descarga.`);
        return false;
    }

    const mesNombre = meses[mesNum - 1];
    const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
    const formatoFecha = `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${String(anio).slice(-2)}`;
    const patrones = [formatoFecha, `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${anio}`];

    console.log(`\n--- Descarga directa para: ${fechaEspecifica || 'Hoy'} (${mesCapitalizado} ${anio}) ---`);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        try {
            console.log(`   [Intento ${intento}/${MAX_INTENTOS}]`);
            const { mesId } = await obtenerIdMes(anio, mesNum);
            console.log(`   Categoría del mes encontrada (id ${mesId})`);
            const archivos = await obtenerArchivosDeMes(mesId);
            console.log(`   ${archivos.length} archivos en el mes`);
            const archivo = buscarArchivo(archivos, anio, mesNum, diaNum, patrones);
            if (!archivo) throw new Error('Archivo no encontrado en el mes indicado');

            const ruta = path.join(process.cwd(), 'data', String(anio));
            if (!fs.existsSync(ruta)) fs.mkdirSync(ruta, { recursive: true });
            const destino = path.join(ruta, `INFORME-${formatoFecha}-PRESAS.pdf`);

            console.log(`   Descargando: ${archivo.linkdownload}`);
            const resp = await fetch(archivo.linkdownload, {
                headers: { 'User-Agent': UA, 'Referer': 'https://cidh.org.mx/almacenamiento-de-presas/' },
                signal: AbortSignal.timeout(90000)
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar`);
            const buffer = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(destino, buffer);
            console.log(`   ✓ Guardado (${buffer.length} bytes)`);
            return true;
        } catch (err) {
            console.error(`   Error intento ${intento}: ${err.message}`);
            if (intento < MAX_INTENTOS) await new Promise(r => setTimeout(r, 2000));
        }
    }
    return false;
}

module.exports = { descargarInforme };

if (require.main === module) {
    const fechaParam = process.argv[2];
    descargarInforme(fechaParam).then(ok => process.exit(ok ? 0 : 1));
}