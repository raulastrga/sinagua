const fs = require('fs');
const path = require('path');

function parsearTextoAJSON_2025(anio) {
    const carpetaDocs = path.join(__dirname, 'docs', anio);
    const carpetaJson = path.join(__dirname, 'json', anio);
    
    if (!fs.existsSync(carpetaJson)) fs.mkdirSync(carpetaJson, { recursive: true });

    if (!fs.existsSync(carpetaDocs)) {
        console.log(`Carpeta docs/${anio} no existe.`);
        return;
    }

    const archivos = fs.readdirSync(carpetaDocs).filter(f => f.endsWith('.txt'));

    // Lista de presas para 2025
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
            // Regex ajustada para 2025. Similar a 2024, manejando comas.
            const regex = new RegExp(`${nombrePresa}\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)\\s+([0-9,.]+)`, 'i');
            const match = texto.match(regex);

            if (match) {
                // Función para limpiar números (quitar comas)
                const limpiar = (val) => val.replace(/,/g, '');

                datosJSON.push({
                    nombre: nombrePresa,
                    capacidadConservacion: limpiar(match[1]),
                    elevacionConservacion: limpiar(match[2]),
                    capacidadNamo: limpiar(match[3]),
                    elevacionNamo: limpiar(match[4]),
                    almacenamientoActualMm3: limpiar(match[5]),
                    porcentaje: limpiar(match[6])
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

parsearTextoAJSON_2025('2025');