const fs = require('fs');
const path = require('path');

function parsearTextoAJSON_2026(anio) {
    const carpetaDocs = path.join(process.cwd(), 'docs', anio);
    const carpetaJson = path.join(process.cwd(), 'json', anio);
    
    if (!fs.existsSync(carpetaJson)) fs.mkdirSync(carpetaJson, { recursive: true });

    if (!fs.existsSync(carpetaDocs)) {
        console.log(`Carpeta docs/${anio} no existe.`);
        return;
    }

    const archivos = fs.readdirSync(carpetaDocs).filter(f => f.endsWith('.txt'));

    // Lista de presas para 2026
    const listaPresas = [
        "Luis Donaldo Colosio", "Miguel Hidalgo y Costilla", "Josefa Ortiz de Domínguez", 
        "Gustavo Díaz Ordaz", "Guillermo Blake Aguilar", "Eustaquio Buelna", 
        "Adolfo López Mateos", "Sanalona", "Juan Guerrero Alcocer", "José López Portillo", 
        "Aurelio Benassini V.", "Santa Maria", "Picachos"
    ];

    archivos.forEach(archivo => {
        const texto = fs.readFileSync(path.join(carpetaDocs, archivo), 'utf8');
        const datosJSON = [];

        listaPresas.forEach(nombrePresa => {
            const regex = new RegExp(`${nombrePresa}\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)`, 'i');
            const match = texto.match(regex);

            if (match) {
                datosJSON.push({
                    nombre: nombrePresa,
                    capacidadConservacion: match[1],
                    elevacionConservacion: match[2],
                    capacidadNamo: match[3],
                    elevacionNamo: match[4],
                    almacenamientoActualMm3: match[5],
                    porcentaje: match[6]
                });
            }
        });

        if (datosJSON.length > 0) {
            const fecha = archivo.replace('texto-', '').replace('.txt', '');
            const nombreJson = `datos-${fecha}.json`;
            fs.writeFileSync(path.join(carpetaJson, nombreJson), JSON.stringify(datosJSON, null, 2));
            console.log(`Generado: ${path.join('json', anio, nombreJson)}`);
        }
    });
}

parsearTextoAJSON_2026('2026');