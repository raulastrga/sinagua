// Convert DMS (Degrees, Minutes, Seconds) to Decimal Degrees
function dmsToDecimal(d, m, s) {
    return d + (m / 60) + (s / 3600);
}

// Coordinate Reference Data
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

let myChart, myMap, masterData;
let currentDam = null;
let currentPeriod = 90; // Default 3 meses

async function fetchData() {
    const timestamp = new Date().getTime();
    // Probemos usando la ruta absoluta desde la raíz del sitio
    const response = await fetch(`/sinagua/src/data/data.json?t=${timestamp}`);
    
    if (!response.ok) {
        // Fallback si la ruta absoluta falla
        const response2 = await fetch(`/src/data/data.json?t=${timestamp}`);
        return await response2.json();
    }
    return await response.json();
}

async function init() {
    masterData = await fetchData();
    const dates = Object.keys(masterData).sort();
    const lastDateRaw = dates[dates.length - 1];

    // Helper to format date dd/mmm/yyyy
    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        return `${day}/${months[parseInt(month) - 1]}/${year}`;
    };

    document.getElementById('lastDate').textContent = formatDate(lastDateRaw);
    const lastData = masterData[lastDateRaw];
    const prevDateRaw = dates[dates.length - 2];
    const prevData = masterData[prevDateRaw];

    const getAvg = (data) => data.reduce((acc, p) => acc + parseFloat(p.porcentaje), 0) / data.length;
    
    const avg = getAvg(lastData);
    document.getElementById('avgPercent').textContent = `${avg.toFixed(1)} %`;

    // Variación vs Ayer
    if (prevData) {
        const diffDay = avg - getAvg(prevData);
        const el = document.getElementById('avgDiffDay');
        el.textContent = `${diffDay >= 0 ? '+' : ''}${diffDay.toFixed(2)}%`;
        el.className = `text-2xl font-semibold ${diffDay >= 0 ? 'text-green-600' : 'text-red-600'}`;
    }

    // Variación vs Mes Pasado (aprox 30 días)
    const monthAgoDateRaw = dates[dates.length - 31];
    const monthAgoData = masterData[monthAgoDateRaw];
    if (monthAgoData) {
        const diffMonth = avg - getAvg(monthAgoData);
        const el = document.getElementById('avgDiffMonth');
        el.textContent = `${diffMonth >= 0 ? '+' : ''}${diffMonth.toFixed(2)}%`;
        el.className = `text-2xl font-semibold ${diffMonth >= 0 ? 'text-green-600' : 'text-red-600'}`;
    }

    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewButtons.forEach(b => {
                b.classList.remove('bg-blue-100', 'text-blue-700');
                b.classList.add('bg-slate-100', 'text-slate-600');
            });
            e.target.classList.remove('bg-slate-100', 'text-slate-600');
            e.target.classList.add('bg-blue-100', 'text-blue-700');
            renderView(e.target.dataset.view);
        });
    });

    renderView('daily');
}

function renderView(view) {
    const filterContainer = document.getElementById('filterContainer');
    const chartWrapper = document.getElementById('chartWrapper');
    const mapContainer = document.getElementById('map');
    
    filterContainer.innerHTML = ''; 

    if (view === 'map') {
        chartWrapper.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        renderMap();
    } else {
        chartWrapper.classList.remove('hidden');
        mapContainer.classList.add('hidden');
        
        if (view === 'daily') {
            const select = document.createElement('select');
            select.className = 'p-2 border border-slate-300 rounded-md w-full md:w-64';
            Object.keys(masterData).sort().reverse().forEach(d => select.options.add(new Option(d, d)));
            select.addEventListener('change', (e) => renderDailyChart(e.target.value));
            filterContainer.appendChild(select);
            renderDailyChart(select.value);
        } else if (view === 'evolution') {
            setupEvolutionFilters();
        } else if (view === 'annual') {
            setupAnnualFilters();
        }
    }
}

