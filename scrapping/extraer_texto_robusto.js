const fs = require('fs');
const path = require('path');

// Dynamic import for ESM module (pdfjs-dist is ESM)
async function getPdfjs() {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function extraerTexto(fechaParam = null) {
    const pdfjsLib = await getPdfjs();
    const fecha = fechaParam ? new Date(fechaParam) : new Date();
    
    const diaStr = String(fecha.getDate()).padStart(2, '0');
    const mesStr = String(fecha.getMonth() + 1).padStart(2, '0');
    const anioShort = String(fecha.getFullYear()).slice(-2);
    const anioLong = String(fecha.getFullYear());
    
    const nombreArchivo = `INFORME-${diaStr}-${mesStr}-${anioShort}-PRESAS.pdf`;
    const rutaPDF = path.resolve(__dirname, 'data', anioLong, nombreArchivo);

    if (!fs.existsSync(rutaPDF)) {
        console.log(`Archivo no encontrado: ${rutaPDF}`);
        return;
    }

    console.log(`Extrayendo texto de: ${nombreArchivo}...`);
    const data = new Uint8Array(fs.readFileSync(rutaPDF));
    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;

    let textoCompleto = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        textoCompleto += strings.join(' ') + '\n';
    }

    const docsDir = path.join(__dirname, 'docs', anioLong);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const txtFileName = `texto-${diaStr}-${mesStr}-${anioShort}.txt`;
    fs.writeFileSync(path.join(docsDir, txtFileName), textoCompleto);
    console.log(`Éxito: Texto extraído en '${path.join('docs', anioLong, txtFileName)}'`);
}

const fechaParam = process.argv[2];
extraerTexto(fechaParam).catch(err => console.error(err));