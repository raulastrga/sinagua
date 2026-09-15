// Paleta de colores del proyecto
const COLORS = {
    primary: 'rgba(0, 87, 255, 0.8)',
    primaryLight: 'rgba(0, 87, 255, 0.1)',
    secondary: 'rgba(0, 87, 255, 0.5)',
    success: 'rgba(16, 185, 129, 0.8)',
    danger: 'rgba(239, 68, 68, 0.8)',
    accent: 'rgba(92, 153, 255, 0.8)',
    gray: 'rgba(148, 163, 184, 0.9)',
    overflow: 'rgba(129, 140, 248, 0.9)'
};

const DAY_MS = 86400000;
const GAP_UMBRAL_DIAS = 7; // huecos mayores a 7 días se marcan de otro color

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const YEAR_PALETTE = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#f87171'];

// Formatea números como texto en español (separadores de miles)
const fmtNum = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 }));

// Color semántico según nivel de llenado.
//  > 100 → desborde (por encima de NAMO) | null → sin dato
function nivelColor(pct, alpha = 1) {
    if (pct === null || pct === undefined || Number.isNaN(pct)) return `rgba(148, 163, 184, ${alpha})`;
    if (pct > 100) return `rgba(129, 140, 248, ${alpha})`;
    if (pct >= 80) return `rgba(16, 185, 129, ${alpha})`;
    if (pct >= 50) return `rgba(0, 87, 255, ${alpha})`;
    if (pct >= 30) return `rgba(245, 158, 11, ${alpha})`;
    return `rgba(239, 68, 68, ${alpha})`;
}

// Configuración base de Chart.js acorde al sistema de diseño del proyecto
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#64748b';
}

let datos;              // data.json  (series dinámicas)
let presas;             // presas.json (metadatos estáticos)
let presasById = new Map();
let periodoPorFecha = new Map();
let fechas = [];
let charts = {};
let myMap;

// Variables de estado
let currentDamEvolution = '';     // '' = Todas las presas
let currentPeriodEvolution = 90;
let currentDamAnnual = '';
let currentComparativaDam = '';
let currentDailyDate = null;
let dailyMetric = 'pct';          // 'pct' | 'mm3'

// Día del año (1-366) para una fecha dada
function dayOfYearFromDate(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / DAY_MS);
}

function dayOfYearToDate(doy) {
    const ref = new Date(2001, 0, 1);
    ref.setDate(ref.getDate() + doy - 1);
    return ref;
}

const nombreDe = (id) => (presasById.get(id) || {}).nombre || id;
const metaDe = (id) => presasById.get(id) || {};

// Inyecta una leyenda de niveles de llenado en la tarjeta del gráfico diario
function injectNivelLegend() {
    const chart = document.getElementById('dailyChart');
    if (!chart) return;
    const card = chart.closest('section');
    if (!card || card.querySelector('.nivel-legend')) return;

    const levels = [
        ['> 100% (desborde)', 'rgba(129, 140, 248, 0.9)'],
        ['≥ 80%', 'rgba(16, 185, 129, 0.9)'],
        ['50–80%', 'rgba(0, 87, 255, 0.9)'],
        ['30–50%', 'rgba(245, 158, 11, 0.9)'],
        ['< 30%', 'rgba(239, 68, 68, 0.9)'],
        ['sin dato', 'rgba(148, 163, 184, 0.9)']
    ];
    const legend = document.createElement('div');
    legend.className = 'nivel-legend flex flex-wrap gap-3 mt-3 text-[11px] text-slate-500 dark:text-slate-400';
    legend.innerHTML = levels.map(([label, color]) =>
        `<span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${color}"></span>${label}</span>`
    ).join('');
    card.querySelector('.p-6').appendChild(legend);
}

// ============================================================
// Carga de datos (data.json + presas.json)
// ============================================================
async function fetchJson(rel) {
    const ts = new Date().getTime();
    try {
        const r1 = await fetch(`/sinagua/${rel}?t=${ts}`);
        if (r1.ok) return await r1.json();
    } catch (_) { /* fallback */ }
    const r2 = await fetch(`../${rel}?t=${ts}`);
    if (!r2.ok) throw new Error(`No se pudo cargar ${rel}`);
    return await r2.json();
}

