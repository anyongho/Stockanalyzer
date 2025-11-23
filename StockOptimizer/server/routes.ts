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

      console.log("Fetched stockDataMap ticker keys:", Array.from(stockDataMap.keys()));

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

      console.log("AlignedData keys after alignment:", Array.from(alignedData.keys()));
      if (!alignedData.has(BENCHMARK_TICKER)) {
        console.warn(`Aligned data does not contain benchmark ticker: ${BENCHMARK_TICKER}`);
      }

      const portfolioValues = calculatePortfolioValues(alignedData, input.holdings);
      console.log("Portfolio values length:", portfolioValues.length);

      const benchmarkValues = calculatePortfolioValues(
        alignedData,
        [{ ticker: BENCHMARK_TICKER, allocation: 100 }]
      );

      console.log("Benchmark values length:", benchmarkValues.length);
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
      const tickers = input.holdings.map((h) => h.ticker);

      const stockDataMap = await fetchMultipleStocks(tickers, 5);

      if (stockDataMap.size === 0) {
        return res.status(404).json({
          error: "No stock data found for provided tickers",
        });
      }

      const missingTickers = tickers.filter((t) => !stockDataMap.has(t.toUpperCase()));
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
