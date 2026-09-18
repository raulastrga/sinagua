const fs = require('fs');
const path = require('path');

// Dynamic import for ESM module
async function getPdfjs() {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function extraerTextoClima(fechaParam = null) {
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
    const anioLongStr = String(anioLong);
    
    const nombreArchivo = `BOLETIN-${diaStr}-${mesStr}-${anioLongStr}.pdf`;
    const rutaPDF = path.resolve(process.cwd(), 'data', 'clima', anioLongStr, nombreArchivo);

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

    const docsDir = path.join(process.cwd(), 'docs', 'clima', anioLongStr);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const txtFileName = `texto-${diaStr}-${mesStr}-${anioLongStr}.txt`;
    fs.writeFileSync(path.join(docsDir, txtFileName), textoCompleto);
    console.log(`Éxito: Texto extraído en '${path.join('docs', 'clima', anioLongStr, txtFileName)}'`);
}

const fechaParam = process.argv[2];
extraerTextoClima(fechaParam).catch(err => console.error(err));
