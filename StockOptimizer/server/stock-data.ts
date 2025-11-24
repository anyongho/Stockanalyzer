import { type StockData, type StockPrice } from "@shared/schema";
import { storage } from "./storage";
import * as fs from "fs";
import path from "path";

// ESM 환경에서는 xlsx/xlsx.mjs 경로 사용
// @ts-ignore
import * as XLSX from "xlsx/xlsx.mjs";
XLSX.set_fs(fs);

// Node.js에서 __dirname 대체
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Excel 파일 경로 (루트에 넣었으면 ../로 한 단계 위)
const EXCEL_PATH = path.resolve(__dirname, "../SP500_AdjustedClose_5Y.xlsx");
const COMPANIES_PATH = path.resolve(__dirname, "../sp500_companies.xlsx");

export interface CompanyDetails {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  founded: string;
}

class StockCache {
  private cache: Map<string, StockData> = new Map();
  private companyCache: Map<string, CompanyDetails> = new Map();
  private isInitialized: boolean = false;

  async initialize() {
    if (this.isInitialized) return;



    // 1. Load Company Metadata
    if (fs.existsSync(COMPANIES_PATH)) {
      try {

        const workbook = XLSX.readFile(COMPANIES_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const companies = XLSX.utils.sheet_to_json<any>(sheet);

        // console.log("Sample company data:", JSON.stringify(companies.slice(0, 1), null, 2));

        for (const row of companies) {
          // User reported columns: Symbol, Security, GICS Sector, GICS Sub-Industry, Founded
          const ticker = row["Symbol"] || row["Ticker"] || row["symbol"] || "";
          if (!ticker) continue;

          const details: CompanyDetails = {
            ticker: ticker.toUpperCase(),
            name: row["Security"] || row["Name"] || row["Company"] || ticker,
            sector: row["GICS Sector"] || row["Sector"] || "Unknown",
            industry: row["GICS Sub-Industry"] || row["Industry"] || "Unknown",
            description: row["Security"] ? `${row["Security"]} operates in the ${row["GICS Sector"] || "Unknown"} sector.` : (row["Longbusinesssummary"] || "No description available."),
            founded: row["Founded"] || "Unknown",
          };
          this.companyCache.set(details.ticker, details);
        }

      } catch (error) {
        console.error("❌ [Cache] Failed to load company metadata:", error);
      }
    } else {
      console.warn(`⚠️ [Cache] Company metadata file not found at ${COMPANIES_PATH}`);
    }

    // 2. Load Stock Prices
    if (!fs.existsSync(EXCEL_PATH)) {
      throw new Error(`Excel file not found at ${EXCEL_PATH}`);
    }

    try {
      const workbook = XLSX.readFile(EXCEL_PATH);
      const sheetNames = workbook.SheetNames;


      let loadedCount = 0;
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        const prices: StockPrice[] = jsonData
          .filter((row: any) => row["Adj Close"])
          .map((row: any) => {
            let dateValue: string;
            if (typeof row["Date"] === "number") {
              const parsed = XLSX.SSF.parse_date_code(row["Date"]);
              dateValue = new Date(parsed.y, parsed.m - 1, parsed.d)
                .toISOString()
                .split("T")[0];
            } else {
              dateValue = new Date(row["Date"]).toISOString().split("T")[0];
            }
            return {
              date: dateValue,
              adjClose: Number(row["Adj Close"]),
            };
          })
          .filter((p: any) => !!p.date && p.date !== "Invalid" && !isNaN(p.adjClose));

        if (prices.length > 0) {
          const stockData: StockData = {
            ticker: sheetName.toUpperCase(),
            name: sheetName.toUpperCase(),
            prices,
          };
          this.cache.set(stockData.ticker, stockData);
          loadedCount++;
        }
      }

      this.isInitialized = true;

    } catch (error) {
      console.error("❌ [Cache] Failed to initialize stock cache:", error);
      throw error;
    }
  }

  get(ticker: string): StockData | undefined {
    return this.cache.get(ticker.toUpperCase());
  }

  getCompanyDetails(ticker: string): CompanyDetails | undefined {
    return this.companyCache.get(ticker.toUpperCase());
  }

  getAllTickers(): string[] {
    return Array.from(this.cache.keys());
  }

  getAllCompanyDetails(): CompanyDetails[] {
    return Array.from(this.companyCache.values());
  }

  has(ticker: string): boolean {
    return this.cache.has(ticker.toUpperCase());
  }


}

export const stockCache = new StockCache();

/**
 * Excel에서 특정 티커 데이터 로드 (캐시 사용)
 */
export async function fetchStockData(
  ticker: string,
  yearsNeeded: number = 5
): Promise<StockData | null> {
  // 캐시가 초기화되지 않았으면 초기화 시도
  if (!stockCache.getAllTickers().length) {
    await stockCache.initialize();
  }

  const data = stockCache.get(ticker);
  if (data) {
    // console.log(`✅ [Cache] Hit for ${ticker}`);
    return data;
  }


  return null;
}

/**
 * 여러 종목을 Excel에서 병렬로 불러오기 (캐시 사용)
 */
export async function fetchMultipleStocks(
  tickers: string[],
  years: number = 5
): Promise<Map<string, StockData>> {
  // 캐시가 초기화되지 않았으면 초기화 시도
  if (!stockCache.getAllTickers().length) {
    await stockCache.initialize();
  }

  const results = new Map<string, StockData>();

  for (const ticker of tickers) {
    const result = await fetchStockData(ticker, years);
    if (result) results.set(ticker.toUpperCase(), result);
    else { }
  }

  // console.log(`📦 [Cache] Retrieved: ${results.size}/${tickers.length} stocks`);
  return results;
}

/**
 * 공통 날짜 구간 추출
 */
export function getCommonDateRange(
  stockDataMap: Map<string, StockData>
): { startDate: string; endDate: string; years: number } {
  let latestStart = "";
  let earliestEnd = "";

  for (const stockData of Array.from(stockDataMap.values())) {
    if (stockData.prices.length === 0) continue;
    const start = stockData.prices[0].date;
    const end = stockData.prices.at(-1)!.date;

    if (!latestStart || start > latestStart) latestStart = start;
    if (!earliestEnd || end < earliestEnd) earliestEnd = end;
  }

  const s = new Date(latestStart);
  const e = new Date(earliestEnd);
  const years =
    (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  return { startDate: latestStart, endDate: earliestEnd, years };
}

/**
 * 날짜 구간 정렬
 */
export function alignStockDataToDateRange(
  stockDataMap: Map<string, StockData>,
  startDate: string,
  endDate: string
): Map<string, StockPrice[]> {
  const aligned = new Map<string, StockPrice[]>();

  for (const [ticker, stock] of Array.from(stockDataMap.entries())) {
    const filtered = stock.prices.filter(
      (p: StockPrice) => p.date >= startDate && p.date <= endDate
    );
    aligned.set(ticker, filtered);
  }
  return aligned;
}
