const fs = require('fs');
const path = require('path');

const inputDir = path.join(process.cwd(), 'json');
const outputFile = path.join(process.cwd(), 'src/data/data.json');

function parseDate(filename, folder) {
    // Filename format: datos-DD-MM-YY.json
    const match = filename.match(/datos-(\d{2})-(\d{2})-(\d{2})\.json/);
    if (!match) return null;
    
    let [_, day, month, year] = match;
    // Assuming the folder name 'YYYY' or 'YY'
    // Let's ensure year is 4 digits
    if (year.length === 2) {
        year = '20' + year;
    }
    
    return `${year}-${month}-${day}`;
}

function aggregate() {
    const masterData = {};
    const years = fs.readdirSync(inputDir).filter(f => fs.lstatSync(path.join(inputDir, f)).isDirectory());

    years.forEach(year => {
        const yearDir = path.join(inputDir, year);
        const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'));

        files.forEach(file => {
            const date = parseDate(file, year);
            if (!date) return;

            const filePath = path.join(yearDir, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            masterData[date] = content;
        });
    });

    // Sort by date
    const sortedDates = Object.keys(masterData).sort();
    const sortedMasterData = {};
    sortedDates.forEach(date => {
        sortedMasterData[date] = masterData[date];
    });

    fs.writeFileSync(outputFile, JSON.stringify(sortedMasterData, null, 2));
    console.log(`Successfully generated ${outputFile}`);
}

aggregate();
