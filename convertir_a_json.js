const fs = require('fs');

function parsearTextoAJSON() {
    const texto = fs.readFileSync('texto_extraido_robusto.txt', 'utf8');
    
    // Lista de presas en el orden en que aparecen
    const listaPresas = [
        "Luis Donaldo Colosio", "Miguel Hidalgo y Costilla", "Josefa Ortiz de Domínguez", 
        "Gustavo Díaz Ordaz", "Guillermo Blake Aguilar", "Eustaquio Buelna", 
        "Adolfo López Mateos", "Sanalona", "Juan Guerrero Alcocer", "José López Portillo", 
        "Aurelio Benassini V.", "Santa Maria", "Picachos", "Santiago Bayacora", 
        "Guadalupe Victoria", "Francisco Villa", "Caboraca", "Peña del Aguila"
    ];

    const datosJSON = [];

    // Estrategia: Buscar el bloque de texto entre una presa y la siguiente
    for (let i = 0; i < listaPresas.length; i++) {
        const nombreActual = listaPresas[i];
        const nombreSiguiente = listaPresas[i + 1];

        // Crear una expresión regular que busque desde el nombre actual hasta el siguiente
        // O hasta el final del texto si es la última
        const patron = nombreSiguiente 
            ? `${nombreActual}\\s+(.*?)${nombreSiguiente}`
            : `${nombreActual}\\s+(.*?)(?=SUBTOTAL|TOTAL|DURANGO|$)`;

        const regex = new RegExp(patron, 's'); // 's' permite que el punto coincida con \n
        const match = texto.match(regex);

        if (match && match[1]) {
            // Extraemos todos los números encontrados en ese bloque
            const numeros = match[1].match(/-?\d+\.?\d*/g);
            
            if (numeros && numeros.length >= 6) {
                datosJSON.push({
                    nombre: nombreActual,
                    capacidadConservacion: numeros[0],
                    elevacionConservacion: numeros[1],
                    capacidadNamo: numeros[2],
                    elevacionNamo: numeros[3],
                    almacenamientoActualMm3: numeros[4],
                    porcentaje: numeros[5]
                });
            }
        }
    }

    fs.writeFileSync('datos_finales.json', JSON.stringify(datosJSON, null, 2));
    console.log('JSON generado correctamente en "datos_finales.json"');
}

parsearTextoAJSON();