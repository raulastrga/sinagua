// Función auxiliar para convertir DMS a decimal
function dmsToDecimal(d, m, s) {
    return d + (m / 60) + (s / 3600);
}

const DAM_LOCATIONS = {
    "Luis Donaldo Colosio": { lat: dmsToDecimal(26, 50, 40), lon: -dmsToDecimal(108, 22, 5) },
    "Miguel Hidalgo y Costilla": { lat: dmsToDecimal(26, 30, 32), lon: -dmsToDecimal(108, 34, 49) },
    "Josefa Ortiz de Domínguez": { lat: dmsToDecimal(26, 27, 43), lon: -dmsToDecimal(108, 42, 3) },
    "Gustavo Díaz Ordaz": { lat: dmsToDecimal(25, 47, 33), lon: -dmsToDecimal(107, 54, 34) },
    "Guillermo Blake Aguilar": { lat: dmsToDecimal(26, 9, 0), lon: -dmsToDecimal(108, 17, 0) },
    "Eustaquio Buelna": { lat: dmsToDecimal(25, 29, 48), lon: -dmsToDecimal(108, 3, 7) },
    "Adolfo López Mateos": { lat: dmsToDecimal(25, 5, 59), lon: -dmsToDecimal(107, 23, 16) },
    "Sanalona": { lat: dmsToDecimal(24, 48, 51), lon: -dmsToDecimal(107, 9, 5) },
    "Juan Guerrero Alcocer": { lat: dmsToDecimal(24, 37, 35), lon: -dmsToDecimal(107, 9, 38) },
    "José López Portillo": { lat: dmsToDecimal(24, 5, 48), lon: -dmsToDecimal(106, 46, 21) },
    "Aurelio Benassini V.": { lat: dmsToDecimal(23, 59, 21), lon: -dmsToDecimal(106, 34, 12) },
    "Santa Maria": { lat: dmsToDecimal(23, 10, 0), lon: -dmsToDecimal(105, 40, 42) },
    "Picachos": { lat: dmsToDecimal(23, 28, 41), lon: -dmsToDecimal(106, 13, 25) }
};

let masterData;
let charts = {}; 
let myMap;

// Variables de estado
let currentDamEvolution = 'Todas las presas';
let currentPeriodEvolution = 90;
let currentDamAnnual = null;

async function fetchData() {
    const timestamp = new Date().getTime();
    const response = await fetch(`/sinagua/src/data/data.json?t=${timestamp}`);
    
    if (!response.ok) {
        const response2 = await fetch(`../src/data/data.json?t=${timestamp}`);
        return await response2.json();
    }
    return await response.json();
}

async function updateHeaderDate() {
    const lastDateEl = document.getElementById('lastDate');
    if (!lastDateEl) return;

    masterData = await fetchData();
    const dates = Object.keys(masterData).sort();
    const lastDateRaw = dates[dates.length - 1];

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        return `${day}/${months[parseInt(month) - 1]}/${year}`;
    };

    lastDateEl.textContent = formatDate(lastDateRaw);
    
    const avgPercentEl = document.getElementById('avgPercent');
    if (avgPercentEl) {
        const getSinaloaDataForAvg = (data) => data.filter(d => 
            DAM_LOCATIONS.hasOwnProperty(d.nombre) && 
            d.nombre !== "Santa Maria" && 
            d.nombre !== "Picachos"
        );
        
        const getAvg = (data) => {
            const filtered = getSinaloaDataForAvg(data);
            const sumAlmacenamiento = filtered.reduce((acc, p) => acc + parseFloat(p.almacenamientoActualMm3), 0);
            const sumCapacidad = filtered.reduce((acc, p) => acc + parseFloat(p.capacidadNamo), 0);
            return sumCapacidad > 0 ? (sumAlmacenamiento / sumCapacidad) * 100 : 0;
        };
        
        const avg = getAvg(masterData[lastDateRaw]);
        avgPercentEl.textContent = `${avg.toFixed(1)} %`;

        const prevDateRaw = dates[dates.length - 2];
        const monthAgoDateRaw = dates[dates.length - 31];
        
        if (masterData[prevDateRaw]) {
            const diffDay = avg - getAvg(masterData[prevDateRaw]);
            const el = document.getElementById('avgDiffDay');
            if(el) {
                el.textContent = `${diffDay >= 0 ? '+' : ''}${diffDay.toFixed(2)}%`;
                el.className = `text-2xl font-semibold ${diffDay >= 0 ? 'text-green-600' : 'text-red-600'}`;
            }
        }
        if (masterData[monthAgoDateRaw]) {
            const diffMonth = avg - getAvg(masterData[monthAgoDateRaw]);
            const el = document.getElementById('avgDiffMonth');
            if(el) {
                el.textContent = `${diffMonth >= 0 ? '+' : ''}${diffMonth.toFixed(2)}%`;
                el.className = `text-2xl font-semibold ${diffMonth >= 0 ? 'text-green-600' : 'text-red-600'}`;
            }
        }

        initDailyChart();
        initMap();
        initEvolutionChart();
        initAnnualChart();
    }
}

function initDailyChart() {
    const filterContainer = document.getElementById('dailyFilter');
    if (!filterContainer) return;
    const dates = Object.keys(masterData).sort().reverse();
    const select = createSelect(dates, dates[0], (e) => renderDailyChart(e.target.value));
    filterContainer.appendChild(select);
    renderDailyChart(dates[0]);
}

