import {
  type PortfolioHolding,
  type OptimizedHolding,
  type OptimizationResult,
  type PortfolioInput,
  type StockPrice,
  type PerformanceMetrics,
} from "@shared/schema";
import { analyzePortfolio, calculatePortfolioValues, calculateMetrics } from "./portfolio-analytics";
import { checkSectorBalance, getTargetSectorAdjustments, getSectorStockPool } from "./sector-balance";
import { stockCache } from "./stock-data";

interface PortfolioCandidate {
  holdings: PortfolioHolding[];
  metrics: PerformanceMetrics;
}

function generateRandomPortfolio(tickers: string[], numHoldings?: number): PortfolioHolding[] {
  const n = numHoldings || tickers.length;
  const selectedTickers = tickers.slice(0, n);

  const weights: number[] = [];
  let sum = 0;

  for (let i = 0; i < selectedTickers.length; i++) {
    const weight = Math.random();
    weights.push(weight);
    sum += weight;
  }

  const normalizedWeights = weights.map((w) => (w / sum) * 100);

  return selectedTickers.map((ticker, i) => ({
    ticker,
    allocation: normalizedWeights[i],
  }));
}

function generateSectorBalancedPortfolio(
  tickers: string[],
  targetAdjustments: ReturnType<typeof getTargetSectorAdjustments>,
  rebalancingStrength: number = 0.5
): PortfolioHolding[] {
  const weights = new Map<string, number>();

  // Initialize with random weights
  tickers.forEach(ticker => {
    weights.set(ticker, Math.random());
  });

  // Apply sector bias
  tickers.forEach(ticker => {
    const details = stockCache.getCompanyDetails(ticker);
    const sector = details?.sector || "Unknown";
    const adjustment = targetAdjustments[sector];

    if (adjustment) {
      const currentWeight = weights.get(ticker)!;
      if (adjustment.delta > 0) {
        // Sector needs more weight - boost this stock
        const boost = 1 + (Math.abs(adjustment.delta) / 100) * rebalancingStrength * 2;
        weights.set(ticker, currentWeight * boost);
      } else if (adjustment.delta < 0) {
        // Sector needs less weight - reduce this stock
        const reduction = 1 - (Math.abs(adjustment.delta) / 100) * rebalancingStrength;
        weights.set(ticker, currentWeight * Math.max(0.1, reduction));
      }
    }
  });

  // Normalize to 100%
  const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  const holdings = Array.from(weights.entries())
    .map(([ticker, weight]) => ({
      ticker,
      allocation: (weight / totalWeight) * 100
    }))
    .filter(h => h.allocation >= 0.5); // Filter out very small allocations

  return holdings;
}

function adjustPortfolioForRisk(
  holdings: PortfolioHolding[],
  riskTolerance: "conservative" | "moderate" | "aggressive"
): PortfolioHolding[] {
  const adjustedHoldings = [...holdings];

  if (riskTolerance === "conservative") {
    const maxAllocation = 30;
    for (const holding of adjustedHoldings) {
      if (holding.allocation > maxAllocation) {
        holding.allocation = maxAllocation;
      }
    }

    const total = adjustedHoldings.reduce((sum, h) => sum + h.allocation, 0);
    adjustedHoldings.forEach((h) => {
      h.allocation = (h.allocation / total) * 100;
    });
  } else if (riskTolerance === "aggressive") {
    const avgAllocation = 100 / adjustedHoldings.length;
    adjustedHoldings.sort((a, b) => b.allocation - a.allocation);

    for (let i = 0; i < Math.min(2, adjustedHoldings.length); i++) {
      adjustedHoldings[i].allocation = Math.max(adjustedHoldings[i].allocation, avgAllocation * 1.5);
    }

    const total = adjustedHoldings.reduce((sum, h) => sum + h.allocation, 0);
    adjustedHoldings.forEach((h) => {
      h.allocation = (h.allocation / total) * 100;
    });
  }

  return adjustedHoldings;
}