async function cargarDatos() {
    const [d, p] = await Promise.all([
        fetchJson('src/data/data.json'),
        fetchJson('src/data/presas.json')
    ]);
    datos = d;
    presas = p;
    presasById = new Map(p.presas.map(x => [x.id, x]));
    periodoPorFecha = new Map(d.periodos.map(x => [x.fecha, x]));
    fechas = d.periodos.map(x => x.fecha); // ordenadas ascendente
}

const periodoDe = (date) => periodoPorFecha.get(date) || { fecha: date, promedio: null, presas: [] };

async function updateHeaderDate() {
    const lastDateEl = document.getElementById('lastDate');
    if (!lastDateEl) return;

    await cargarDatos();

    const lastRaw = fechas[fechas.length - 1];
    const formatDate = (s) => {
        const [y, m, d] = s.split('-');
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${d}/${months[parseInt(m) - 1]}/${y}`;
    };
    const formatted = formatDate(lastRaw);
    lastDateEl.textContent = formatted;

    const lastDateMobile = document.getElementById('lastDateMobile');
    if (lastDateMobile) lastDateMobile.textContent = formatted;

    const avgEl = document.getElementById('avgPercent');
    if (avgEl) {
        const avg = (idx) => {
            if (idx < 0 || idx >= fechas.length) return null;
            const p = periodoDe(fechas[idx]);
            return typeof p.promedio === 'number' ? p.promedio : null;
        };
        const v = avg(fechas.length - 1);
        avgEl.textContent = v !== null ? `${v.toFixed(1)} %` : '— %';

        const aplicarDiff = (idEl, fromIdx) => {
            const el = document.getElementById(idEl);
            if (!el) return;
            const anti = avg(fromIdx);
            if (v === null || anti === null) {
                el.textContent = '—';
                el.className = 'text-3xl font-bold text-slate-800 dark:text-slate-100';
                return;
            }
            const diff = v - anti;
            const prefix = diff >= 0 ? '+' : '';
            const colorClass = diff >= 0 ? 'text-success-500' : 'text-danger-500';
            const arrow = diff >= 0 ? '↑' : '↓';
            el.textContent = `${prefix}${diff.toFixed(2)}% ${arrow}`;
            el.className = `text-3xl font-bold ${colorClass}`;
        };
        aplicarDiff('avgDiffDay', fechas.length - 2);
        aplicarDiff('avgDiffMonth', fechas.length - 31);

        initDailyChart();
        initMap();
        initEvolutionChart();
        initAnnualChart();
        initComparativaChart();
        injectNivelLegend();
    }
}

// ============================================================
// Estado Diario (ranking horizontal)
// ============================================================
function initDailyChart() {
    const filterContainer = document.getElementById('dailyFilter');
    if (!filterContainer) return;
    const dates = fechas.slice().reverse();
    currentDailyDate = dates[0];

    const select = createSelect(dates, currentDailyDate, (e) => {
        currentDailyDate = e.target.value;
        renderDailyChart(currentDailyDate);
    });
    filterContainer.appendChild(select);
    filterContainer.appendChild(createMetricToggle());
    renderDailyChart(currentDailyDate);
}

function createMetricToggle() {
    const wrap = document.createElement('div');
    wrap.className = 'inline-flex rounded-lg overflow-hidden border border-cream-200 dark:border-slate-600 text-xs mt-2 md:mt-0 md:ml-1';
    const activeCls = 'bg-primary-500 text-white';
    const idleCls = 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300';
    const update = () => {
        wrap.querySelectorAll('button').forEach(b => {
            b.className = 'px-3 py-1.5 font-medium transition ' + (b.dataset.val === dailyMetric ? activeCls : idleCls);
        });
    };
    [['pct', '% NAMO'], ['mm3', 'Volumen (Mm³)']].forEach(([val, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.val = val;
        btn.textContent = label;
        btn.addEventListener('click', () => {
            dailyMetric = val;
            update();
            renderDailyChart(currentDailyDate);
        });
        wrap.appendChild(btn);
    });
    update();
    return wrap;
}

function renderDailyChart(date) {
    const periodo = periodoDe(date);
    const isMm3 = dailyMetric === 'mm3';
    const getVal = (r) => isMm3 ? r.almacenamientoMm3 : r.porcentaje;

    // Sin dato va al final; el resto ordenado de mayor a menor según la métrica activa
    const sorted = (periodo.presas || []).slice()
        .sort((a, b) => {
            const va = getVal(a), vb = getVal(b);
            if (va === null && vb === null) return a.id.localeCompare(b.id);
            if (va === null) return 1;
            if (vb === null) return -1;
            return vb - va;
        });

    updateChart('dailyChart', {
        type: 'bar',
        data: {
            labels: sorted.map(r => nombreDe(r.id)),
            datasets: [{
                label: isMm3 ? 'Almacenamiento (Mm³)' : 'Porcentaje (%)',
                data: sorted.map(getVal),
                backgroundColor: sorted.map(r => nivelColor(r.porcentaje)),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const r = sorted[ctx.dataIndex];
                            const meta = metaDe(r.id);
                            const cap = meta.capacidadNamo;
                            const lines = isMm3
                                ? [`Almacenamiento: ${fmtNum(r.almacenamientoMm3)} Mm³`, `Porcentaje: ${r.porcentaje !== null ? r.porcentaje + '%' : '—'}`]
                                : [`Porcentaje: ${r.porcentaje !== null ? r.porcentaje + '%' : '—'}`, `Almacenamiento: ${fmtNum(r.almacenamientoMm3)} Mm³`];
                            lines.push(`Capacidad NAMO: ${fmtNum(cap)} Mm³`);
                            if (r.flag === 'incoherente') lines.push('Dato incoherente (excluido)');
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grace: '10%',
                    grid: { color: 'rgba(100,116,139,0.15)' },
                    ticks: isMm3 ? { maxTicksLimit: 7, callback: (v) => fmtNum(v) } : { maxTicksLimit: 7 }
                },
                y: { grid: { display: false } }
            }
        }
    });
}

// ============================================================
// Evolución Temporal
// ============================================================
function initEvolutionChart() {
    const filterContainer = document.getElementById('evolutionFilter');
    if (!filterContainer) return;

    const damSelect = createSelect(opcionesPresas('Todas las presas'), currentDamEvolution, (e) => {
        currentDamEvolution = e.target.value;
        renderEvolutionChart();
    });

    const periodSelect = createSelect(
        {7: '1 semana', 14: '2 semanas', 30: '1 mes', 90: '3 meses', 365: '1 año', Infinity: 'Histórico'},
        currentPeriodEvolution,
        (e) => { currentPeriodEvolution = e.target.value; renderEvolutionChart(); }
    );

    filterContainer.append(createLabel("Presa: "), damSelect, createLabel(" Periodo: "), periodSelect);
    renderEvolutionChart();
}

function renderEvolutionChart() {
    const periodDays = currentPeriodEvolution === 'Infinity' ? Infinity : parseInt(currentPeriodEvolution);
    const labels = periodDays === Infinity ? fechas : fechas.slice(-periodDays);

    const data = labels.map(date => {
        const p = periodoDe(date);
        if (currentDamEvolution === '') return typeof p.promedio === 'number' ? p.promedio : null;
        const rec = (p.presas || []).find(r => r.id === currentDamEvolution);
        return rec ? rec.porcentaje : null;
    });

    const gapDias = (i0, i1) => {
        const a = labels[i0], b = labels[i1];
        if (!a || !b) return 0;
        return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
    };

    const titulo = currentDamEvolution === ''
        ? `Evolución Estatal Ponderada (%)`
        : `Evolución ${nombreDe(currentDamEvolution)} (%)`;

    updateChart('evolutionChart', {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: titulo,
                data,
                borderColor: COLORS.primary,
                backgroundColor: COLORS.primaryLight,
                tension: 0.3,
                fill: true,
                spanGaps: true,
                pointRadius: labels.length > 60 ? 0 : 3,
                pointHoverRadius: 5,
                borderWidth: 2,
                segment: {
                    // Marca los huecos > GAP_UMBRAL_DIAS con otro color y trazado punteado
                    borderColor: (ctx) => {
                        const i0 = ctx.p0DataIndex === undefined ? (ctx.p0 && ctx.p0.dataIndex) : ctx.p0DataIndex;
                        const i1 = ctx.p1DataIndex === undefined ? (ctx.p1 && ctx.p1.dataIndex) : ctx.p1DataIndex;
                        return gapDias(i0, i1) > GAP_UMBRAL_DIAS ? 'rgba(100,116,139,0.4)' : COLORS.primary;
                    },
                    borderDash: (ctx) => {
                        const i0 = ctx.p0DataIndex === undefined ? (ctx.p0 && ctx.p0.dataIndex) : ctx.p0DataIndex;
                        const i1 = ctx.p1DataIndex === undefined ? (ctx.p1 && ctx.p1.dataIndex) : ctx.p1DataIndex;
                        return gapDias(i0, i1) > GAP_UMBRAL_DIAS ? [3, 4] : [];
                    }
                }
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const date = labels[ctx.dataIndex];
                            const p = periodoDe(date);
                            if (currentDamEvolution === '') {
                                return `Promedio estatal: ${ctx.parsed.y.toFixed(2)}%`;
                            }
                            const rec = (p.presas || []).find(r => r.id === currentDamEvolution);
                            const meta = metaDe(currentDamEvolution);
                            if (rec && rec.almacenamientoMm3 !== null) {
                                return [
                                    `Nivel: ${ctx.parsed.y.toFixed(2)}%`,
                                    `Almacenamiento: ${fmtNum(rec.almacenamientoMm3)} Mm³`,
                                    `Capacidad NAMO: ${fmtNum(meta.capacidadNamo)} Mm³`
                                ];
                            }
                            return `Sin dato`;
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, suggestedMax: 100, grace: '10%', grid: { color: 'rgba(100,116,139,0.15)' } },
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }
            }
        }
    });
}

// ============================================================
// Promedio Anual
// ============================================================
function initAnnualChart() {
    const filterContainer = document.getElementById('annualFilter');
    if (!filterContainer) return;

    const select = createSelect(opcionesPresas('Todas las presas'), '', (e) => {
        currentDamAnnual = e.target.value;
        renderAnnualChart();
    });
    filterContainer.append(createLabel("Presa: "), select);
    renderAnnualChart();
}

function renderAnnualChart() {
    const annualData = {};
    fechas.forEach(date => {
        const year = date.slice(0, 4);
        const p = periodoDe(date);
        let val;
        if (currentDamAnnual === '') {
            val = p.promedio;
        } else {
            const rec = (p.presas || []).find(r => r.id === currentDamAnnual);
            val = rec ? rec.porcentaje : null;
        }
        if (val === null || val === undefined) return;
        if (!annualData[year]) annualData[year] = [];
        annualData[year].push(val);
    });

    const labels = Object.keys(annualData).sort();
    const averages = labels.map(year => {
        const values = annualData[year];
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
    });

    updateChart('annualChart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: `Promedio Anual ${currentDamAnnual ? nombreDe(currentDamAnnual) : 'Estatal'} (%)`,
                data: averages,
                backgroundColor: averages.map(v => nivelColor(v)),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Promedio anual: ${ctx.parsed.y.toFixed(1)}%`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, suggestedMax: 100, grace: '10%', grid: { color: 'rgba(100,116,139,0.15)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ============================================================
// Comparativa por Año
// ============================================================
function initComparativaChart() {
    const filterContainer = document.getElementById('comparativaFilter');
    if (!filterContainer) return;

    const select = createSelect(opcionesPresas('Todas las presas'), '', (e) => {
        currentComparativaDam = e.target.value;
        renderComparativaChart();
    });
    filterContainer.append(createLabel("Presa: "), select);
    renderComparativaChart();
}

function renderComparativaChart() {
    const yearsData = {};

    fechas.forEach(date => {
        const [y, m, d] = date.split('-').map(Number);
        const doy = dayOfYearFromDate(new Date(y, m - 1, d));
        const p = periodoDe(date);

        let val;
        if (currentComparativaDam === '') {
            val = p.promedio;
        } else {
            const rec = (p.presas || []).find(r => r.id === currentComparativaDam);
            val = rec ? rec.porcentaje : null;
        }
        if (val === null || val === undefined) return;
        if (!yearsData[y]) yearsData[y] = [];
        yearsData[y].push({ x: doy, y: val });
    });

    const yearKeys = Object.keys(yearsData).sort();
    const currentYear = yearKeys[yearKeys.length - 1];

    const currentYearLabel = document.getElementById('comparativaCurrentYear');
    if (currentYearLabel) currentYearLabel.textContent = currentYear;

    const datasets = yearKeys.map((year, i) => {
        const isCurrent = year === currentYear;
        return {
            label: year,
            data: yearsData[year],
            tension: 0.3,
            borderWidth: isCurrent ? 3 : 1.5,
            borderColor: isCurrent ? 'rgba(0, 87, 255, 0.9)' : YEAR_PALETTE[i % YEAR_PALETTE.length],
            borderDash: isCurrent ? [] : [5, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            spanGaps: false
        };
    });

    updateChart('comparativaChart', {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 20, boxHeight: 2, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const date = dayOfYearToDate(items[0].parsed.x);
                            return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
                        },
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 1,
                    max: 366,
                    grid: { color: 'rgba(100,116,139,0.15)' },
                    ticks: {
                        maxTicksLimit: 12,
                        callback: (value) => MONTHS_SHORT[dayOfYearToDate(value).getMonth()]
                    }
                },
                y: { beginAtZero: true, suggestedMax: 100, grace: '10%', grid: { color: 'rgba(100,116,139,0.15)' } }
            }
        }
    });
}

