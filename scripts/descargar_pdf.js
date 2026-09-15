const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL_SITIO = 'https://cidh.org.mx/almacenamiento-de-presas/';
const DEBUG_DIR = path.join(process.cwd(), 'data', 'debug');
const MAX_INTENTOS = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Configurable: omitir sábados (6) y domingos (0)
const OMITIR_FINES_SEMANA = true;

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function asegurarDebug() { fs.mkdirSync(DEBUG_DIR, { recursive: true }); }
function nombreArchivoDebug(anio, mesNum, diaNum, intento, ext) {
    return path.join(DEBUG_DIR, `${anio}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}-intento${intento}.${ext}`);
}

async function esperarAjax(page, cadena) {
    return page.waitForResponse(r => r.url().includes('admin-ajax.php') && r.url().includes(cadena), { timeout: 90000 }).catch(() => null);
}

async function obtenerMesesVisibles(page) {
    return page.$$eval('a.wpfdcategory.catlink', links =>
        links.map(a => a.textContent.trim())
             .filter(t => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].includes(t))
    ).catch(() => []);
}

async function volverAListaMeses(page) {
    const back = page.locator('a.backcategory');
    if (await back.count() > 0) {
        const resp = esperarAjax(page, 'categories.display');
        await back.first().click({ force: true });
        await Promise.race([resp, new Promise(r => setTimeout(r, 15000))]);
    }
}

async function buscarEnMes(page, patrones) {
    for (let pag = 1; pag <= 5; pag++) {
        const links = page.locator('a.wpfd_downloadlink');
        const n = await links.count();
        for (let i = 0; i < n; i++) {
            const el = links.nth(i);
            const title = (await el.getAttribute('title')) || '';
            if (patrones.some(p => title.toLowerCase().includes(p.toLowerCase()))) {
                const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 60000 }),
                    el.click({ force: true })
                ]);
                return download;
            }
        }
        const next = page.locator('a.next.page-numbers');
        if (await next.count() > 0) { await next.first().click({ force: true }); await page.waitForTimeout(2000); }
        else break;
    }
    return null;
}

async function descargarInforme(fechaEspecifica = null) {
    const [anio, mesNum, diaNum] = fechaEspecifica ? fechaEspecifica.split('-').map(Number) : (() => { const n = new Date(); return [n.getFullYear(), n.getMonth() + 1, n.getDate()]; })();
    
    // Verificar fin de semana si está habilitado
    if (OMITIR_FINES_SEMANA) {
        const diaSemana = new Date(anio, mesNum - 1, diaNum).getDay(); // 0=Dom, 6=Sáb
        if (diaSemana === 0 || diaSemana === 6) {
            console.log(`   Día ${fechaEspecifica} es fin de semana (${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][diaSemana]}). Omitiendo descarga.`);
            return false; // No es error, es omitido intencionalmente
        }
    }

    const mesNombre = meses[mesNum - 1];
    const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
    const formatoFecha = `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${String(anio).slice(-2)}`;
    const patrones = [formatoFecha, `${String(diaNum).padStart(2, '0')}-${String(mesNum).padStart(2, '0')}-${anio}`];

    asegurarDebug();
    console.log(`\n--- Iniciando descarga para: ${fechaEspecifica || 'Hoy'} ---`);
    console.log(`Buscando año: ${anio} y mes: ${mesCapitalizado}...`);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        console.log(`\n[Intento ${intento}/${MAX_INTENTOS}]`);
        let browser, ctx, page;
        try {
            browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
            ctx = await browser.newContext({ locale: 'es-MX', userAgent: UA, viewport: { width: 1280, height: 900 } });
            page = await ctx.newPage();

            await page.goto(URL_SITIO, { waitUntil: 'domcontentloaded', timeout: 90000 });
            
            // 1. Abrir Año
            const anioBtn = page.locator(`a.wpfdcategory.catlink[title="${anio}"]`);
            await anioBtn.waitFor({ state: 'visible', timeout: 60000 });
            const respAnio = esperarAjax(page, 'categories.display');
            await anioBtn.click({ force: true });
            await respAnio;
            await page.waitForTimeout(3000);

            // 2. Click directo al mes objetivo (sin iterar todos)
            console.log(`   Probando mes: ${mesCapitalizado}...`);
            
            // Click via evaluate - evita timeouts de locator
            await page.evaluate(t => {
                const el = document.querySelector(`a.wpfdcategory.catlink[title="${t}"]`);
                if (el) el.click();
            }, mesCapitalizado);

            // Espera NO bloqueante a la respuesta AJAX
            await Promise.race([
                esperarAjax(page, 'files.display'),
                new Promise(r => setTimeout(r, 30000))
            ]);
            await page.waitForTimeout(3000);

            // 3. Buscar archivo en ese mes
            const download = await buscarEnMes(page, patrones);
            if (download) {
                const folder = path.join(process.cwd(), 'data', String(anio));
                if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
                await download.saveAs(path.join(folder, `INFORME-${formatoFecha}-PRESAS.pdf`));
                console.log(`   ✓ Guardado`);
                await browser.close();
                return true;
            }
            
            throw new Error('Archivo no encontrado en el mes indicado');
        } catch (err) {
            console.error(`   Error intento ${intento}: ${err.message}`);
            if (page && !page.isClosed()) {
                await page.screenshot({ path: nombreArchivoDebug(anio, mesNum, diaNum, intento, 'png'), fullPage: true }).catch(() => {});
                const mesesV = await obtenerMesesVisibles(page).catch(() => []);
                fs.writeFileSync(nombreArchivoDebug(anio, mesNum, diaNum, intento, 'json'),
                    JSON.stringify({ error: err.message, mesEsperado: mesCapitalizado, mesesVisibles: mesesV }, null, 2));
            }
            if (browser && browser.isConnected()) await browser.close();
        }
    }
    return false;
}

async function buscarEnMes(page, patrones) {
    for (let pag = 1; pag <= 5; pag++) {
        const links = page.locator('a.wpfd_downloadlink');
        const n = await links.count();
        for (let i = 0; i < n; i++) {
            const el = links.nth(i);
            const title = (await el.getAttribute('title')) || '';
            if (patrones.some(p => title.toLowerCase().includes(p.toLowerCase()))) {
                const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 60000 }),
                    el.click({ force: true })
                ]);
                return download;
            }
        }
        const next = page.locator('a.next.page-numbers');
        if (await next.count() > 0) { await next.first().click({ force: true }); await page.waitForTimeout(2000); }
        else break;
    }
    return null;
}

const fechaParam = process.argv[2];
descargarInforme(fechaParam).then(ok => process.exit(ok ? 0 : 1));