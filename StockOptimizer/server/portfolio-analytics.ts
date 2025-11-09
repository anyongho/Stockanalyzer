import {
  type PortfolioHolding,
  type PortfolioAnalysis,
  type PerformanceMetrics,
  type YearlyReturn,
  type StockPrice,
} from "@shared/schema";

interface DailyPortfolioValue {
  date: string;
  value: number;
}

function calculateDailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

function mean(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const varSum = values.reduce((sum, val) => sum + (val - avg) ** 2, 0);
  return Math.sqrt(varSum / (values.length - 1));
}

function downsideDeviation(returns: number[], rf: number): number {
  const downside = returns.filter(r => r * 100 < rf);
  if (downside.length === 0) return 0;
  const downsideMean = mean(downside.map(r => ((r * 100) - rf) ** 2));
  return Math.sqrt(downsideMean);
}

function cov(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  return mean(x.map((v, i) => (v - mx) * (y[i] - my)));
}

function variance(x: number[]): number {
  const m = mean(x);
  return mean(x.map(v => (v - m) ** 2));
}

export function calculateRiskReturnMetrics(
  portfolioValues: DailyPortfolioValue[],
  benchmarkValues: DailyPortfolioValue[],
  years: number,
  rfAnnual: number = 2
) {
  const port = portfolioValues.map(v => v.value);
  const bench = benchmarkValues.map(v => v.value);
  if (port.length < 2 || bench.length !== port.length) {
    console.warn("Portfolio and benchmark length mismatch or too short", port.length, bench.length);
    return {};
  }
console.log("Portfolio values length:", portfolioValues.length);
console.log("Benchmark values length:", benchmarkValues.length);
  const portRet = calculateDailyReturns(port);
  const benchRet = calculateDailyReturns(bench);
console.log("Sample portfolio returns:", portRet.slice(0, 5));
console.log("Sample benchmark returns:", benchRet.slice(0, 5));

  if (portRet.length !== benchRet.length) {
    const len = Math.min(portRet.length, benchRet.length);
    portRet.splice(len);
    benchRet.splice(len);
    console.warn("Aligned returns length", portRet.length, benchRet.length);
  }

  console.log("Sample portfolio returns:", portRet.slice(0, 5));
  console.log("Sample benchmark returns:", benchRet.slice(0, 5));

  const avgRf = rfAnnual / 100 / 252;
  const avgPort = mean(portRet);
  const avgBench = mean(benchRet);

  const varBench = variance(benchRet);
  if (varBench === 0) {
    console.warn("Variance of benchmark is zero!");
    return {};
  }

  const covVal = cov(portRet, benchRet);
  console.log("Covariance:", covVal, "Variance:", varBench);

console.log("Covariance:", covVal, "Benchmark Variance:", varBench);

  let beta = covVal / varBench;

  if (!isFinite(beta)) {
    console.warn("Beta calculation resulted in infinity or NaN");
    beta = 0;
  }

  const alpha = (avgPort - avgRf) - beta * (avgBench - avgRf);

  const portExcess = portRet.map(r => r - avgRf);
  const benchExcess = benchRet.map(r => r - avgRf);

  const trackingErrorVector = portExcess.map((r, i) => r - benchExcess[i]);
  const trackingErrorStd = standardDeviation(trackingErrorVector);
  const trackingError = trackingErrorStd * Math.sqrt(252) * 100;

  const informationRatio = trackingError > 0 
    ? ((mean(portRet) - mean(benchRet)) * 252 * 100) / trackingError 
    : 0;

  const rSquare = 
    (varBench > 0 && variance(portRet) > 0) 
    ? (covVal ** 2) / (varBench * variance(portRet)) 
    : 0;

  console.log("Beta:", beta, "Alpha:", alpha, "Information Ratio:", informationRatio, "Tracking Error:", trackingError, "R²:", rSquare);

  return {
    beta,
    alpha: alpha * 252 * 100,
    informationRatio,
    trackingError,
    rSquare,
  };
}

export function calculatePortfolioValues(
  alignedData: Map<string, StockPrice[]>,
  holdings: PortfolioHolding[]
): DailyPortfolioValue[] {
  const allDates = new Set<string>();
  for (const prices of alignedData.values()) {
    prices.forEach((p) => allDates.add(p.date));
  }
  const sortedDates = Array.from(allDates).sort();
  const portfolioValues: DailyPortfolioValue[] = [];
  const initialValue = 10000;

  const initialPrices = new Map<string, number>();
  for (const [ticker, prices] of alignedData.entries()) {
    if (prices.length > 0) initialPrices.set(ticker, prices[0].adjClose);
  }

  const shares = new Map<string, number>();
  for (const holding of holdings) {
    const initialPrice = initialPrices.get(holding.ticker);
    if (initialPrice) {
      const investAmt = initialValue * (holding.allocation / 100);
      shares.set(holding.ticker, investAmt / initialPrice);
    }
  }

  for (const date of sortedDates) {
    let totalValue = 0;
    for (const holding of holdings) {
      const priceSeries = alignedData.get(holding.ticker);
      if (!priceSeries || priceSeries.length === 0) continue;
      const priceOnDate =
        priceSeries.find((p) => p.date === date) ||
        priceSeries.slice().reverse().find((p) => p.date < date);
      if (priceOnDate && shares.has(holding.ticker)) {
        totalValue += shares.get(holding.ticker)! * priceOnDate.adjClose;
      }
    }
    if (totalValue > 0) portfolioValues.push({ date, value: totalValue });
  }
  return portfolioValues;
}

