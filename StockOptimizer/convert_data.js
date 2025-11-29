import * as XLSX from "xlsx/xlsx.mjs";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set fs for xlsx
XLSX.set_fs(fs);

const EXCEL_PATH = path.resolve(__dirname, "SP500_AdjustedClose_5Y.xlsx");
const JSON_PATH = path.resolve(__dirname, "sp500_data.json");

console.log(`Reading Excel file from: ${EXCEL_PATH}`);

if (!fs.existsSync(EXCEL_PATH)) {
    console.error("Excel file not found!");
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetNames = workbook.SheetNames;
    const result = {};

    console.log(`Found ${sheetNames.length} sheets. Converting...`);

    for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // Convert to JSON with raw values
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        // Process data to match the expected format in stock-data.ts
        // We want to store it efficiently. 
        // The current format in stock-data.ts maps each row to { date, adjClose }.
        // Let's store it as an array of objects to be safe and simple.

        const prices = jsonData
            .filter((row) => row["Adj Close"])
            .map((row) => {
                let dateValue;
                if (typeof row["Date"] === "number") {
                    const parsed = XLSX.SSF.parse_date_code(row["Date"]);
                    // Simple ISO string generation
                    dateValue = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().split("T")[0];
                } else {
                    dateValue = new Date(row["Date"]).toISOString().split("T")[0];
                }
                return {
                    date: dateValue,
                    adjClose: Number(row["Adj Close"]),
                };
            })
            .filter((p) => !!p.date && p.date !== "Invalid" && !isNaN(p.adjClose));

        if (prices.length > 0) {
            result[sheetName.toUpperCase()] = {
                ticker: sheetName.toUpperCase(),
                name: sheetName.toUpperCase(),
                prices: prices
            };
        }
    }

    console.log(`Writing JSON file to: ${JSON_PATH}`);
    fs.writeFileSync(JSON_PATH, JSON.stringify(result)); // No indentation to save space
    console.log("Conversion complete!");

} catch (error) {
    console.error("Error converting data:", error);
    process.exit(1);
}