// ============================================================
// Mapa
// ============================================================
function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    myMap = L.map('map').setView([25.0, -107.5], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(myMap);

    const lastPeriod = periodoDe(fechas[fechas.length - 1]);
    const registros = new Map((lastPeriod.presas || []).map(r => [r.id, r]));

    presas.presas.forEach(meta => {
        if (meta.lat === null || meta.lon === null) return;
        const rec = registros.get(meta.id);
        const pct = rec ? rec.porcentaje : null;
        const color = nivelColor(pct);
        const texto = pct !== null ? `${pct}%` : 's/d';

        const icon = L.divIcon({
            className: 'bg-white dark:bg-slate-800 rounded-full text-xs font-bold shadow-lg flex items-center justify-center whitespace-nowrap px-1',
            html: `<span style="color:${color}; border:2px solid ${color}; border-radius:9999px; padding:0 6px; line-height:20px;">${texto}</span>`,
            iconSize: [56, 28],
            iconAnchor: [28, 14]
        });

        const popup = `<div style="font-family:'Inter',sans-serif">` +
            `<b>${meta.nombre}</b><br>` +
            `Nivel: <b style="color:${color}">${pct !== null ? pct + '%' : 'sin dato'}</b><br>` +
            `Almacenamiento: ${fmtNum(rec ? rec.almacenamientoMm3 : null)} Mm³<br>` +
            `Capacidad NAMO: ${fmtNum(meta.capacidadNamo)} Mm³` +
            `</div>`;

        L.marker([meta.lat, meta.lon], { icon: icon }).addTo(myMap).bindPopup(popup);
    });
}

