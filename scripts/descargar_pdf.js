const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL_SITIO = 'https://cidh.org.mx/almacenamiento-de-presas/';
const DEBUG_DIR = path.join(process.cwd(), 'data', 'debug');
const MAX_INTENTOS = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function asegurarDebug() { fs.mkdirSync(DEBUG_DIR, { recursive: true }); }
function nombreArchivoDebug(anio, mesNum, diaNum, intento, ext) {
    return path.join(DEBUG_DIR, `${anio}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}-intento${intento}.${ext}`);
}

async function esperarAjax(page, cadena) {
    return page.waitForResponse(r => r.url().includes('admin-ajax.php') && r.url().includes(cadena), { timeout: 60000 }).catch(() => null);
}

async function titulosCategorias(page) {
    return page.$$eval('a.wpfdcategory.catlink', links => links.map(a => a.textContent.trim()));
}

async function volverAListaMeses(page) {
    const back = page.locator('a.backcategory');
    if (await back.count() > 0) {
        const resp = esperarAjax(page, 'categories.display');
        await back.first().click();
        await resp;
    }
}

async function descargarInforme(fechaEspecifica = null) {
    const [anio, mesNum, diaNum] = fechaEspecifica ? fechaEspecifica.split('-').map(Number) : (() => { const n = new Date(); return [n.getFullYear(), n.getMonth() + 1, n.getDate()]; })();
    const mesNombre = meses[mesNum - 1];
    const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
    const formatoFecha = `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${String(anio).slice(-2)}`;
    const patrones = [formatoFecha, `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${anio}`];

    asegurarDebug();
    console.log(`\n--- Iniciando descarga para: ${fechaEspecifica || 'Hoy'} ---`);
    console.log(`Buscando año: ${anio} y mes: ${mesCapitalizado}...`);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        console.log(`\n[Intento ${intento}/${MAX_INTENTOS}]`);
        const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const ctx = await browser.newContext({ locale: 'es-MX', userAgent: UA, viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();

        try {
            await page.goto(URL_SITIO, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // 1. Clic Año
            const anioBtn = page.locator(`a.wpfdcategory.catlink[title="${anio}"]`);
            await anioBtn.waitFor({ state: 'visible', timeout: 30000 });
            const respAnio = esperarAjax(page, 'categories.display');
            await anioBtn.click();
            await respAnio;
            await page.waitForTimeout(2000);

            // 2. Clic Mes (sin waitFor, directo a buscar el elemento)
            const mesBtn = page.locator(`a.wpfdcategory.catlink[title="${mesCapitalizado}"]`);
            // Espera a que el elemento sea realmente clickeable
            await mesBtn.waitFor({ state: 'attached', timeout: 30000 });
            await mesBtn.scrollIntoViewIfNeeded();
            
            const respMes = esperarAjax(page, 'files.display');
            await mesBtn.click({ force: true });
            await respMes;
            await page.waitForTimeout(2000);

            // 3. Buscar archivo
            while (true) {
                const links = page.locator('a.wpfd_downloadlink');
                const n = await links.count();
                for (let i = 0; i < n; i++) {
                    const el = links.nth(i);
                    const title = (await el.getAttribute('title')) || '';
                    if (patrones.some(p => title.toLowerCase().includes(p.toLowerCase()))) {
                        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), el.click()]);
                        const folder = path.join(process.cwd(), 'data', String(anio));
                        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
                        await download.saveAs(path.join(folder, `INFORME-${formatoFecha}-PRESAS.pdf`));
                        console.log(`Guardado!`);
                        await browser.close();
                        return true;
                    }
                }
                const next = page.locator('a.next.page-numbers');
                if (await next.count() > 0) { await next.first().click(); await page.waitForTimeout(2000); }
                else break;
            }
            throw new Error('Archivo no encontrado');
        } catch (err) {
            console.error(`   Error: ${err.message}`);
            await page.screenshot({ path: nombreArchivoDebug(anio, mesNum, diaNum, intento, 'png') });
            await browser.close();
        }
    }
    return false;
}

const fechaParam = process.argv[2];
descargarInforme(fechaParam).then(ok => process.exit(ok ? 0 : 1));
