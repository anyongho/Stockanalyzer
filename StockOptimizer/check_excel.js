const XLSX = require('xlsx');
const fs = require('fs');

try {
    const workbook = XLSX.readFile('sp500_companies.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);

    if (json.length > 0) {
        console.log("Columns:", JSON.stringify(Object.keys(json[0])));
        console.log("First Row:", JSON.stringify(json[0], null, 2));
    } else {
        console.log("Sheet is empty");
    }
} catch (e) {
    console.error("Error:", e);
}
