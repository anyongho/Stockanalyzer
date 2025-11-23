
const XLSX = require('xlsx');
const fs = require('fs');

const COMPANIES_PATH = 'sp500_companies.xlsx';

function debugCompanies() {
    if (fs.existsSync(COMPANIES_PATH)) {
        try {
            console.log(`Loading company metadata from ${COMPANIES_PATH}`);
            const workbook = XLSX.readFile(COMPANIES_PATH);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const companies = XLSX.utils.sheet_to_json(sheet);

            console.log(`Loaded ${companies.length} rows.`);

            if (companies.length > 0) {
                console.log("First row keys:", Object.keys(companies[0]));
                console.log("First row data:", JSON.stringify(companies[0], null, 2));
            }
        } catch (error) {
            console.error("Failed to load company metadata:", error);
        }
    } else {
        console.log("File not found:", COMPANIES_PATH);
    }
}

debugCompanies();
