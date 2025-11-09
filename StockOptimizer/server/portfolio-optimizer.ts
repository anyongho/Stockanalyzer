import {
  type PortfolioHolding,
  type OptimizedHolding,
  type OptimizationResult,
  type PortfolioInput,
  type StockPrice,
  type PerformanceMetrics,
} from "@shared/schema";
import { analyzePortfolio, calculatePortfolioValues, calculateMetrics } from "./portfolio-analytics";

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
  
  const tickers = Array.from(alignedData.keys());
  const candidates: PortfolioCandidate[] = [];
  
  const numIterations = 500;
  
  for (let i = 0; i < numIterations; i++) {
    let candidateHoldings = generateRandomPortfolio(tickers);
    
    candidateHoldings = adjustPortfolioForRisk(candidateHoldings, input.riskTolerance);
    
    const portfolioValues = calculatePortfolioValues(alignedData, candidateHoldings);
    const metrics = calculateMetrics(portfolioValues, years);
    
    candidates.push({
      holdings: candidateHoldings,
      metrics,
    });
  }
  
  let bestCandidate: PortfolioCandidate;
  
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
  
  return {
    current: currentAnalysis,
    optimized: {
      metrics: bestCandidate.metrics,
      holdings: optimizedHoldings,
    },
    recommendations,
    efficientFrontier,
  };
}

function generateRecommendations(
  currentHoldings: PortfolioHolding[],
  optimizedHoldings: OptimizedHolding[],
  riskTolerance: "conservative" | "moderate" | "aggressive"
): OptimizationResult["recommendations"] {
  const recommendations: OptimizationResult["recommendations"] = [];
  
  const allTickers = new Set([
    ...currentHoldings.map((h) => h.ticker),
    ...optimizedHoldings.map((h) => h.ticker),
  ]);
  
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