export function calculateMetrics(
	
  portfolioValues: DailyPortfolioValue[],
  years: number,
  rfData?: { prices: StockPrice[] },
  benchmarkValues?: DailyPortfolioValue[]
): PerformanceMetrics {
  if (portfolioValues.length < 2) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      bestYear: 0,
      worstYear: 0,
      positiveYears: 0,
      negativeYears: 0,
      sortinoRatio: 0,
      downsideDeviation: 0,
      beta: 0,
      alpha: 0,
      informationRatio: 0,
      trackingError: 0,
      rSquare: 0,
    };
  }
  const initialVal = portfolioValues[0].value;
  const finalVal = portfolioValues.at(-1)!.value;
  const totalReturn = ((finalVal - initialVal) / initialVal) * 100;
  const annualizedReturn = (Math.pow(finalVal / initialVal, 1 / years) - 1) * 100;

  const dailyReturns = calculateDailyReturns(portfolioValues.map((p) => p.value));
  const dailyVolatility = standardDeviation(dailyReturns);
  const volatility = dailyVolatility * Math.sqrt(252) * 100;

  let riskFreeRate = 2.0;
  if (rfData && rfData.prices.length > 0) {
    const avgRf = mean(rfData.prices.map(p => p.adjClose));
    riskFreeRate = avgRf;
  }
  const excessReturn = annualizedReturn - riskFreeRate;
  const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;

  const downsideDev = downsideDeviation(dailyReturns, riskFreeRate / 252);
  const sortinoRatio = downsideDev > 0
    ? ((annualizedReturn - riskFreeRate) / (downsideDev * Math.sqrt(252)))
    : 0;

  let maxDrawdown = 0;
  let peak = portfolioValues[0].value;
  for (const pv of portfolioValues) {
    if (pv.value > peak) peak = pv.value;
    const drawdown = ((pv.value - peak) / peak) * 100;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }

  const yearlyReturns = calculateYearlyReturns(portfolioValues);
  const bestYear =
    yearlyReturns.length > 0
      ? Math.max(...yearlyReturns.map((yr) => yr.return))
      : 0;
  const worstYear =
    yearlyReturns.length > 0
      ? Math.min(...yearlyReturns.map((yr) => yr.return))
      : 0;
  const positiveYears = yearlyReturns.filter((yr) => yr.return > 0).length;
  const negativeYears = yearlyReturns.filter((yr) => yr.return <= 0).length;

  let beta = 0, alpha = 0, informationRatio = 0, trackingError = 0, rSquare = 0;
console.log("PortfolioValues length:", portfolioValues.length);
console.log("BenchmarkValues length:", benchmarkValues?.length);
  if (benchmarkValues && benchmarkValues.length === portfolioValues.length) {
    const riskMetrics = calculateRiskReturnMetrics(portfolioValues, benchmarkValues, years, riskFreeRate);
    console.log("Risk metrics:", riskMetrics);
    beta = riskMetrics.beta || 0;
    alpha = riskMetrics.alpha || 0;
    informationRatio = riskMetrics.informationRatio || 0;
    trackingError = riskMetrics.trackingError || 0;
    rSquare = riskMetrics.rSquare || 0;
  } else {
    console.warn("Benchmark and portfolio length mismatch", benchmarkValues?.length, portfolioValues.length);
  }

  return {
    totalReturn,
    annualizedReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
    bestYear,
    worstYear,
    positiveYears,
    negativeYears,
    sortinoRatio,
    downsideDeviation: downsideDev,
    beta,
    alpha,
    informationRatio,
    trackingError,
    rSquare,
  };
}

export function calculateYearlyReturns(
  portfolioValues: DailyPortfolioValue[]
): YearlyReturn[] {
  const yearlyMap = new Map<number, { start: number; end: number }>();
  for (const pv of portfolioValues) {
    const year = new Date(pv.date).getFullYear();
    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, { start: pv.value, end: pv.value });
    } else {
      yearlyMap.get(year)!.end = pv.value;
    }
  }
  const yearlyReturns: YearlyReturn[] = [];
  for (const [year, { start, end }] of yearlyMap) {
    const ret = ((end - start) / start) * 100;
    yearlyReturns.push({ year, return: ret });
  }
  return yearlyReturns.sort((a, b) => a.year - b.year);
}

export function calculateDrawdowns(
  portfolioValues: DailyPortfolioValue[]
): { date: string; drawdown: number }[] {
  const drawdowns: { date: string; drawdown: number }[] = [];
  let peak = portfolioValues[0]?.value ?? 0;
  for (const pv of portfolioValues) {
    if (pv.value > peak) peak = pv.value;
    const drop = ((pv.value - peak) / peak) * 100;
    drawdowns.push({ date: pv.date, drawdown: drop });
  }
  return drawdowns;
}

export function analyzePortfolio(
  alignedData: Map<string, StockPrice[]>,
  holdings: PortfolioHolding[],
  startDate: string,
  endDate: string,
  years: number,
  rfData?: { prices: StockPrice[] },
  benchmarkValues?: DailyPortfolioValue[]
): PortfolioAnalysis {
  const portfolioValues = calculatePortfolioValues(alignedData, holdings);
  const metrics = calculateMetrics(portfolioValues, years, rfData, benchmarkValues);
  const yearlyReturns = calculateYearlyReturns(portfolioValues);
  const drawdowns = calculateDrawdowns(portfolioValues);

  return {
    metrics,
    portfolioValues,
    yearlyReturns,
    drawdowns,
    holdings,
    startDate,
    endDate,
    periodYears: years,
  };
}
