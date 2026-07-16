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

async function fetchData() {
    const response = await fetch('src/data/data.json');
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
    const avg = lastData.reduce((acc, p) => acc + parseFloat(p.porcentaje), 0) / lastData.length;
    document.getElementById('avgPercent').textContent = `${avg.toFixed(1)} %`;

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
        } else if (view === 'historical' || view === 'annual') {
            const label = document.createElement('label');
            label.textContent = "Presa: ";
            label.className = "mr-2 font-medium text-slate-700";
            
            const select = document.createElement('select');
            select.className = 'p-2 border border-slate-300 rounded-md w-full md:w-64';
            const dams = [...new Set(Object.values(masterData).flat().map(p => p.nombre))].sort();
            dams.forEach(d => select.options.add(new Option(d, d)));
            
            select.addEventListener('change', (e) => {
                if (view === 'historical') renderHistoricalChart(e.target.value);
                else renderAnnualChart(e.target.value);
            });
            
            filterContainer.appendChild(label);
            filterContainer.appendChild(select);
            
            if (view === 'historical') renderHistoricalChart(dams[0]);
            else renderAnnualChart(dams[0]);
        }
    }
}

function renderAnnualChart(damName) {
    const annualData = {};
    Object.keys(masterData).forEach(date => {
        const year = date.split('-')[0];
        const damEntry = masterData[date].find(d => d.nombre === damName);
        if (damEntry) {
            if (!annualData[year]) annualData[year] = [];
            annualData[year].push(parseFloat(damEntry.porcentaje));
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
                label: `Promedio Anual ${damName} (%)`,
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
