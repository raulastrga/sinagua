const fs = require('fs');
const path = require('path');

function parsearBoletin(texto) {
    const lines = texto.split('\n');
    const datosEstaciones = [];
    let sinopsis = '';
    let pronostico = '';
    
    let enTabla = false;
    let tablaTerminada = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('ESTACIONES TEMPERATURA MÁXIMA')) {
            enTabla = true;
            continue;
        }
        
        if (enTabla) {
            if (line.includes('DATOS TERMOPLUVIOMETRICOS')) {
                enTabla = false;
                tablaTerminada = true;
                continue;
            }
            
            // Parse table row
            // Expect: Name (could be multi-word) + numbers
            const match = line.match(/(.+?)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+|INAP\.)/);
            if (match) {
                datosEstaciones.push({
                    estacion: match[1].trim(),
                    tempMax: match[2],
                    tempMin: match[3],
                    lluvia: match[4]
                });
            }
        }
        
        if (line.startsWith('SINOPSIS METEOROLOGICA:')) {
            sinopsis = line.replace('SINOPSIS METEOROLOGICA:', '').trim();
        }
        
        if (line.startsWith('PRONOSTICO DEL TIEMPO PROBABLE:')) {
            pronostico = line.replace('PRONOSTICO DEL TIEMPO PROBABLE:', '').trim();
        }
    }
    
    return { estaciones: datosEstaciones, sinopsis, pronostico };
}

function procesarCarpeta(anio) {
    const carpetaDocs = path.join(__dirname, '..', 'docs', 'clima', anio);
    const carpetaJson = path.join(__dirname, '..', 'json', 'clima', anio);

    if (!fs.existsSync(carpetaJson)) fs.mkdirSync(carpetaJson, { recursive: true });
    if (!fs.existsSync(carpetaDocs)) return;

    const archivos = fs.readdirSync(carpetaDocs).filter(f => f.endsWith('.txt'));
    archivos.forEach(archivo => {
        const texto = fs.readFileSync(path.join(carpetaDocs, archivo), 'utf8');
        const datos = parsearBoletin(texto);
        
        const fecha = archivo.replace('texto-', '').replace('.txt', '');
        const nombreJson = `datos-clima-${fecha}.json`;
        fs.writeFileSync(path.join(carpetaJson, nombreJson), JSON.stringify(datos, null, 2));
        console.log(`Generado: ${path.join('json', 'clima', anio, nombreJson)}`);
    });
}

const anio = process.argv[2] || '2026';
procesarCarpeta(anio);
