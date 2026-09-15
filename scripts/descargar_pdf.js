const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL_SITIO = 'https://cidh.org.mx/almacenamiento-de-presas/';
const DEBUG_DIR = path.join(process.cwd(), 'data', 'debug');
const MAX_INTENTOS = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function asegurarDebug() {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

function nombreArchivoDebug(anio, mesNum, diaNum, intento, ext) {
    const f = `${anio}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}-intento${intento}.${ext}`;
    return path.join(DEBUG_DIR, f);
}

// Abre el árbol de años, hace clic en el año y espera a que el DOM muestre los meses.
async function abrirAnio(page, anio) {
    await page.goto(URL_SITIO, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!await esperarCategoria(page, String(anio), 45000)) {
        throw new Error(`No apareció el enlace del año ${anio}`);
    }
    const resp = esperarAjax(page, 'categories.display');
    await page.locator(`a.wpfdcategory.catlink[title="${anio}"]`).click();
    await resp;

    // IMPORTANTE: el AJAX responde ANTES de que el DOM inserte los <a> de los meses.
    // Esperamos a que exista al menos un mes (cualquier .wpfdcategory.catlink con title de mes).
    await page.waitForFunction(
        () => [...document.querySelectorAll('a.wpfdcategory.catlink')].some(
            a => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
                .includes((a.getAttribute('title') || '').trim())
        ),
        { timeout: 30000, polling: 300 }
    ).catch(() => {});
}

// Abre un mes concreto y busca el informe en sus archivos.
async function abrirMesYBuscar(page, mes, patrones) {
    const resp = esperarAjax(page, 'files.display');
    await page.locator(`a.wpfdcategory.catlink[title="${mes}"]`).click();
    await resp;
    await page.waitForTimeout(1500);
    await page.waitForSelector('a.wpfd_downloadlink, .wpfd_list, .wpfd-pagination', { timeout: 25000 }).catch(() => {});
    return buscarEnlace(page, patrones);
}

// Busca un enlace cuyo título o texto coincida con alguno de los patrones (con paginación).
async function buscarEnlace(page, patrones) {
    let paginas = 1;
    while (true) {
        const links = page.locator('a.wpfd_downloadlink');
        const n = await links.count();
        for (let i = 0; i < n; i++) {
            const el = links.nth(i);
            const title = (await el.getAttribute('title')) || '';
            const text = (await el.textContent()) || '';
            if (patrones.some(p => title.toLowerCase().includes(p.toLowerCase()) || text.toLowerCase().includes(p.toLowerCase()))) {
                return el;
            }
        }
        const next = page.locator('a.next.page-numbers, a.page-numbers[rel="next"]');
        if (await next.count() > 0) {
            await next.first().click();
            await page.waitForTimeout(2000);
            paginas++;
        } else {
            break;
        }
    }
    return null;
}

/*
 * Navega el árbol año -> mes y descarga el informe.
 * devuelve { ok, link } donde link es null si no encontró el archivo.
 * Si el mes esperado no está listado, intenta buscar el archivo en los demás meses visibles.
 */
async function descargarDesdeSitio(page, anio, mesNombre, patrones) {
    await abrirAnio(page, anio);

    const mesesVisibles = await titulosCategorias(page);
    const candidatos = mesesVisibles.includes(mesNombre) ? [mesNombre] : mesesVisibles;

    if (candidatos.length === 0) {
        throw new Error(`No se listó ningún mes para ${anio}. Categorías: ${mesesVisibles.join(', ') || 'ninguna'}`);
    }

    if (!mesesVisibles.includes(mesNombre)) {
        console.log(`   Aviso: no se encontró el mes "${mesNombre}". Probando ${candidatos.length} meses visibles...`);
    }

    for (const mes of candidatos) {
        try {
            await volverAListaMeses(page);
        } catch {}
        const link = await abrirMesYBuscar(page, mes, patrones).catch(err => {
            console.log(`   ${mes}: ${err.message.split('\n')[0]}`);
            return null;
        });
        if (link) return { ok: true, link };
    }
    return { ok: false, link: null };
}

async function descargarInforme(fechaEspecifica = null) {
    const [anio, mesNum, diaNum] = fechaEspecifica
        ? fechaEspecifica.split('-').map(Number)
        : (() => { const n = new Date(); return [n.getFullYear(), n.getMonth() + 1, n.getDate()]; })();
    const mesNombre = meses[mesNum - 1];
    const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
    const formatoFecha = `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${String(anio).slice(-2)}`;
    const patrones = [formatoFecha, `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${anio}`];

    asegurarDebug();
    console.log(`\n--- Iniciando descarga para: ${fechaEspecifica || 'Hoy'} ---`);
    console.log(`Buscando año: ${anio} y mes: ${mesCapitalizado}...`);

    let ultimoError = null;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        console.log(`\n[Intento ${intento}/${MAX_INTENTOS}]`);
        const browser = await chromium.launch({
            headless: true,
            // --no-sandbox: necesario en algunos runners de CI (root/entornos sin sandbox)
            // --disable-dev-shm-usage: evita problemas de /dev/shm en contenedores Linux
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
        });
        const ctx = await browser.newContext({
            locale: 'es-MX',
            userAgent: UA,
            viewport: { width: 1280, height: 900 }
        });
        const page = await ctx.newPage();

        const fallosRed = [];
        page.on('requestfailed', r => {
            if (r.url().includes('admin-ajax.php') || r.url().includes('wpdmdl')) {
                fallosRed.push(r.url());
            }
        });

        try {
            const resultado = await descargarDesdeSitio(page, anio, mesCapitalizado, patrones);
            if (!resultado.ok) {
                console.log(`No se encontró informe para la fecha: ${formatoFecha}`);
                await ctx.close();
                return false;
            }

            const link = resultado.link;
            const title = (await link.getAttribute('title')) || '';
            console.log(`Descargando: ${title}`);

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 30000 }),
                link.click()
            ]);
            const baseDir = path.join(process.cwd(), 'data');
            const folderPath = path.join(baseDir, String(anio));
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            const fileName = `INFORME-${formatoFecha}-PRESAS.pdf`;
            await download.saveAs(path.join(folderPath, fileName));
            console.log(`Guardado en: ${path.join('data', String(anio), fileName)}`);
            await ctx.close();
            return true;
        } catch (err) {
            ultimoError = err;
            console.error(`   Error: ${err.message}`);

            // Diagnóstico para depurar en CI (se sube como artefacto en el workflow)
            const debugBase = nombreArchivoDebug(anio, mesNum, diaNum, intento, '');
            const cat = await titulosCategorias(page);
            fs.writeFileSync(
                `${debugBase}json`,
                JSON.stringify({ error: err.message, mesBuscado: mesCapitalizado, categoriasVisibles: cat, fallosRed: fallosRed.slice(0, 25) }, null, 2)
            );
            await page.screenshot({ path: `${debugBase}png`, fullPage: false }).catch(() => {});
            console.log(`   Diagnóstico guardado en data/debug/`);
        } finally {
            await browser.close();
        }
    }

    console.error(`No se pudo descargar tras ${MAX_INTENTOS} intentos. Último error: ${ultimoError?.message || 'desconocido'}`);
    return false;
}

const fechaParam = process.argv[2];
descargarInforme(fechaParam).then(ok => process.exit(ok ? 0 : 1));