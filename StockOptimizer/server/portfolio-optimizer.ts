import {
  type PortfolioHolding,
  type OptimizedHolding,
  type OptimizationResult,
  type PortfolioInput,
  type StockPrice,
  type PerformanceMetrics,
} from "@shared/schema";
import { analyzePortfolio, calculatePortfolioValues, calculateMetrics } from "./portfolio-analytics";
import { checkSectorBalance, getTargetSectorAdjustments, getSectorStockPool, applySectorBalanceAdjustments } from "./sector-balance";
import { stockCache } from "./stock-data";

interface PortfolioCandidate {
  holdings: PortfolioHolding[];
  metrics: PerformanceMetrics;
  sectorScore?: number;
}

function generateRandomPortfolio(
  tickers: string[],
  numHoldings?: number,
  mustInclude: string[] = []
): PortfolioHolding[] {
  // Determine target size: must be at least mustInclude.length
  // If numHoldings is not specified, pick random between mustInclude.length and mustInclude.length + 5
  const minSize = mustInclude.length;
  const targetSize = numHoldings || Math.min(tickers.length, minSize + Math.floor(Math.random() * 5) + 2);

  const selectedSet = new Set(mustInclude);
  const availableTickers = tickers.filter(t => !selectedSet.has(t));

  // Randomly select additional tickers using Fisher-Yates shuffle on available ones
  if (selectedSet.size < targetSize && availableTickers.length > 0) {
    const shuffled = [...availableTickers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const t of shuffled) {
      if (selectedSet.size >= targetSize) break;
      selectedSet.add(t);
    }
  }

  const selectedTickers = Array.from(selectedSet);
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
  rebalancingStrength: number = 0.5,
  mustInclude: string[] = [],
  maxHoldings?: number
): PortfolioHolding[] {
  // If we have too many tickers, select a subset first
  // We want to bias the selection towards sectors that need boosting
  let selectedTickers = tickers;

  // Logic to select subset if universe is large, BUT must include 'mustInclude'
  const effectiveMax = maxHoldings || 30;

  if (tickers.length > effectiveMax) {
    const targetSize = Math.min(tickers.length, Math.max(mustInclude.length + 5, Math.floor(effectiveMax * 0.8) + Math.floor(Math.random() * (effectiveMax * 0.2))));
    const pool: string[] = [];

    // Create a weighted pool for selection
    tickers.forEach(ticker => {
      // Don't add mustInclude to pool, we add them manually later
      if (mustInclude.includes(ticker)) return;

      const details = stockCache.getCompanyDetails(ticker);
      const sector = details?.sector || "Unknown";
      const adjustment = targetAdjustments[sector];

      // Base probability
      pool.push(ticker);

      // If sector needs boosting, add more entries to increase selection chance
      if (adjustment && adjustment.delta > 0) {
        // Add 2 more times for high priority, 1 for others
        const boost = adjustment.priority === 'high' ? 2 : 1;
        for (let i = 0; i < boost; i++) pool.push(ticker);
      }
    });

    // Start with mustInclude
    const selectedSet = new Set<string>(mustInclude);

    // Fill rest from pool
    while (selectedSet.size < targetSize && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      selectedSet.add(pool[idx]);
    }
    selectedTickers = Array.from(selectedSet);
  }

  const weights = new Map<string, number>();

  // Initialize with random weights
  selectedTickers.forEach(ticker => {
    weights.set(ticker, Math.random());
  });

  // Apply sector bias
  selectedTickers.forEach(ticker => {
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
    .filter(h => h.allocation >= 0.5 || mustInclude.includes(h.ticker)); // Keep mustInclude even if small

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

function mutatePortfolio(holdings: PortfolioHolding[], mutationRate: number): PortfolioHolding[] {
  // Clone holdings
  const newHoldings = holdings.map(h => ({ ...h }));

  // Mutate weights slightly
  newHoldings.forEach(h => {
    const change = (Math.random() - 0.5) * mutationRate * h.allocation;
    h.allocation = Math.max(0, h.allocation + change);
  });

  // Normalize
  const total = newHoldings.reduce((sum, h) => sum + h.allocation, 0);
  return newHoldings.map(h => ({
    ...h,
    allocation: (h.allocation / total) * 100
  }));
}

function mutatePortfolioWithSwap(holdings: PortfolioHolding[], universeTickers: string[]): PortfolioHolding[] {
  // Clone holdings
  let newHoldings = holdings.map(h => ({ ...h }));

  // 1. Remove one stock (smallest allocation or random)
  if (newHoldings.length > 5) {
    const removeIdx = Math.floor(Math.random() * newHoldings.length);
    newHoldings.splice(removeIdx, 1);
  }

  // 2. Add one new stock from universe
  const currentTickers = new Set(newHoldings.map(h => h.ticker));
  const available = universeTickers.filter(t => !currentTickers.has(t));

  if (available.length > 0) {
    const newTicker = available[Math.floor(Math.random() * available.length)];
    // Add with average weight
    const avgWeight = 100 / (newHoldings.length + 1);
    newHoldings.push({ ticker: newTicker, allocation: avgWeight });
  }

  // Normalize
  const total = newHoldings.reduce((sum, h) => sum + h.allocation, 0);
  return newHoldings.map(h => ({
    ...h,
    allocation: (h.allocation / total) * 100
  }));
}

export function optimizePortfolio(
  alignedData: Map<string, StockPrice[]>,
  currentHoldings: PortfolioHolding[],
  input: PortfolioInput,
  startDate: string,
  endDate: string,
  years: number
): OptimizationResult {
  // 1. Analyze Original Portfolio (Strictly what the user entered)
  const currentAnalysis = analyzePortfolio(
    alignedData,
    currentHoldings,
    startDate,
    endDate,
    years
  );

  // 2. Apply Sector Rebalancing (Intermediate Step)
  let baseHoldings = currentHoldings;
  let sectorBalanceBefore: ReturnType<typeof checkSectorBalance> | undefined;
  let adjustedHoldings: PortfolioHolding[] | undefined;
  let sectorBalancedAnalysis: ReturnType<typeof analyzePortfolio> | undefined;

  if (input.rebalanceSectors) {
    sectorBalanceBefore = checkSectorBalance(currentHoldings);
    if (sectorBalanceBefore.hardViolations > 0 || sectorBalanceBefore.softWarnings > 0) {
      adjustedHoldings = applySectorBalanceAdjustments(currentHoldings, sectorBalanceBefore, alignedData);
      baseHoldings = adjustedHoldings; // Use adjusted holdings as base for optimization

      // Analyze the intermediate sector-balanced portfolio
      sectorBalancedAnalysis = analyzePortfolio(
        alignedData,
        adjustedHoldings,
        startDate,
        endDate,
        years
      );
    }
  }


  const universeTickers = Array.from(alignedData.keys());

  // Use sector-balanced holdings as the baseline if rebalancing was applied
  // This ensures that stocks added during sector rebalancing are considered for retention
  const baselineForOptimization = (input.rebalanceSectors && adjustedHoldings) ? adjustedHoldings : currentHoldings;
  const baselineTickers = baselineForOptimization.map(h => h.ticker).filter(t => alignedData.has(t));

  // CONSTRAINT: Do not remove existing holdings UNLESS they are performing very poorly.
  // Filter baseline tickers to find "good enough" ones to keep.
  const mustIncludeTickers: string[] = [];

  baselineTickers.forEach(ticker => {
    // Calculate metrics for this single stock
    const singleStockHolding = [{ ticker, allocation: 100 }];
    const singleStockValues = calculatePortfolioValues(alignedData, singleStockHolding);
    const metrics = calculateMetrics(singleStockValues, years);

    // Condition to keep: Sharpe > -0.2 (Allow slightly negative, but remove terrible ones)
    // Also keep if it's the only stock (to avoid empty set issues, though handled elsewhere)
    if (metrics.sharpeRatio > -0.2) {
      mustIncludeTickers.push(ticker);
    }
  });

  // If we filtered out everything (rare), keep the best one at least
  if (mustIncludeTickers.length === 0 && baselineTickers.length > 0) {
    // Find best of the worst
    let bestTicker = baselineTickers[0];
    let bestSharpe = -Infinity;

    baselineTickers.forEach(ticker => {
      const singleStockHolding = [{ ticker, allocation: 100 }];
      const singleStockValues = calculatePortfolioValues(alignedData, singleStockHolding);
      const metrics = calculateMetrics(singleStockValues, years);
      if (metrics.sharpeRatio > bestSharpe) {
        bestSharpe = metrics.sharpeRatio;
        bestTicker = ticker;
      }
    });
    mustIncludeTickers.push(bestTicker);
  }

  // CONSTRAINT: Max size = 2x current size (or reasonable cap)
  const maxHoldingsCount = Math.min(Math.max(baselineTickers.length * 2, 15), 50); // At least 15, max 50, usually 2x current

  let targetAdjustments: ReturnType<typeof getTargetSectorAdjustments> = {};

  // Calculate target adjustments if in rebalancing mode
  if (input.rebalanceSectors && sectorBalanceBefore) {
    targetAdjustments = getTargetSectorAdjustments(sectorBalanceBefore, currentHoldings);
  }

  const candidates: PortfolioCandidate[] = [];
  // Reduce iterations for speed, but use retry logic
  const batchSize = 150;
  const maxRetries = 10; // Allow more retries since we have a time limit now
  let retries = 0;
  let bestCandidateFound = false;
  const startTime = Date.now();
  const TIME_LIMIT_MS = 60000; // 1 minute timeout

  while (retries <= maxRetries && !bestCandidateFound) {
    // Check timeout
    if (Date.now() - startTime > TIME_LIMIT_MS) {
      break;
    }
    // Phase 1: Local Optimization (Current Holdings)
    // Try to optimize weights of existing stocks first
    for (let i = 0; i < batchSize / 2; i++) {
      let candidateHoldings: PortfolioHolding[];

      // STRATEGY: If we have a sector-adjusted portfolio, use it as a strong base.
      // 50% of the time, just mutate the adjusted holdings slightly to find local optima.
      if (input.rebalanceSectors && adjustedHoldings && Math.random() < 0.5) {
        candidateHoldings = mutatePortfolio(adjustedHoldings, 0.1); // 10% mutation
      } else if (input.rebalanceSectors && Object.keys(targetAdjustments).length > 0) {
        candidateHoldings = generateSectorBalancedPortfolio(baselineTickers, targetAdjustments, 0.7, mustIncludeTickers, maxHoldingsCount);
      } else {
        candidateHoldings = generateRandomPortfolio(baselineTickers, undefined, mustIncludeTickers);
      }

      candidateHoldings = adjustPortfolioForRisk(candidateHoldings, input.riskTolerance);
      const portfolioValues = calculatePortfolioValues(alignedData, candidateHoldings);
      const metrics = calculateMetrics(portfolioValues, years);
      const sectorReport = checkSectorBalance(candidateHoldings);

      candidates.push({
        holdings: candidateHoldings,
        metrics,
        sectorScore: sectorReport.overallScore
      });
    }

    // Phase 2: Global Optimization (Universe Search with Constraints)
    // Explore universe but keep mustIncludeTickers and respect maxHoldingsCount
    for (let i = 0; i < batchSize / 2; i++) {
      let candidateHoldings: PortfolioHolding[];

      // Even in global search, if we have a good sector base, try to mix it with new stocks
      if (input.rebalanceSectors && adjustedHoldings && Math.random() < 0.3) {
        // Take adjusted holdings and swap 1-2 stocks
        candidateHoldings = mutatePortfolioWithSwap(adjustedHoldings, universeTickers);
      } else if (input.rebalanceSectors && Object.keys(targetAdjustments).length > 0) {
        // Generate from full universe with sector bias
        candidateHoldings = generateSectorBalancedPortfolio(universeTickers, targetAdjustments, 0.7, mustIncludeTickers, maxHoldingsCount);
      } else {
        // Generate random from full universe
        candidateHoldings = generateRandomPortfolio(universeTickers, maxHoldingsCount, mustIncludeTickers);
      }

      candidateHoldings = adjustPortfolioForRisk(candidateHoldings, input.riskTolerance);
      const portfolioValues = calculatePortfolioValues(alignedData, candidateHoldings);
      const metrics = calculateMetrics(portfolioValues, years);
      const sectorReport = checkSectorBalance(candidateHoldings);

      candidates.push({
        holdings: candidateHoldings,
        metrics,
        sectorScore: sectorReport.overallScore
      });
    }

    // Check if we have a good enough candidate to stop
    // Criteria: 
    // 1. If Target Return set: Found candidate near target (+/- 1%)
    // 2. If Sector Rebalance set: Found candidate with score 100
    // 3. General: Found candidate with Sharpe > Current * 1.1

    let foundGoodEnough = false;

    if (input.targetReturn) {
      const hasTarget = candidates.some(c => Math.abs(c.metrics.annualizedReturn - input.targetReturn!) < 1.5);
      if (hasTarget) foundGoodEnough = true;
    } else if (input.rebalanceSectors) {
      const hasPerfectSector = candidates.some(c => c.sectorScore === 100);
      if (hasPerfectSector) foundGoodEnough = true;
    } else {
      const hasBetterSharpe = candidates.some(c => c.metrics.sharpeRatio > currentAnalysis.metrics.sharpeRatio * 1.1);
      if (hasBetterSharpe) foundGoodEnough = true;
    }

    if (foundGoodEnough) {
      bestCandidateFound = true;
    } else {
      retries++;
    }
  }

  let bestCandidate: PortfolioCandidate;

  // Selection Logic
  // 1. Filter viable candidates (must be at least close to current performance or better)
  // However, if we are in "Target Return" mode, we might accept lower Sharpe if it hits the return target
  let viableCandidates = candidates.filter(c =>
    c.metrics.sharpeRatio >= currentAnalysis.metrics.sharpeRatio * 0.8 // Relaxed tolerance to 20% to allow for strategy shifts
  );

  // If no viable candidates found (rare), just take the top Sharpe ones
  if (viableCandidates.length === 0) {
    viableCandidates = [...candidates].sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio).slice(0, 50);
  }

  // 2. Apply Sector Constraints (if enabled)
  if (input.rebalanceSectors) {
    // Prioritize candidates with perfect sector score
    const compliant = viableCandidates.filter(c => c.sectorScore === 100);
    if (compliant.length > 0) {
      viableCandidates = compliant;
    } else {
      // If no perfect ones, take top 20% by sector score
      viableCandidates.sort((a, b) => (b.sectorScore || 0) - (a.sectorScore || 0));
      const cutoff = Math.max(5, Math.floor(viableCandidates.length * 0.2));
      viableCandidates = viableCandidates.slice(0, cutoff);
    }
  }

  // 3. Apply Target Return Constraint (if enabled)
  if (input.targetReturn) {
    const target = input.targetReturn;
    // Find candidates within 2% of target return
    const nearTarget = viableCandidates.filter(c => Math.abs(c.metrics.annualizedReturn - target) < 2.0);

    if (nearTarget.length > 0) {
      // Sort by lowest volatility
      nearTarget.sort((a, b) => a.metrics.volatility - b.metrics.volatility);
      bestCandidate = nearTarget[0];
    } else {
      // Find closest
      viableCandidates.sort((a, b) =>
        Math.abs(a.metrics.annualizedReturn - target) - Math.abs(b.metrics.annualizedReturn - target)
      );
      bestCandidate = viableCandidates[0];
    }
  } else {
    // Standard Optimization (Maximize Sharpe / Minimize Vol / Max Return)
    if (input.riskTolerance === "conservative") {
      viableCandidates.sort((a, b) => a.metrics.volatility - b.metrics.volatility);
    } else if (input.riskTolerance === "aggressive") {
      viableCandidates.sort((a, b) => b.metrics.annualizedReturn - a.metrics.annualizedReturn);
    } else {
      // Moderate: Maximize Sharpe
      viableCandidates.sort((a, b) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
    }
    bestCandidate = viableCandidates[0];
  }

  // Calculate optimized holdings with proper change baseline
  // If sector rebalancing was applied, changes should be relative to the sector-balanced portfolio
  // Otherwise, changes are relative to the original portfolio
  const baselineHoldings = (input.rebalanceSectors && adjustedHoldings) ? adjustedHoldings : currentHoldings;

  const optimizedHoldings: OptimizedHolding[] = bestCandidate.holdings.map((holding) => {
    const baselineHolding = baselineHoldings.find((h) => h.ticker === holding.ticker);
    const baselineAllocation = baselineHolding?.allocation || 0;
    const change = holding.allocation - baselineAllocation;

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

  // Find sector-compliant portfolio for efficient frontier marking (if rebalancing enabled)
  let sectorCompliantCandidate: PortfolioCandidate | undefined;
  if (input.rebalanceSectors && adjustedHoldings) {
    // The sector-adjusted portfolio IS the sector-compliant one
    sectorCompliantCandidate = {
      holdings: adjustedHoldings,
      metrics: sectorBalancedAnalysis ? sectorBalancedAnalysis.metrics : currentAnalysis.metrics
    };
  }

  const efficientFrontier = generateEfficientFrontier(
    candidates,
    currentAnalysis.metrics,
    bestCandidate.metrics,
    sectorCompliantCandidate?.metrics
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
    sectorRebalancingApplied: input.rebalanceSectors && adjustedHoldings !== undefined,
    currentSectorBalance: sectorBalanceBefore,
    sectorAdjustedHoldings: adjustedHoldings, // NEW: Include the sector-adjusted holdings
    sectorBalancedPortfolio: sectorBalancedAnalysis // NEW: Return the full analysis of the sector-balanced portfolio
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
  optimizedMetrics: PerformanceMetrics,
  sectorCompliantMetrics?: PerformanceMetrics
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

  // Add sector-compliant portfolio marker if available
  if (sectorCompliantMetrics) {
    frontierPoints.push({
      volatility: sectorCompliantMetrics.volatility,
      return: sectorCompliantMetrics.annualizedReturn,
      isSectorCompliant: true,
    });
  }

  return frontierPoints;
}
