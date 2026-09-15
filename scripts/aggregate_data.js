const fs = require('fs');
const path = require('path');
const {
    MIN_PRESAS_SINALOA,
    PRESAS_POR_SLUG,
    ALIASES_NOMBRES,
    slugFromNombre,
    parseNum,
    nombreCanonico,
    leerDatosCrudos
} = require('./constantes');

const inputDir = path.join(__dirname, '..', 'json');
const outputData = path.join(__dirname, '..', 'src/data/data.json');
const outputPresas = path.join(__dirname, '..', 'src/data/presas.json');

const round2 = (v) => (v === null || v === undefined) ? null : Math.round(v * 100) / 100;

function daysBetween(from, to) {
    return Math.round((new Date(to) - new Date(from)) / 86400000);
}

function agregar() {
    const raw = leerDatosCrudos(inputDir);
    const fechas = Object.keys(raw).sort();
    if (fechas.length === 0) {
        console.error('  No hay datos en json/ para agregar.');
        process.exit(1);
    }
    console.log(`Leyendo ${fechas.length} fechas desde json/`);

    const porFecha = {};   // fecha -> { slug: registroNormalizado }
    const dam = {};        // slug -> acumuladores (metadatos + cobertura)

    // 1) Normalización por fecha y validación de coherencia
    fechas.forEach(date => {
        const mapa = {};
        raw[date].forEach(r => {
            const slug = slugFromNombre(r.nombre);
            if (!slug) return;

            const reg = {
                capacidadConservacion: parseNum(r.capacidadConservacion),
                elevacionConservacion: parseNum(r.elevacionConservacion),
                capacidadNamo: parseNum(r.capacidadNamo),
                elevacionNamo: parseNum(r.elevacionNamo),
                almacenamientoMm3: parseNum(r.almacenamientoActualMm3),
                porcentaje: parseNum(r.porcentaje),
                nombreOriginal: r.nombre
            };

            // EDA 10.2: validar que porcentaje ≈ almacenamiento / NAMO * 100
            const calc = (reg.almacenamientoMm3 != null && reg.capacidadNamo > 0)
                ? (reg.almacenamientoMm3 / reg.capacidadNamo) * 100
                : null;
            if (reg.porcentaje != null && calc != null && Math.abs(reg.porcentaje - calc) > 0.5) {
                console.warn(`  [incoherente] ${date} ${nombreCanonico(slug)}: porcentaje=${reg.porcentaje} vs almacenamiento/NAMO=${calc.toFixed(2)}`);
                reg.incoherente = true;
            }

            mapa[slug] = reg;
        });
        porFecha[date] = mapa;

        // Metadatos y cobertura (única pasada, fechas ya ordenadas → el último valor no-nulo gana)
        Object.entries(mapa).forEach(([slug, reg]) => {
            if (!dam[slug]) {
                dam[slug] = { slug, nombre: nombreCanonico(slug), fechas: [], capCons: null, elevCons: null, capNamo: null, elevNamo: null, sobreNamo: 0 };
            }
            const d = dam[slug];
            d.fechas.push(date);
            if (reg.capacidadConservacion != null) d.capCons = reg.capacidadConservacion;
            if (reg.elevacionConservacion != null) d.elevCons = reg.elevacionConservacion;
            if (reg.capacidadNamo != null) d.capNamo = reg.capacidadNamo;
            if (reg.elevacionNamo != null) d.elevNamo = reg.elevacionNamo;
            if (reg.porcentaje != null && reg.porcentaje > 100) d.sobreNamo++;
        });
    });

    // 2) Construcción de periodos (series dinámicas)
    const periodos = fechas.map(date => {
        const mapa = porFecha[date];
        const presas = Object.entries(mapa).map(([slug, reg]) => {
            const rec = {
                id: slug,
                almacenamientoMm3: round2(reg.almacenamientoMm3),
                porcentaje: round2(reg.porcentaje)
            };
            if (reg.incoherente) {
                // El registro se documenta como «sin dato» en el front-end
                rec.almacenamientoMm3 = null;
                rec.porcentaje = null;
                rec.flag = 'incoherente';
            }
            rec.sobreNamo = rec.porcentaje != null && rec.porcentaje > 100;
            return rec;
        });

        // Promedio estatal ponderado por capacidad NAMO, con umbral mínimo de presas
        let promedio = null;
        const sinaloa = presas.filter(rec => {
            const cat = PRESAS_POR_SLUG[rec.id];
            return cat && cat.sinaloa && !rec.flag;
        });
        const conCapacidad = sinaloa.filter(rec => rec.almacenamientoMm3 != null && (dam[rec.id].capNamo || 0) > 0);
        if (conCapacidad.length >= MIN_PRESAS_SINALOA) {
            const sumAlmacenamiento = conCapacidad.reduce((a, r) => a + r.almacenamientoMm3, 0);
            const sumCapacidad = conCapacidad.reduce((a, r) => a + dam[r.id].capNamo, 0);
            promedio = sumCapacidad > 0 ? round2((sumAlmacenamiento / sumCapacidad) * 100) : null;
        }

        const periodo = { fecha: date, promedio: promedio === null ? null : promedio };
        periodo.presas = presas;
        return periodo;
    });

    const globalDesde = fechas[0];
    const globalHasta = fechas[fechas.length - 1];

    // 3) Metadatos estáticos por presa (cobertura + capacidades + ubicación)
    const presas = Object.keys(dam)
        .sort((a, b) => dam[a].nombre.localeCompare(dam[b].nombre, 'es'))
        .map(slug => {
            const d = dam[slug];
            const cat = PRESAS_POR_SLUG[slug] || null;
            const desde = d.fechas[0];
            const hasta = d.fechas[d.fechas.length - 1];
            const diasDelPeriodo = daysBetween(desde, hasta) + 1;
            return {
                id: slug,
                nombre: d.nombre,
                alias: ALIASES_NOMBRES[slug] || [],
                lat: cat ? cat.lat : null,
                lon: cat ? cat.lon : null,
                capacidadConservacion: round2(d.capCons),
                elevacionConservacion: round2(d.elevCons),
                capacidadNamo: round2(d.capNamo),
                elevacionNamo: round2(d.elevNamo),
                sinaloa: cat ? cat.sinaloa : true,
                desde,
                hasta,
                diasConDato: d.fechas.length,
                diasDelPeriodo,
                continuidad: diasDelPeriodo > 0 ? Math.round((d.fechas.length / diasDelPeriodo) * 100) / 100 : 0,
                sobreNamo: d.sobreNamo
            };
        });

    const dataOut = {
        version: 2,
        generado: new Date().toISOString(),
        desde: globalDesde,
        hasta: globalHasta,
        minPresasSinaloa: MIN_PRESAS_SINALOA,
        periodos
    };

    const presasOut = {
        version: 2,
        generado: new Date().toISOString(),
        presas
    };

    fs.writeFileSync(outputData, JSON.stringify(dataOut));
    fs.writeFileSync(outputPresas, JSON.stringify(presasOut));

    const dataBytes = fs.statSync(outputData).size;
    const presasBytes = fs.statSync(outputPresas).size;
    console.log(`\nGenerados:`);
    console.log(`  ${outputData}  (${(dataBytes / 1024).toFixed(1)} KB, ${periodos.length} periodos, ${periodos.reduce((a, p) => a + p.presas.length, 0)} registros)`);
    console.log(`  ${outputPresas}  (${(presasBytes / 1024).toFixed(1)} KB, ${presas.length} presas)`);
    console.log(`\nResumen de presas:`);
    presas.forEach(p => {
        console.log(`  ${p.id.padEnd(28)} ${String(p.capacidadNamo ?? '-').padStart(8)} NAMO  dias=${String(p.diasConDato).padStart(4)}  ${p.desde} → ${p.hasta}  cont=${p.continuidad}`);
    });
}

agregar();