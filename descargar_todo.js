const { execSync } = require('child_process');

function obtenerFechasDesde2019() {
    const fechas = [];
    const inicio = new Date('2023-01-15');
    const fin = new Date(); // Hoy

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        fechas.push(d.toISOString().split('T')[0]);
    }
    return fechas;
}

const todasLasFechas = obtenerFechasDesde2019();

console.log(`Se procesarán ${todasLasFechas.length} días.`);

for (const fecha of todasLasFechas) {
    console.log(`\nEjecutando para: ${fecha}`);
    try {
        // Ejecuta el script de descarga de forma sincrónica
        execSync(`node descargar_pdf.js ${fecha}`, { stdio: 'inherit' });
        
        // Timeout para evitar bloqueo por abuso (10 segundos)
        /* console.log("Esperando 10 segundos para la siguiente petición...");
        execSync('sleep 10'); */
    } catch (error) {
        console.error(`Error procesando ${fecha}:`, error.message);
    }
}

console.log('\nProceso de descarga masiva finalizado.');