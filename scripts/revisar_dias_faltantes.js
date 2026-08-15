const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// Script de recuperación: revisa src/data/data.json y detecta
// los días faltantes del mes anterior para intentar recuperarlos.
// ============================================================

// 1. Leer fechas existentes en data.json
const dataJsonPath = path.join(process.cwd(), 'src/data/data.json');
if (!fs.existsSync(dataJsonPath)) {
    console.error('No se encontró src/data/data.json');
    process.exit(1);
}

const dataJson = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
const existingDates = new Set(Object.keys(dataJson));
console.log(`Fechas existentes en data.json: ${existingDates.size}`);

// 2. Determinar el mes anterior a la fecha de ejecución
const now = new Date();
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const year = prevMonth.getFullYear();
const month = prevMonth.getMonth();
const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;

function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
}

// 3. Generar todos los días del mes anterior y detectar faltantes
const allDays = [];
const totalDays = daysInMonth(year, month);
for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!existingDates.has(dateStr)) {
        allDays.push(dateStr);
    }
}

console.log(`\nMes a analizar: ${monthLabel} (${totalDays} días)`);
console.log(`Días faltantes encontrados: ${allDays.length}`);

if (allDays.length === 0) {
    console.log('\nNo hay días faltantes. Finalizando.');
    process.exit(0);
}

console.log(`Días faltantes: ${allDays.join(', ')}\n`);

// 4. Intentar recuperar cada día faltante con el pipeline
let recuperados = 0;
for (const date of allDays) {
    console.log(`\n--- Procesando día faltante: ${date} ---`);
    try {
        // Descargar el PDF para la fecha específica
        execSync(`node scripts/descargar_pdf.js "${date}"`, { stdio: 'inherit' });
        // Extraer el texto del PDF
        execSync(`node scripts/extraer_texto_robusto.js "${date}"`, { stdio: 'inherit' });
        recuperados++;
    } catch (error) {
        console.log(`No se pudo recuperar el día ${date}: ${error.message}`);
    }
}

console.log(`\n=== Días recuperados: ${recuperados} de ${allDays.length} ===`);

// 5. Convertir los textos recuperados a JSON (procesa todos los docs del año)
console.log('\n--- Convirtiendo textos a JSON ---');
try {
    execSync('node scripts/convertir_a_json_2026.js', { stdio: 'inherit' });
} catch (error) {
    console.log(`Error al convertir: ${error.message}`);
}

// 6. Regenerar data.json consolidado
console.log('\n--- Regenerando data.json ---');
try {
    execSync('node scripts/aggregate_data.js', { stdio: 'inherit' });
} catch (error) {
    console.log(`Error al agregar: ${error.message}`);
}

console.log('\nProceso de revisión mensual completado.');