export function optimizePortfolio(
  alignedData: Map<string, StockPrice[]>,
  currentHoldings: PortfolioHolding[],
  input: PortfolioInput,
  startDate: string,
  endDate: string,
  years: number
): OptimizationResult {
  const currentAnalysis = analyzePortfolio(
    alignedData,
    currentHoldings,
    startDate,
    endDate,
    years
  );

  let tickers = Array.from(alignedData.keys());
  let targetAdjustments: ReturnType<typeof getTargetSectorAdjustments> = {};
  let sectorBalanceBefore: ReturnType<typeof checkSectorBalance> | undefined;

  // Check if sector rebalancing is enabled
  if (input.rebalanceSectors) {
    console.log('🔄 SECTOR REBALANCING ENABLED');
    sectorBalanceBefore = checkSectorBalance(currentHoldings);

    // Only apply rebalancing if there are violations or warnings
    if (sectorBalanceBefore.hardViolations > 0 || sectorBalanceBefore.softWarnings > 0) {
      console.log(`⚠️  Found ${sectorBalanceBefore.hardViolations} hard violations and ${sectorBalanceBefore.softWarnings} soft warnings`);
      targetAdjustments = getTargetSectorAdjustments(sectorBalanceBefore, currentHoldings);
      console.log('📊 Target sector adjustments:', targetAdjustments);

      // Expand ticker pool with stocks from underweight sectors
      const sectorStockPool = getSectorStockPool();
      const additionalTickers: string[] = [];

      Object.entries(targetAdjustments).forEach(([sector, adj]) => {
        if (adj.delta > 0) {
          // Need more of this sector
          const sectorStocks = sectorStockPool.get(sector) || [];
          const currentTickers = new Set(currentHoldings.map(h => h.ticker));
          const newStocks = sectorStocks
            .filter(t => !currentTickers.has(t) && alignedData.has(t))
            .slice(0, 3); // Add up to 3 new stocks per underweight sector
          additionalTickers.push(...newStocks);
          console.log(`  ➕ Adding stocks for ${sector}: ${newStocks.join(', ')}`);
        }
      });

      if (additionalTickers.length > 0) {
        tickers = [...tickers, ...additionalTickers];
        console.log(`✅ Expanded ticker pool by ${additionalTickers.length} stocks`);
      }
    } else {
      console.log('✅ No sector violations found - sector balance is good');
    }
  } else {
    console.log('❌ Sector rebalancing is DISABLED');
  }

  const candidates: PortfolioCandidate[] = [];
  const numIterations = 500;

  for (let i = 0; i < numIterations; i++) {
    let candidateHoldings: PortfolioHolding[];

    // Use sector-balanced generation if rebalancing is enabled and we have adjustments
    if (input.rebalanceSectors && Object.keys(targetAdjustments).length > 0) {
      candidateHoldings = generateSectorBalancedPortfolio(tickers, targetAdjustments, 0.8);
    } else {
      candidateHoldings = generateRandomPortfolio(tickers);
    }

    candidateHoldings = adjustPortfolioForRisk(candidateHoldings, input.riskTolerance);

    const portfolioValues = calculatePortfolioValues(alignedData, candidateHoldings);
    const metrics = calculateMetrics(portfolioValues, years);

    candidates.push({
      holdings: candidateHoldings,
      metrics,
    });
  }

  let bestCandidate: PortfolioCandidate;

  // If sector rebalancing is enabled, use combined scoring with sector balance as TOP priority
  if (input.rebalanceSectors && Object.keys(targetAdjustments).length > 0) {
    const scoredCandidates = candidates.map(c => {
      const sectorReport = checkSectorBalance(c.holdings);
      const sectorScore = sectorReport.overallScore / 100; // Normalize to 0-1
      const performanceScore = Math.min(c.metrics.sharpeRatio / 3, 1); // Normalize and cap at 1

      // SECTOR BALANCE IS TOP PRIORITY: 80% sector, 20% performance
      const combinedScore = sectorScore * 0.8 + performanceScore * 0.2;

      return { ...c, combinedScore, sectorScore, performanceScore };
    });

    scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);
    bestCandidate = scoredCandidates[0];

    console.log('Sector Rebalancing ENABLED - Top 3 candidates:');
    scoredCandidates.slice(0, 3).forEach((c, i) => {
      console.log(`  ${i + 1}. Combined: ${c.combinedScore.toFixed(3)}, Sector: ${c.sectorScore.toFixed(3)}, Performance: ${c.performanceScore.toFixed(3)}`);
    });
  } else {
    // Original selection logic
    if (input.riskTolerance === "conservative") {
      candidates.sort((a, b) => a.metrics.volatility - b.metrics.volatility);
      bestCandidate = candidates[0];
    } else if (input.riskTolerance === "aggressive") {
      candidates.sort((a, b) => b.metrics.annualizedReturn - a.metrics.annualizedReturn);
      bestCandidate = candidates[0];
    } else {
      candidates.sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
      bestCandidate = candidates[0];
    }
  }

  if (input.targetReturn) {
    const targetFiltered = candidates.filter(
      (c) => Math.abs(c.metrics.annualizedReturn - input.targetReturn!) < 5
    );

    if (targetFiltered.length > 0) {
      targetFiltered.sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
      bestCandidate = targetFiltered[0];
    }
  }

  const optimizedHoldings: OptimizedHolding[] = bestCandidate.holdings.map((holding) => {
    const currentHolding = currentHoldings.find((h) => h.ticker === holding.ticker);
    const currentAllocation = currentHolding?.allocation || 0;
    const change = holding.allocation - currentAllocation;

    return {
      ...holding,
      change,
    };
  });

  const recommendations = generateRecommendations(
    currentHoldings,
    optimizedHoldings,
    input.riskTolerance
  );

  const efficientFrontier = generateEfficientFrontier(
    candidates,
    currentAnalysis.metrics,
    bestCandidate.metrics
  );


  // Calculate sector distribution and balance for optimized portfolio
  const optimizedSectorDist = calculateSectorDistribution(bestCandidate.holdings);
  const optimizedSectorBalance = checkSectorBalance(bestCandidate.holdings);

  return {
    current: currentAnalysis,
    optimized: {
      metrics: bestCandidate.metrics,
      holdings: optimizedHoldings,
      sectorDistribution: optimizedSectorDist,
      sectorBalanceReport: optimizedSectorBalance,
    },
    recommendations,
    efficientFrontier,
    sectorRebalancingApplied: input.rebalanceSectors && Object.keys(targetAdjustments).length > 0,
    currentSectorBalance: sectorBalanceBefore,
  };
}

