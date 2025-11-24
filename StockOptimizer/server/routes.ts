import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { portfolioInputSchema, type PortfolioInput } from "@shared/schema";
import {
  fetchMultipleStocks,
  getCommonDateRange,
  alignStockDataToDateRange,
} from "./stock-data";
import { analyzePortfolio, calculatePortfolioValues, calculateMetrics, calculateYearlyReturns } from "./portfolio-analytics";
import { optimizePortfolio } from "./portfolio-optimizer";
import { checkSectorBalance, applySectorBalanceAdjustments } from "./sector-balance";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/tickers", async (_req, res) => {
    try {
      // Import stockCache dynamically to ensure it's initialized or we can access the instance
      const { stockCache } = await import("./stock-data");

      // Ensure cache is initialized
      if (!stockCache.getAllTickers().length) {
        await stockCache.initialize();
      }

      const companies = stockCache.getAllCompanyDetails();

      // If we have company metadata, return it
      if (companies.length > 0) {
        return res.json({ companies });
      }

      // Fallback to just tickers if no metadata
      const tickers = stockCache.getAllTickers().sort();
      return res.json({ tickers: tickers.map(t => ({ ticker: t, name: t, description: "" })) });
    } catch (error) {
      console.error("Error fetching tickers:", error);
      return res.status(500).json({ error: "Failed to fetch tickers" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const validationResult = portfolioInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid portfolio input",
          details: validationResult.error.errors,
        });
      }

      const input: PortfolioInput = validationResult.data;
      const BENCHMARK_TICKER = "^GSPC";
      const RF_TICKER = "^IRX";
      const allTickers = Array.from(new Set([
        ...input.holdings.map((h) => h.ticker),
        BENCHMARK_TICKER,
        RF_TICKER,
      ]));

      const stockDataMap = await fetchMultipleStocks(allTickers, 5);



      if (stockDataMap.size === 0) {
        return res.status(404).json({
          error: "No stock data found for provided tickers",
        });
      }

      const missingTickers = allTickers.filter((t) => !stockDataMap.has(t.toUpperCase()));
      if (missingTickers.length > 0) {
        return res.status(404).json({
          error: "Some tickers could not be found",
          missingTickers,
        });
      }

      const { startDate, endDate, years } = getCommonDateRange(stockDataMap);
      if (years < 0.1) {
        return res.status(400).json({
          error: "Insufficient historical data",
        });
      }
      const alignedData = alignStockDataToDateRange(stockDataMap, startDate, endDate);




      const portfolioValues = calculatePortfolioValues(alignedData, input.holdings);


      const benchmarkValues = calculatePortfolioValues(
        alignedData,
        [{ ticker: BENCHMARK_TICKER, allocation: 100 }]
      );


      if (benchmarkValues.length === 0) {
        console.warn("Benchmark values are empty after calculation.");
      }
      const rfData = stockDataMap.get(RF_TICKER);

      const benchmarkMetrics = calculateMetrics(benchmarkValues, years, rfData, benchmarkValues);
      const portfolioMetrics = calculateMetrics(portfolioValues, years, rfData, benchmarkValues);

      // Use analyzePortfolio to get complete analysis including sectorDistribution
      const portfolioAnalysis = analyzePortfolio(
        alignedData,
        input.holdings,
        startDate,
        endDate,
        years,
        rfData ? { prices: rfData.prices } : undefined,
        benchmarkValues
      );

      const chartData = [];
      for (let i = 0; i < portfolioValues.length; i++) {
        chartData.push({
          date: portfolioValues[i].date,
          portfolio: portfolioValues[i].value,
          benchmark: benchmarkValues[i]?.value ?? null,
        });
      }

      // Apply sector balance adjustments if enabled
      let adjustedHoldings = undefined;
      let sectorBalanceReport = undefined;

      if (input.rebalanceSectors) {

        sectorBalanceReport = checkSectorBalance(input.holdings);

        if (sectorBalanceReport.hardViolations > 0 || sectorBalanceReport.softWarnings > 0) {

          adjustedHoldings = applySectorBalanceAdjustments(input.holdings, sectorBalanceReport, alignedData);
        } else {

        }
      }

      return res.json({
        success: true,
        analysis: {
          ...portfolioAnalysis,
          portfolio: {
            values: portfolioValues,
            metrics: portfolioMetrics,
            yearlyReturns: calculateYearlyReturns(portfolioValues),
          },
          benchmark: {
            ticker: BENCHMARK_TICKER,
            values: benchmarkValues,
            metrics: benchmarkMetrics,
            yearlyReturns: calculateYearlyReturns(benchmarkValues),
          },
          chartData,
          adjustedHoldings,
          sectorBalanceReport,
        }
      });
    } catch (error) {
      console.error("Analysis error:", error);
      return res.status(500).json({
        error: "Internal server error during portfolio analysis",
      });
    }
  });

  app.post("/api/optimize", async (req, res) => {
    try {
      const validationResult = portfolioInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid portfolio input",
          details: validationResult.error.errors,
        });
      }
      const input: PortfolioInput = validationResult.data;
      // Use ALL available tickers for optimization to allow adding new stocks
      // The stockCache is already initialized by fetchMultipleStocks if needed, 
      // but let's make sure we get everything.
      const { stockCache } = await import("./stock-data");
      if (!stockCache.getAllTickers().length) {
        await stockCache.initialize();
      }

      const allTickers = stockCache.getAllTickers();
      const stockDataMap = await fetchMultipleStocks(allTickers, 5);

      if (stockDataMap.size === 0) {
        return res.status(404).json({
          error: "No stock data found",
        });
      }

      // We don't need to check for missing tickers from input because we are using the source of truth
      const missingTickers: string[] = [];

      // 1. Determine the time range based on CURRENT HOLDINGS (or benchmark)
      // This ensures we optimize for the period relevant to the user's portfolio
      // instead of being limited by the shortest history in the entire universe.
      const holdingTickers = input.holdings.map(h => h.ticker);
      const holdingsDataMap = new Map<string, any>();

      // Always include benchmark for date range calculation if holdings are empty or weird
      const BENCHMARK_TICKER = "^GSPC";
      if (holdingTickers.length === 0) {
        holdingTickers.push(BENCHMARK_TICKER);
      }

      holdingTickers.forEach(t => {
        const data = stockDataMap.get(t.toUpperCase());
        if (data) holdingsDataMap.set(t.toUpperCase(), data);
      });

      // If we still have no data (e.g. invalid tickers), fallback to everything
      const rangeSourceMap = holdingsDataMap.size > 0 ? holdingsDataMap : stockDataMap;

      const { startDate, endDate, years } = getCommonDateRange(rangeSourceMap);

      if (years < 0.1) {
        return res.status(400).json({
          error: "Insufficient historical data",
          details: "Could not establish a valid date range from current holdings."
        });
      }

      // 2. Filter the universe to only include stocks that cover this range
      // This prevents "Insufficient historical data" errors when aligning
      const validStockDataMap = new Map<string, any>();

      for (const [ticker, data] of Array.from(stockDataMap.entries())) {
        // Check if stock has data covering the range (with some tolerance)
        const stockStart = data.prices[0]?.date;
        const stockEnd = data.prices.at(-1)?.date;

        if (stockStart && stockEnd && stockStart <= startDate && stockEnd >= endDate) {
          validStockDataMap.set(ticker, data);
        }
      }

      const alignedData = alignStockDataToDateRange(validStockDataMap, startDate, endDate);

      const optimizationResult = optimizePortfolio(
        alignedData,
        input.holdings,
        input,
        startDate,
        endDate,
        years
      );
      return res.json(optimizationResult);
    } catch (error) {
      console.error("Optimization error:", error);
      return res.status(500).json({
        error: "Internal server error during portfolio optimization",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