function renderDailyChart(date) {
    const dayData = masterData[date];
    updateChart('dailyChart', {
        type: 'bar',
        data: {
            labels: dayData.map(p => p.nombre),
            datasets: [{
                label: 'Porcentaje (%)',
                data: dayData.map(p => parseFloat(p.porcentaje)),
                backgroundColor: 'rgba(54, 162, 235, 0.7)'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function initEvolutionChart() {
    const filterContainer = document.getElementById('evolutionFilter');
    if (!filterContainer) return;
    const dams = [...new Set(Object.values(masterData).flat().map(p => p.nombre))].sort();
    const options = ['Todas las presas', ...dams];

    const damSelect = createSelect(options, currentDamEvolution, (e) => { 
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
    const dates = Object.keys(masterData).sort();
    const periodDays = currentPeriodEvolution === 'Infinity' ? Infinity : parseInt(currentPeriodEvolution);
    const filteredDates = dates.slice(-periodDays);
    
    // Función auxiliar para filtrar y calcular el ponderado igual que en el header
    const getSinaloaDataForAvg = (data) => data.filter(d => 
        DAM_LOCATIONS.hasOwnProperty(d.nombre) && 
        d.nombre !== "Santa Maria" && 
        d.nombre !== "Picachos"
    );
    
    const chartData = filteredDates.map(date => {
        const dayEntries = masterData[date];
        
        if (currentDamEvolution === 'Todas las presas') {
            const filtered = getSinaloaDataForAvg(dayEntries);
            const sumAlmacenamiento = filtered.reduce((acc, p) => acc + parseFloat(p.almacenamientoActualMm3), 0);
            const sumCapacidad = filtered.reduce((acc, p) => acc + parseFloat(p.capacidadNamo), 0);
            return sumCapacidad > 0 ? (sumAlmacenamiento / sumCapacidad) * 100 : null;
        } else {
            const dam = dayEntries.find(d => d.nombre === currentDamEvolution);
            return dam ? parseFloat(dam.porcentaje) : null;
        }
    });

    updateChart('evolutionChart', {
        type: 'line',
        data: {
            labels: filteredDates,
            datasets: [{
                label: `Evolución ${currentDamEvolution === 'Todas las presas' ? 'Estatal (Ponderado)' : currentDamEvolution} (%)`,
                data: chartData,
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function initAnnualChart() {
    const filterContainer = document.getElementById('annualFilter');
    if (!filterContainer) return;
    const dams = [...new Set(Object.values(masterData).flat().map(p => p.nombre))].sort();
    const options = ['Todas las presas', ...dams];
    
    const select = createSelect(options, options[0], (e) => {
        currentDamAnnual = e.target.value === 'Todas las presas' ? null : e.target.value;
        renderAnnualChart();
    });
    
    filterContainer.append(createLabel("Presa: "), select);
    renderAnnualChart();
}

function renderAnnualChart() {
    const annualData = {};
    Object.keys(masterData).forEach(date => {
        const year = date.split('-')[0];
        const dayEntries = masterData[date];
        
        let values;
        if (!currentDamAnnual) {
            values = dayEntries.map(d => parseFloat(d.porcentaje)).filter(p => !isNaN(p));
        } else {
            const damEntry = dayEntries.find(d => d.nombre === currentDamAnnual);
            values = damEntry ? [parseFloat(damEntry.porcentaje)].filter(p => !isNaN(p)) : [];
        }
        
        if (values.length > 0) {
            const avgDay = values.reduce((acc, v) => acc + v, 0) / values.length;
            if (!annualData[year]) annualData[year] = [];
            annualData[year].push(avgDay);
        }
    });

    const labels = Object.keys(annualData).sort();
    const averages = labels.map(year => {
        const values = annualData[year];
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    });

    updateChart('annualChart', {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Promedio Anual ${currentDamAnnual || 'Estatal'} (%)`,
                data: averages,
                backgroundColor: 'rgba(75, 192, 192, 0.7)'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    
    myMap = L.map('map').setView([25.0, -107.5], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors & CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(myMap);

    const lastDate = Object.keys(masterData).sort().pop();
    const lastData = masterData[lastDate];

    lastData.forEach(dam => {
        const loc = DAM_LOCATIONS[dam.nombre];
        if (loc) {
            const icon = L.divIcon({
                className: 'bg-white border border-blue-500 rounded-md px-2 py-1 text-xs font-bold text-blue-800 shadow-md flex items-center justify-center whitespace-nowrap',
                html: `${dam.porcentaje}%`,
                iconSize: [50, 26],
                iconAnchor: [25, 13]
            });
            L.marker([loc.lat, loc.lon], { icon: icon })
                .addTo(myMap)
                .bindPopup(`<b>${dam.nombre}</b><br>Porcentaje: ${dam.porcentaje}%`);
        }
    });
}

function updateChart(canvasId, config) {
    if (charts[canvasId]) charts[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    charts[canvasId] = new Chart(ctx, config);
}

function createSelect(options, selectedValue, onChange) {
    const select = document.createElement('select');
    select.className = 'p-2 border border-slate-300 rounded-md w-full md:w-auto mr-4';
    if (Array.isArray(options)) {
        options.forEach(o => select.options.add(new Option(o, o)));
    } else {
        Object.entries(options).forEach(([val, label]) => select.options.add(new Option(label, val)));
    }
    select.value = selectedValue;
    select.addEventListener('change', onChange);
    return select;
}

function createLabel(text) {
    const label = document.createElement('label');
    label.textContent = text;
    label.className = "mr-2 font-medium text-slate-700";
    return label;
}

document.addEventListener('DOMContentLoaded', updateHeaderDate);