function calculateSectorDistribution(holdings: PortfolioHolding[]): { sector: string; allocation: number }[] {
  const sectorMap = new Map<string, number>();

  for (const holding of holdings) {
    const details = stockCache.getCompanyDetails(holding.ticker);
    const sector = details?.sector || "Unknown";
    const current = sectorMap.get(sector) || 0;
    sectorMap.set(sector, current + holding.allocation);
  }

  return Array.from(sectorMap.entries())
    .map(([sector, allocation]) => ({ sector, allocation }))
    .sort((a, b) => b.allocation - a.allocation);
}

function generateRecommendations(
  currentHoldings: PortfolioHolding[],
  optimizedHoldings: OptimizedHolding[],
  riskTolerance: "conservative" | "moderate" | "aggressive"
): OptimizationResult["recommendations"] {
  const recommendations: OptimizationResult["recommendations"] = [];

  const allTickersSet = new Set([
    ...currentHoldings.map((h) => h.ticker),
    ...optimizedHoldings.map((h) => h.ticker),
  ]);
  const allTickers = Array.from(allTickersSet);

  for (const ticker of allTickers) {
    const current = currentHoldings.find((h) => h.ticker === ticker);
    const optimized = optimizedHoldings.find((h) => h.ticker === ticker);

    const currentAllocation = current?.allocation || 0;
    const recommendedAllocation = optimized?.allocation || 0;
    const change = recommendedAllocation - currentAllocation;

    if (Math.abs(change) < 1) continue;

    let action = "";
    let rationale = "";

    if (change > 0) {
      action = currentAllocation === 0 ? "Add position" : "Increase allocation";

      if (riskTolerance === "conservative") {
        rationale = "Provides stability and reduces overall portfolio volatility while maintaining growth potential";
      } else if (riskTolerance === "aggressive") {
        rationale = "Offers strong growth potential and enhances overall portfolio returns";
      } else {
        rationale = "Improves risk-adjusted returns and portfolio diversification";
      }
    } else {
      action = recommendedAllocation === 0 ? "Remove position" : "Decrease allocation";

      if (riskTolerance === "conservative") {
        rationale = "Reduces exposure to higher volatility while maintaining diversification";
      } else if (riskTolerance === "aggressive") {
        rationale = "Reallocates capital to higher-performing opportunities";
      } else {
        rationale = "Optimizes allocation for better risk-adjusted returns";
      }
    }

    recommendations.push({
      action,
      ticker,
      currentAllocation,
      recommendedAllocation,
      change,
      rationale,
    });
  }

  recommendations.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return recommendations;
}

function generateEfficientFrontier(
  candidates: PortfolioCandidate[],
  currentMetrics: PerformanceMetrics,
  optimizedMetrics: PerformanceMetrics
): OptimizationResult["efficientFrontier"] {
  const frontierPoints: OptimizationResult["efficientFrontier"] = [];

  const sortedByVolatility = [...candidates].sort(
    (a, b) => a.metrics.volatility - b.metrics.volatility
  );

  const step = Math.max(1, Math.floor(sortedByVolatility.length / 50));

  for (let i = 0; i < sortedByVolatility.length; i += step) {
    const candidate = sortedByVolatility[i];
    frontierPoints.push({
      volatility: candidate.metrics.volatility,
      return: candidate.metrics.annualizedReturn,
    });
  }

  frontierPoints.push({
    volatility: currentMetrics.volatility,
    return: currentMetrics.annualizedReturn,
    isCurrent: true,
  });

  frontierPoints.push({
    volatility: optimizedMetrics.volatility,
    return: optimizedMetrics.annualizedReturn,
    isOptimal: true,
  });

  return frontierPoints;
}
