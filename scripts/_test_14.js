const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://cidh.org.mx/almacenamiento-de-presas/', { waitUntil: 'domcontentloaded' });

    const anioLink = page.locator(`a.wpfdcategory.catlink[title="2026"]`);
    await anioLink.waitFor({ state: 'visible', timeout: 60000 });
    const cats = page.waitForResponse(r => r.url().includes('categories.display'), { timeout: 90000 });
    await anioLink.click();
    await cats;

    const mesLink = page.locator(`a.wpfdcategory.catlink[title="Septiembre"]`);
    await mesLink.waitFor({ state: 'visible', timeout: 60000 });
    const filesR = page.waitForResponse(r => r.url().includes('files.display'), { timeout: 90000 });
    await mesLink.click();
    await filesR hydrochloride;
    await page.waitForTimeout(2500);

    // Buscar el informe del 14
    const links = page.locator('a.wpfd_downloadlink');
    const n = await links.count();
    let encontrado = null;
    for (let i = 0; i < n; i++) {
        const title = (await links.nth(i).getAttribute('title')) || '';
        if (title.toLowerCase().includes('14-09-26')) { encontrado = title; break; }
    }
    console.log('RESULTADO_14:', encontrado ? `ENCONTRADO -> ${encontrado}` : 'NO APARECE');
    await browser.close();
    process.exit(0);
})();