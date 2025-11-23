import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const portfolioHoldingSchema = z.object({
  ticker: z.string().min(1, "Ticker is required").toUpperCase(),
  allocation: z.number().min(0, "Allocation must be positive"),
});

export type PortfolioHolding = z.infer<typeof portfolioHoldingSchema>;

export const portfolioInputSchema = z.object({
  holdings: z.array(portfolioHoldingSchema).min(1, "At least one holding is required"),
  targetReturn: z.number().min(1).max(100).optional(),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  rebalanceSectors: z.boolean().optional(),
});

export type PortfolioInput = z.infer<typeof portfolioInputSchema>;

export const insertPortfolioInputSchema = portfolioInputSchema;
export type InsertPortfolioInput = z.infer<typeof insertPortfolioInputSchema>;

export interface StockPrice {
  date: string;
  adjClose: number;
}

export interface StockData {
  ticker: string;
  prices: StockPrice[];
  name?: string;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  bestYear: number;
  worstYear: number;
  positiveYears: number;
  negativeYears: number;
  sortinoRatio: number;
  downsideDeviation: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  rSquare: number;
}

export interface YearlyReturn {
  year: number;
  return: number;
}

export interface SectorDistribution {
  sector: string;
  allocation: number;
}

export interface SectorBalanceCheck {
  rule: number;
  status: 'OK' | 'ADVISORY' | 'SOFT_WARNING' | 'HARD_VIOLATION';
  sector?: string;
  value: number;
  message: string;
  members?: string[];
}

export interface SectorBalanceReport {
  checks: SectorBalanceCheck[];
  hardViolations: number;
  softWarnings: number;
  overallScore: number;
}

export interface PortfolioAnalysis {
  metrics: PerformanceMetrics;
  portfolioValues: { date: string; value: number }[];
  drawdowns: { date: string; drawdown: number }[];
  yearlyReturns: YearlyReturn[];
  holdings: PortfolioHolding[];
  sectorDistribution: SectorDistribution[];
  startDate: string;
  endDate: string;
  periodYears: number;
}

export interface OptimizedHolding extends PortfolioHolding {
  change: number;
}

export interface OptimizationResult {
  current: PortfolioAnalysis;
  optimized: {
    metrics: PerformanceMetrics;
    holdings: OptimizedHolding[];
    sectorDistribution?: SectorDistribution[];
    sectorBalanceReport?: SectorBalanceReport;
  };
  recommendations: {
    action: string;
    ticker: string;
    currentAllocation: number;
    recommendedAllocation: number;
    change: number;
    rationale: string;
  }[];
  efficientFrontier: {
    volatility: number;
    return: number;
    isOptimal?: boolean;
    isCurrent?: boolean;
  }[];
  sectorRebalancingApplied?: boolean;
  currentSectorBalance?: SectorBalanceReport;
}
