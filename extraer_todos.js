const { execSync } = require('child_process');

function obtenerFechasDesde2019() {
    const fechas = [];
    const inicio = new Date('2019-01-01');
    const fin = new Date(); // Hoy

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        fechas.push(d.toISOString().split('T')[0]);
    }
    return fechas;
}

const todasLasFechas = obtenerFechasDesde2019();

console.log(`Se procesarán ${todasLasFechas.length} días.`);

for (const fecha of todasLasFechas) {
    console.log(`\nExtrayendo para: ${fecha}`);
    try {
        // Ejecuta el script de extracción de forma sincrónica
        execSync(`node extraer_texto_robusto.js ${fecha}`, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Error procesando ${fecha}:`, error.message);
    }
}

console.log('\nProceso de extracción masiva finalizado.');