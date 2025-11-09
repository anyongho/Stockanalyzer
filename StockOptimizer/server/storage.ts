import { type StockData, type StockPrice } from "@shared/schema";

export interface IStorage {
  getStockData(ticker: string): Promise<StockData | undefined>;
  setStockData(ticker: string, data: StockData): Promise<void>;
  getAllCachedTickers(): Promise<string[]>;
}

export class MemStorage implements IStorage {
  private stockDataCache: Map<string, StockData>;

  constructor() {
    this.stockDataCache = new Map();
  }

  async getStockData(ticker: string): Promise<StockData | undefined> {
    return this.stockDataCache.get(ticker.toUpperCase());
  }

  async setStockData(ticker: string, data: StockData): Promise<void> {
    this.stockDataCache.set(ticker.toUpperCase(), data);
  }

  async getAllCachedTickers(): Promise<string[]> {
    return Array.from(this.stockDataCache.keys());
  }
}

export const storage = new MemStorage();
