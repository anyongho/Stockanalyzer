import { type StockData, type StockPrice } from "@shared/schema";
import { storage } from "./storage";
import * as fs from "fs";
import path from "path";

// ESM 환경에서는 xlsx/xlsx.mjs 경로 사용
import * as XLSX from "xlsx/xlsx.mjs";
XLSX.set_fs(fs);

// Node.js에서 __dirname 대체
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Excel 파일 경로 (루트에 넣었으면 ../로 한 단계 위)
const EXCEL_PATH = path.resolve(__dirname, "../SP500_AdjustedClose_5Y.xlsx");

/**
 * Excel에서 특정 티커 데이터 로드
 */
export async function fetchStockData(
  ticker: string,
  yearsNeeded: number = 5
): Promise<StockData | null> {
  const upperTicker = ticker.toUpperCase();

  try {
    console.log(`🟡 [Excel] Loading ${upperTicker} from`, EXCEL_PATH);
    if (!fs.existsSync(EXCEL_PATH)) {
      throw new Error(`Excel file not found at ${EXCEL_PATH}`);
    }

    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheet = workbook.Sheets[upperTicker];
    if (!sheet) {
      console.warn(`⚠️ [Excel] ${upperTicker} 시트를 찾을 수 없습니다`);
      return null;
    }

    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    // ✅ Date 필드가 Excel Serial Number로 되어있는 경우 parse_date_code()로 변환
    const prices: StockPrice[] = jsonData
      .filter((row) => row["Adj Close"])
      .map((row) => {
        let dateValue: string;
        if (typeof row["Date"] === "number") {
          // Excel Date Serial → Year/Month/Day 변환
          const parsed = XLSX.SSF.parse_date_code(row["Date"]);
          dateValue = new Date(parsed.y, parsed.m - 1, parsed.d)
            .toISOString()
            .split("T")[0];
        } else {
          // 문자열 형식일 경우 그대로 사용
          dateValue = new Date(row["Date"]).toISOString().split("T")[0];
        }
        return {
          date: dateValue,
          adjClose: Number(row["Adj Close"]),
        };
      })
      .filter((p) => !!p.date && p.date !== "Invalid" && !isNaN(p.adjClose));

    if (prices.length === 0) {
      console.warn(`⚠️ [Excel] ${upperTicker} 데이터가 비어있습니다`);
      return null;
    }

    const stockData: StockData = {
      ticker: upperTicker,
      name: upperTicker,
      prices,
    };

    await storage.setStockData(upperTicker, stockData);
    console.log(
      `✅ [Excel] ${upperTicker} (${prices.length}건) 불러오기 완료 |
       ${prices[0].date} → ${prices.at(-1)?.date}`
    );

    return stockData;
  } catch (error) {
    console.error(`❌ [Excel] ${ticker} 데이터 불러오기 실패:`, error);
    return null;
  }
}

/**
 * 여러 종목을 Excel에서 병렬로 불러오기
 */
export async function fetchMultipleStocks(
  tickers: string[],
  years: number = 5
): Promise<Map<string, StockData>> {
  const results = new Map<string, StockData>();

  for (const ticker of tickers) {
    const result = await fetchStockData(ticker, years);
    if (result) results.set(ticker.toUpperCase(), result);
    else console.warn(`⚠️ [Excel] ${ticker} 불러오기 실패`);
  }

  console.log(`📦 [Excel] Completed: ${results.size}/${tickers.length} 로드됨`);
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

  for (const stockData of stockDataMap.values()) {
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

  for (const [ticker, stock] of stockDataMap.entries()) {
    const filtered = stock.prices.filter(
      (p) => p.date >= startDate && p.date <= endDate
    );
    aligned.set(ticker, filtered);
  }
  return aligned;
}
