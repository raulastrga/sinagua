const fs = require('fs');
const path = require('path');

function parsearBoletin(texto) {
    const lines = texto.split('\n');
    const datosEstaciones = [];
    let sinopsis = '';
    let pronostico = '';
    
    let enTabla = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        console.log(`Testing line: ${line.slice(0, 30)}...`);

        if (line.includes('ESTACIONES TEMPERATURA MÁXIMA')) {
            console.log('Detected start of table');
            enTabla = true;
            continue;
        }
        
        if (enTabla) {
            if (line.includes('DATOS TERMOPLUVIOMETRICOS')) {
                console.log('Detected end of table');
                enTabla = false;
                continue;
            }
            
            // Debug regex
            const match = line.match(/(.+?)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+|INAP\.)/);
            console.log(`Match result for line: ${match ? 'Yes' : 'No'}`);
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

const texto = fs.readFileSync('/Users/raulastrga/Desktop/Proyectos/sinagua/docs/clima/2026/texto-14-09-2026.txt', 'utf8');
const result = parsearBoletin(texto);
console.log(JSON.stringify(result, null, 2));
