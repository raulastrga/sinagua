const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function descargarInforme(fechaEspecifica = null) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log(`\n--- Iniciando descarga para: ${fechaEspecifica || 'Hoy'} ---`);
        await page.goto('https://cidh.org.mx/almacenamiento-de-presas/', { waitUntil: 'domcontentloaded' });

        const fecha = fechaEspecifica ? new Date(fechaEspecifica) : new Date();
        const anio = fecha.getFullYear().toString();
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const mesNombre = meses[fecha.getMonth()];
        const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

        console.log(`Buscando año: ${anio} y mes: ${mesCapitalizado}...`);

        // 1. Seleccionar Año
        const anioLink = page.locator(`a.wpfdcategory.catlink[title="${anio}"]`);
        await anioLink.waitFor({ state: 'visible', timeout: 10000 });
        await anioLink.click();
        await page.waitForTimeout(2000);

        // 2. Seleccionar Mes
        const mesLink = page.locator(`a.wpfdcategory.catlink[title="${mesCapitalizado}"]`);
        await mesLink.waitFor({ state: 'visible', timeout: 10000 });
        await mesLink.click();
        await page.waitForSelector('.wpfd_list, .file.pdf', { timeout: 10000 });

        // 3. Buscar archivo por patrón de fecha (versátil)
        const diaStr = String(fecha.getDate()).padStart(2, '0');
        const mesStr = String(fecha.getMonth() + 1).padStart(2, '0');
        const anioShort = String(fecha.getFullYear()).slice(-2);
        const anioLong = String(fecha.getFullYear());
        
        // Patrones comunes observados
        const patrones = [
            `${diaStr}-${mesStr}-${anioShort}`,
            `${diaStr}-${mesStr}-${anioLong}`
        ];
        
        let link = null;
        for (const p of patrones) {
            const found = page.locator(`a.wpfd_downloadlink[title*="${p}"]`).first();
            if (await found.count() > 0) {
                link = found;
                break;
            }
        }

        if (link) {
            const title = await link.getAttribute('title');
            console.log(`Descargando: ${title}`);
            
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                link.click()
            ]);

            // --- NUEVA LÓGICA DE CARPETAS ---
            const baseDir = path.join(__dirname, 'data');
            const folderPath = path.join(baseDir, anio);
            
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            const fileName = `INFORME-${diaStr}-${mesStr}-${anioShort}-PRESAS.pdf`;
            await download.saveAs(path.join(folderPath, fileName));
            console.log(`Guardado en: ${path.join('data', anio, fileName)}`);
        } else {
            console.log(`No se encontró informe para la fecha: ${diaStr}-${mesStr}-${anioShort}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

const fechaParam = process.argv[2];
descargarInforme(fechaParam);