const fs = require('fs');
const path = require('path');

// Polyfills for Node.js
global.DOMMatrix = class DOMMatrix {};
global.Path2D = class Path2D {};

// Dynamic import for ESM module (pdfjs-dist is ESM)
async function getPdfjs() {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function extraerTexto(fechaParam = null) {
    const pdfjsLib = await getPdfjs();
    
    let diaNum, mesNum, anioLong;
    if (fechaParam) {
        const parts = fechaParam.split('-').map(Number);
        anioLong = parts[0];
        mesNum = parts[1];
        diaNum = parts[2];
    } else {
        const n = new Date();
        anioLong = n.getFullYear();
        mesNum = n.getMonth() + 1;
        diaNum = n.getDate();
    }
    
    const diaStr = String(diaNum).padStart(2, '0');
    const mesStr = String(mesNum).padStart(2, '0');
    const anioShort = String(anioLong).slice(-2);
    const anioLongStr = String(anioLong);
    
    const nombreArchivo = `INFORME-${diaStr}-${mesStr}-${anioShort}-PRESAS.pdf`;
    const rutaPDF = path.resolve(process.cwd(), 'data', anioLongStr, nombreArchivo);

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

    const docsDir = path.join(process.cwd(), 'docs', String(anioLong));
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const txtFileName = `texto-${diaStr}-${mesStr}-${anioShort}.txt`;
    fs.writeFileSync(path.join(docsDir, txtFileName), textoCompleto);
    console.log(`Éxito: Texto extraído en '${path.join('docs', String(anioLong), txtFileName)}'`);
}

const fechaParam = process.argv[2];
extraerTexto(fechaParam).catch(err => console.error(err));