function setupEvolutionFilters() {
    const filterContainer = document.getElementById('filterContainer');
    const dams = [...new Set(Object.values(masterData).flat().map(p => p.nombre))].sort();
    const options = ['Todas las presas', ...dams];
    
    if (!currentDam) currentDam = options[0];

    const damSelect = createSelect(options, currentDam, (e) => { currentDam = e.target.value; renderEvolutionChart(); });
    const periodSelect = createSelect(
        {7: '1 semana', 14: '2 semanas', 30: '1 mes', 90: '3 meses', 365: '1 año', Infinity: 'Histórico'},
        currentPeriod,
        (e) => { currentPeriod = e.target.value; renderEvolutionChart(); }
    );
    
    filterContainer.append(createLabel("Presa: "), damSelect, createLabel(" Periodo: "), periodSelect);
    renderEvolutionChart();
}

function renderEvolutionChart() {
    const dates = Object.keys(masterData).sort();
    const periodDays = currentPeriod === 'Infinity' ? Infinity : parseInt(currentPeriod);
    const filteredDates = dates.slice(-periodDays);
    
    const chartData = filteredDates.map(date => {
        const dayEntries = masterData[date];
        if (currentDam === 'Todas las presas') {
            const values = dayEntries.map(d => parseFloat(d.porcentaje)).filter(p => !isNaN(p));
            return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
        } else {
            const dam = dayEntries.find(d => d.nombre === currentDam);
            return dam ? parseFloat(dam.porcentaje) : null;
        }
    });

    updateChart({
        type: 'line',
        data: {
            labels: filteredDates,
            datasets: [{
                label: `Evolución ${currentDam} (%)`,
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

function renderRecentChart(damName) {
    const dates = Object.keys(masterData).sort();
    const last90Dates = dates.slice(-90);
    const recentData = last90Dates.map(date => {
        const dam = masterData[date].find(d => d.nombre === damName);
        return dam ? parseFloat(dam.porcentaje) : null;
    });

    updateChart({
        type: 'line',
        data: {
            labels: last90Dates,
            datasets: [{
                label: `Últimos 3 meses ${damName} (%)`,
                data: recentData,
                borderColor: 'rgba(50, 205, 50, 1)',
                backgroundColor: 'rgba(50, 205, 50, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function setupAnnualFilters() {
    const filterContainer = document.getElementById('filterContainer');
    const dams = [...new Set(Object.values(masterData).flat().map(p => p.nombre))].sort();
    const options = ['Todas las presas', ...dams];
    
    const select = createSelect(options, options[0], (e) => {
        const selected = e.target.value === 'Todas las presas' ? null : e.target.value;
        renderAnnualChart(selected);
    });
    
    filterContainer.append(createLabel("Presa: "), select);
    renderAnnualChart(null);
}

function renderAnnualChart(damName) {
    const annualData = {};
    Object.keys(masterData).forEach(date => {
        const year = date.split('-')[0];
        const dayEntries = masterData[date];
        
        let values;
        if (!damName) {
            // Promedio de todas las presas
            values = dayEntries.map(d => parseFloat(d.porcentaje)).filter(p => !isNaN(p));
        } else {
            // Filtrar por presa específica
            const damEntry = dayEntries.find(d => d.nombre === damName);
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

    updateChart({
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Promedio Anual ${damName || 'Estatal'} (%)`,
                data: averages,
                backgroundColor: 'rgba(75, 192, 192, 0.7)'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function renderMap() {
    if (myMap) myMap.remove();
    
    myMap = L.map('map').setView([25.0, -107.5], 7);
    
    // Usamos un estilo de mapa más limpio: CartoDB Positron
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
            // Usamos DivIcon para mostrar el porcentaje directamente
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

// Helpers
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

function updateChart(config) {
    const ctx = document.getElementById('presasChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, config);
}

function renderDailyChart(date) {
    const dayData = masterData[date];
    updateChart({
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

function renderHistoricalChart(damName) {
    const dates = Object.keys(masterData).sort();
    const historicalData = dates.map(date => {
        const dam = masterData[date].find(d => d.nombre === damName);
        return dam ? parseFloat(dam.porcentaje) : null;
    });

    updateChart({
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: `Histórico ${damName} (%)`,
                data: historicalData,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

init();