// ============================================================
// Utilidades
// ============================================================
function opcionesPresas(prefijoTodas) {
    const ops = [];
    if (prefijoTodas) ops.push({ v: '', l: prefijoTodas });
    presas.presas
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .forEach(p => ops.push({ v: p.id, l: p.nombre }));
    return ops;
}

function updateChart(canvasId, config) {
    if (charts[canvasId]) charts[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    charts[canvasId] = new Chart(ctx, config);
}

function createSelect(options, selectedValue, onChange) {
    const select = document.createElement('select');
    select.className = 'text-sm border border-cream-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition w-full md:w-auto mr-3';
    const add = (val, label) => select.options.add(new Option(label, val));
    if (Array.isArray(options)) {
        options.forEach(o => {
            if (o && typeof o === 'object' && 'v' in o) add(o.v, o.l);
            else add(o, o);
        });
    } else {
        Object.entries(options).forEach(([val, label]) => add(val, label));
    }
    select.value = selectedValue;
    select.addEventListener('change', onChange);
    return select;
}

function createLabel(text) {
    const label = document.createElement('label');
    label.textContent = text;
    label.className = "text-xs font-medium text-slate-500 dark:text-slate-400 mr-1";
    return label;
}

document.addEventListener('DOMContentLoaded', updateHeaderDate);