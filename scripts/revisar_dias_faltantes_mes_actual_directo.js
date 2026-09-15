const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { fechasEnDataJson } = require('./constantes');
const { descargarInforme } = require('./descargar_pdf_directo');

// ============================================================
// Copia de revisar_dias_faltantes_mes_actual.js que usa
// descargar_pdf_directo.js (sin Playwright): detecta los días
// faltantes del mes actual y los recupera consumiendo directo
// el AJAX público del plugin WP File Download.
// ============================================================

const dataJsonPath = path.join(process.cwd(), 'src/data/data.json');
if (!fs.existsSync(dataJsonPath)) {
    console.error('No se encontró src/data/data.json');
    process.exit(1);
}

const existingDates = new Set(fechasEnDataJson(dataJsonPath));
console.log(`Fechas existentes en data.json: ${existingDates.size}`);

const now = new Date();
const month_ = new Date(now.getFullYear(), now.getMonth(), 1);
const year = month_.getFullYear();
const month = month_.getMonth();
const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;

function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
}

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
const allDays = [];
let diasFuturos = 0;
const totalDays = daysInMonth(year, month);
for (let d = 1; d <= totalDays; d++) {
    const fecha = new Date(year, month, d);
    if (fecha > hoy) {
        diasFuturos++;
        continue;
    }
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!existingDates.has(dateStr)) {
        allDays.push(dateStr);
    }
}

console.log(`\nMes a analizar: ${monthLabel} (${totalDays} días)`);
console.log(`Días faltantes encontrados: ${allDays.length}${diasFuturos > 0 ? ` (${diasFuturos} días futuros omitidos)` : ''}`);

if (allDays.length === 0) {
    console.log('\nNo hay días faltantes. Finalizando.');
    process.exit(0);
}

console.log(`Días faltantes: ${allDays.join(', ')}\n`);

function rutaPdfDeFecha(date) {
    const [a, m, d] = date.split('-');
    return path.join(process.cwd(), 'data', a, `INFORME-${d}-${m}-${a.slice(2)}-PRESAS.pdf`);
}

async function main() {
    let recuperados = 0;
    const fallidos = [];
    for (const date of allDays) {
        console.log(`\n--- Procesando día faltante: ${date} ---`);
        try {
            const ok = await descargarInforme(date);
            if (!ok) {
                fallidos.push(date);
                console.log(`Día ${date}: no se pudo recuperar el PDF`);
                continue;
            }
            execSync(`node scripts/extraer_texto_robusto.js "${date}"`, { stdio: 'inherit' });
            if (fs.existsSync(rutaPdfDeFecha(date))) {
                recuperados++;
            } else {
                fallidos.push(date);
                console.log(`Día ${date}: no se encontró el PDF`);
            }
        } catch (error) {
            fallidos.push(date);
            console.log(`No se pudo recuperar el día ${date}: ${error.message}`);
        }
    }

    console.log(`\n=== Días recuperados: ${recuperados} de ${allDays.length} ===`);
    if (fallidos.length > 0) console.log(`Días no recuperados: ${fallidos.join(', ')}`);

    console.log('\n--- Convirtiendo textos a JSON ---');
    try {
        execSync('node scripts/convertir_a_json_2026.js', { stdio: 'inherit' });
    } catch (error) {
        console.log(`Error al convertir: ${error.message}`);
    }

    console.log('\n--- Regenerando data.json ---');
    try {
        execSync('node scripts/aggregate_data.js', { stdio: 'inherit' });
    } catch (error) {
        console.log(`Error al agregar: ${error.message}`);
    }

    console.log('\nProceso de revisión mensual completado.');
}

main().catch(err => { console.error(err); process.exit(1); });