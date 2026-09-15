const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Navega al árbol: año -> mes, esperando las respuestas AJAX reales de wpfd
// en lugar de sleep's fijos, con reintentos por si el tráfico es lento.
async function navegarHastaMes(page, anio, mesNombre) {
    const esperarResponse = (contains) => page.waitForResponse(
        r => r.url().includes('admin-ajax.php') && r.url().includes(contains),
        { timeout: 90000 }
    ).catch(() => {});

    for (let intento = 1; intento <= 3; intento++) {
        try {
            // 1. Seleccionar Año
            const anioLink = page.locator(`a.wpfdcategory.catlink[title="${anio}"]`);
            await anioLink.waitFor({ state: 'visible', timeout: 60000 });

            const categoriasListas = esperarResponse('categories.display');
            await anioLink.click();
            await categoriasListas;

            // 2. Seleccionar Mes (los meses se renderizan tras la respuesta AJAX del año)
            const mesLink = page.locator(`a.wpfdcategory.catlink[title="${mesNombre}"]`);
            await mesLink.waitFor({ state: 'visible', timeout: 90000 });

            const archivosListos = esperarResponse('files.display');
            await mesLink.click();
            await archivosListos;
            await page.waitForTimeout(1500);

            try {
                await page.waitForSelector('.wpfd_list, .wpfd-pagination', { timeout: 30000 });
            } catch {}

            return;
        } catch (err) {
            if (intento === 3) throw err;
            console.log(`   Intento ${intento} fallido para '${mesNombre}', recargando página...`);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
        }
    }
}

async function descargarInforme(fechaEspecifica = null) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log(`\n--- Iniciando descarga para: ${fechaEspecifica || 'Hoy'} ---`);
        await page.goto('https://cidh.org.mx/almacenamiento-de-presas/', { waitUntil: 'domcontentloaded' });

        // Parsear la fecha como partes locales para evitar desfases de zona horaria
        // (new Date('YYYY-MM-DD') interpreta UTC y el mes/día pueden desplazarse).
        const [anio, mesNum, diaNum] = fechaEspecifica
            ? fechaEspecifica.split('-').map(Number)
            : (() => { const n = new Date(); return [n.getFullYear(), n.getMonth() + 1, n.getDate()]; })();
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const mesNombre = meses[mesNum - 1];
        const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

        console.log(`Buscando año: ${anio} y mes: ${mesCapitalizado}...`);
        await navegarHastaMes(page, anio, mesCapitalizado);

        const diaStr = String(diaNum).padStart(2, '0');
        const mesStr = String(mesNum).padStart(2, '0');
        const anioShort = String(anio).slice(-2);
        
        const formatoFecha = `${diaStr}-${mesStr}-${anioShort}`;
        const patrones = [formatoFecha, `${diaStr}-${mesStr}-${anio}`];
        
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
                if (patrones.some(p => title.toLowerCase().includes(p.toLowerCase()) || text.toLowerCase().includes(p.toLowerCase()))) {
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
            const folderPath = path.join(baseDir, String(anio));
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            
            const fileName = `INFORME-${formatoFecha}-PRESAS.pdf`;
            await download.saveAs(path.join(folderPath, fileName));
            console.log(`Guardado en: ${path.join('data', String(anio), fileName)}`);
            return true;
        } else {
            console.log(`No se encontró informe para la fecha: ${formatoFecha}`);
            return false;
        }

    } catch (error) {
        console.error('Error:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

const fechaParam = process.argv[2];
descargarInforme(fechaParam).then(ok => process.exit(ok ? 0 : 1));