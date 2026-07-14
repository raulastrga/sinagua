const fs = require('fs');
const path = require('path');

async function extraerTexto() {
    // Dynamic import for ESM module
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const rutaPDF = path.resolve(__dirname, 'INFORME-13-07-26-PRESAS.pdf');
    const data = new Uint8Array(fs.readFileSync(rutaPDF));

    // Cargar el documento
    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;

    let textoCompleto = '';

    // Iterar sobre todas las páginas
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        
        // Unir las líneas de texto
        const strings = content.items.map(item => item.str);
        textoCompleto += strings.join(' ') + '\n';
    }

    fs.writeFileSync('texto_extraido_robusto.txt', textoCompleto);
    console.log("Éxito: Texto extraído en 'texto_extraido_robusto.txt'");
}

extraerTexto().catch(err => console.error(err));