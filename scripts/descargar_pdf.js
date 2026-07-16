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
        await page.waitForSelector('.wpfd_list, .wpfd-pagination', { timeout: 10000 });

        const diaStr = String(fecha.getDate()).padStart(2, '0');
        const mesStr = String(fecha.getMonth() + 1).padStart(2, '0');
        const anioShort = String(fecha.getFullYear()).slice(-2);
        
        const formatoFecha = `${diaStr}-${mesStr}-${anioShort}`;
        const patrones = [formatoFecha, `${diaStr}-${mesStr}-${fecha.getFullYear()}`];
        
        console.log(`Buscando informe con fecha: ${formatoFecha}`);
        
        let link = null;
        let paginas = 1;

        // Bucle de paginación
        while (true) {
            console.log(`Buscando en página ${paginas}...`);
            const todosLosEnlaces = page.locator('a.wpfd_downloadlink');
            const count = await todosLosEnlaces.count();
            
            for (let i = 0; i < count; i++) {
                const el = todosLosEnlaces.nth(i);
                const title = await el.getAttribute('title') || '';
                const text = await el.textContent() || '';
                if (patrones.some(p => title.includes(p) || text.includes(p))) {
                    link = el;
                    break;
                }
            }

            if (link) break;

            // Intentar ir a la siguiente página
            const nextButton = page.locator('a.next.page-numbers');
            if (await nextButton.count() > 0) {
                await nextButton.click();
                await page.waitForTimeout(2000); // Esperar a que cargue la nueva página
                paginas++;
            } else {
                break; // No hay más páginas
            }
        }

        if (link) {
            const title = await link.getAttribute('title');
            console.log(`Descargando: ${title}`);
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                link.click()
            ]);
            const baseDir = path.join(process.cwd(), 'data');
            const folderPath = path.join(baseDir, anio);
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            
            const fileName = `INFORME-${formatoFecha}-PRESAS.pdf`;
            await download.saveAs(path.join(folderPath, fileName));
            console.log(`Guardado en: ${path.join('data', anio, fileName)}`);
        } else {
            console.log(`No se encontró informe para la fecha: ${formatoFecha}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

const fechaParam = process.argv[2];
descargarInforme(fechaParam);