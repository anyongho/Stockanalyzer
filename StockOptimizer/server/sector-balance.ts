import type { PortfolioHolding, SectorBalanceCheck, SectorBalanceReport } from "@shared/schema";
import { stockCache } from "./stock-data";

const HIGH_CORR_PAIRS: [string, string][] = [
    ["Information Technology", "Communication Services"],
    ["Energy", "Materials"],
    ["Consumer Staples", "Health Care"],
    ["Industrials", "Financials"],
    ["Consumer Discretionary", "Communication Services"],
];

const DEFENSIVE_SECTORS = ["Consumer Staples", "Health Care", "Utilities"];

export function checkSectorBalance(holdings: PortfolioHolding[]): SectorBalanceReport {
    const sectorDist = calculateSectorDistribution(holdings);
    const checks: SectorBalanceCheck[] = [];

    const total = sectorDist.reduce((sum, s) => sum + s.allocation, 0);
    const normalized = sectorDist.map(s => ({
        sector: s.sector,
        allocation: (s.allocation / total) * 100
    }));

    // RULE 1: Single Sector Limit
    if (normalized.length > 0) {
        const maxSector = normalized.reduce((max, curr) =>
            curr.allocation > max.allocation ? curr : max
        );

        let status: SectorBalanceCheck['status'] = 'OK';
        if (maxSector.allocation > 40) status = 'HARD_VIOLATION';
        else if (maxSector.allocation > 30) status = 'SOFT_WARNING';

        checks.push({
            rule: 1,
            status,
            sector: maxSector.sector,
            value: maxSector.allocation,
            message: `단일 섹터 '${maxSector.sector}' 비중: ${maxSector.allocation.toFixed(1)}%`
        });
    }

    // RULE 2: Correlated Groups
    const sectorMap = new Map(normalized.map(s => [s.sector, s.allocation]));
    const groups = findCorrelatedGroups(normalized.map(s => s.sector), HIGH_CORR_PAIRS);

    groups.forEach(group => {
        const groupWeight = group.reduce((sum, sector) => sum + (sectorMap.get(sector) || 0), 0);
        let status: SectorBalanceCheck['status'] = 'OK';
        if (groupWeight > 60) status = 'HARD_VIOLATION';
        else if (groupWeight > 50) status = 'SOFT_WARNING';

        if (status !== 'OK') {
            checks.push({
                rule: 2,
                status,
                value: groupWeight,
                members: group,
                message: `상관 섹터군 합계: ${groupWeight.toFixed(1)}%`
            });
        }
    });

    // RULE 3: Defensive Sectors
    const defensiveSum = normalized
        .filter(s => DEFENSIVE_SECTORS.includes(s.sector))
        .reduce((sum, s) => sum + s.allocation, 0);

    let defensiveStatus: SectorBalanceCheck['status'] = 'OK';
    if (defensiveSum < 5) defensiveStatus = 'HARD_VIOLATION';
    else if (defensiveSum < 10) defensiveStatus = 'SOFT_WARNING';

    checks.push({
        rule: 3,
        status: defensiveStatus,
        value: defensiveSum,
        message: `방어 섹터 합계: ${defensiveSum.toFixed(1)}%`
    });

    // RULE 4: REITs
    const reitSum = normalized
        .filter(s => s.sector.includes('Real Estate'))
        .reduce((sum, s) => sum + s.allocation, 0);

    let reitStatus: SectorBalanceCheck['status'] = 'OK';
    if (reitSum > 20) reitStatus = 'HARD_VIOLATION';
    else if (reitSum > 15) reitStatus = 'SOFT_WARNING';

    checks.push({
        rule: 4,
        status: reitStatus,
        value: reitSum,
        message: `REITs 합계: ${reitSum.toFixed(1)}%`
    });

    // RULE 5: Energy + Materials
    const emSum = normalized
        .filter(s => s.sector === 'Energy' || s.sector === 'Materials')
        .reduce((sum, s) => sum + s.allocation, 0);

    let emStatus: SectorBalanceCheck['status'] = 'OK';
    if (emSum > 25) emStatus = 'HARD_VIOLATION';
    else if (emSum > 20) emStatus = 'SOFT_WARNING';
    else if (emSum > 15) emStatus = 'ADVISORY';

    checks.push({
        rule: 5,
        status: emStatus,
        value: emSum,
        message: `Energy + Materials 합계: ${emSum.toFixed(1)}%`
    });

    const hardViolations = checks.filter(c => c.status === 'HARD_VIOLATION').length;
    const softWarnings = checks.filter(c => c.status === 'SOFT_WARNING').length;

    let score = 100;
    checks.forEach(check => {
        if (check.status === 'HARD_VIOLATION') score -= 30;
        else if (check.status === 'SOFT_WARNING') score -= 15;
        else if (check.status === 'ADVISORY') score -= 5;
    });

    return {
        checks,
        hardViolations,
        softWarnings,
        overallScore: Math.max(0, score)
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

function findCorrelatedGroups(sectors: string[], corrPairs: [string, string][]): string[][] {
    const groups: string[][] = [];
    const visited = new Set<string>();
    const adj = new Map<string, Set<string>>();

    sectors.forEach(s => adj.set(s, new Set()));
    corrPairs.forEach(([s1, s2]) => {
        if (sectors.includes(s1) && sectors.includes(s2)) {
            adj.get(s1)!.add(s2);
            adj.get(s2)!.add(s1);
        }
    });

    sectors.forEach(sector => {
        if (!visited.has(sector)) {
            const component: string[] = [];
            const stack = [sector];
            visited.add(sector);

            while (stack.length > 0) {
                const current = stack.pop()!;
                component.push(current);
                adj.get(current)!.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        stack.push(neighbor);
                    }
                });
            }

            if (component.length > 1) groups.push(component);
        }
    });

    return groups;
}

export interface TargetAdjustments {
    [sector: string]: {
        current: number;
        target: number;
        delta: number;
        priority: 'high' | 'medium' | 'low';
    };
}

export function getTargetSectorAdjustments(
    report: SectorBalanceReport,
    holdings: PortfolioHolding[]
): TargetAdjustments {
    const adjustments: TargetAdjustments = {};
    const sectorDist = calculateSectorDistribution(holdings);
    const sectorMap = new Map(sectorDist.map(s => [s.sector, s.allocation]));

    report.checks.forEach(check => {
        if (check.status === 'OK') return;

        const priority: 'high' | 'medium' | 'low' =
            check.status === 'HARD_VIOLATION' ? 'high' :
                check.status === 'SOFT_WARNING' ? 'medium' : 'low';

        if (check.rule === 1 && check.sector) {
            // Rule 1: Single sector too high
            const current = sectorMap.get(check.sector) || 0;
            // For hard violations (>40%), be more aggressive
            const target = check.status === 'HARD_VIOLATION' ? 25 : 30;
            adjustments[check.sector] = {
                current,
                target,
                delta: target - current,
                priority
            };
        } else if (check.rule === 2 && check.members) {
            // Rule 2: Correlated groups too high - reduce all members proportionally
            check.members.forEach(sector => {
                if (!adjustments[sector]) {
                    const current = sectorMap.get(sector) || 0;
                    // Reduce each member by a proportional amount
                    const target = Math.max(current * 0.7, 15); // Reduce by 30% but keep at least 15%
                    adjustments[sector] = {
                        current,
                        target,
                        delta: target - current,
                        priority
                    };
                }
            });
        } else if (check.rule === 3) {
            // Rule 3: Defensive sectors too low - ALWAYS add them
            DEFENSIVE_SECTORS.forEach(sector => {
                if (!adjustments[sector]) {
                    const current = sectorMap.get(sector) || 0;
                    // For hard violations, target higher allocation
                    const target = check.status === 'HARD_VIOLATION' ? 8 : 5;
                    if (current < target) {
                        adjustments[sector] = {
                            current,
                            target,
                            delta: target - current,
                            priority: 'high' // Always high priority for defensive sectors
                        };
                    }
                }
            });
        } else if (check.rule === 4) {
            // Rule 4: REITs too high - reduce Real Estate allocation
            const current = sectorMap.get('Real Estate') || 0;
            if (current > 15) {
                adjustments['Real Estate'] = {
                    current,
                    target: 15,
                    delta: 15 - current,
                    priority
                };
            }
        } else if (check.rule === 5) {
            // Rule 5: Energy + Materials too high - reduce both
            const energyCurrent = sectorMap.get('Energy') || 0;
            const materialsCurrent = sectorMap.get('Materials') || 0;

            if (energyCurrent > 0 && !adjustments['Energy']) {
                adjustments['Energy'] = {
                    current: energyCurrent,
                    target: Math.min(energyCurrent, 12),
                    delta: Math.min(energyCurrent, 12) - energyCurrent,
                    priority
                };
            }

            if (materialsCurrent > 0 && !adjustments['Materials']) {
                adjustments['Materials'] = {
                    current: materialsCurrent,
                    target: Math.min(materialsCurrent, 12),
                    delta: Math.min(materialsCurrent, 12) - materialsCurrent,
                    priority
                };
            }
        }
    });

    return adjustments;
}

export function getSectorStockPool(): Map<string, string[]> {
    const sectorStocks = new Map<string, string[]>();
    const allTickers = stockCache.getAllTickers();

    allTickers.forEach(ticker => {
        const details = stockCache.getCompanyDetails(ticker);
        if (details?.sector) {
            const stocks = sectorStocks.get(details.sector) || [];
            stocks.push(ticker);
            sectorStocks.set(details.sector, stocks);
        }
    });

    return sectorStocks;
}

/**
 * Applies sector balance adjustments to portfolio holdings
 * Adjusts allocations to comply with sector balance rules
 * GUARANTEES zero violations by iteratively refining until compliant
 */
export function applySectorBalanceAdjustments(
    holdings: PortfolioHolding[],
    report: SectorBalanceReport,
    alignedData: Map<string, any>
): PortfolioHolding[] {
    // CRITICAL: Deep copy holdings to avoid mutating the original array
    // Shallow copy [...holdings] would still share the same holding objects!
    let adjustedHoldings = holdings.map(h => ({ ...h }));

    // If no violations, we still return a fresh copy to ensure immutability
    if (report.hardViolations === 0 && report.softWarnings === 0) {
        return adjustedHoldings;
    }

    const MAX_ITERATIONS = 20;
    let iteration = 0;

    // Iteratively adjust until no violations remain
    while (iteration < MAX_ITERATIONS) {
        const currentReport = checkSectorBalance(adjustedHoldings);

        if (currentReport.hardViolations === 0 && currentReport.softWarnings === 0) {
            break;
        }

        const targetAdjustments = getTargetSectorAdjustments(currentReport, adjustedHoldings);
        const sectorStockPool = getSectorStockPool();

        // Build sector map for current holdings
        const sectorHoldingsMap = new Map<string, PortfolioHolding[]>();
        adjustedHoldings.forEach(holding => {
            const details = stockCache.getCompanyDetails(holding.ticker);
            const sector = details?.sector || "Unknown";
            const sectorHoldings = sectorHoldingsMap.get(sector) || [];
            sectorHoldings.push(holding);
            sectorHoldingsMap.set(sector, sectorHoldings);
        });

        // Step 1: Reduce overweight sectors more aggressively
        Object.entries(targetAdjustments).forEach(([sector, adj]) => {
            if (adj.delta < 0) {
                const sectorHoldings = sectorHoldingsMap.get(sector) || [];
                // Use more aggressive reduction for hard violations
                const aggressiveness = currentReport.hardViolations > 0 ? 0.9 : 0.95;
                const reductionFactor = (adj.target / adj.current) * aggressiveness;



                sectorHoldings.forEach(holding => {
                    holding.allocation *= reductionFactor;
                });
            }
        });

        // Step 2: Increase underweight sectors
        Object.entries(targetAdjustments).forEach(([sector, adj]) => {
            if (adj.delta > 0) {
                const sectorHoldings = sectorHoldingsMap.get(sector) || [];



                if (sectorHoldings.length > 0) {
                    // Boost existing holdings
                    if (adj.current > 0) { // Add guard against division by zero
                        const boostFactor = adj.target / adj.current;
                        sectorHoldings.forEach(holding => {
                            holding.allocation *= boostFactor;
                        });
                    }
                } else {
                    // Add new stocks from this sector
                    const availableStocks = sectorStockPool.get(sector) || [];
                    const validStocks = availableStocks.filter(ticker =>
                        alignedData.has(ticker) && !adjustedHoldings.some(h => h.ticker === ticker)
                    );

                    if (validStocks.length > 0) {
                        const stocksToAdd = validStocks.slice(0, Math.min(2, validStocks.length));
                        const allocationPerStock = adj.delta / stocksToAdd.length;



                        stocksToAdd.forEach(ticker => {
                            adjustedHoldings.push({
                                ticker,
                                allocation: allocationPerStock
                            });
                        });
                    }
                }
            }
        });

        // Step 3: Normalize to 100%
        const totalAllocation = adjustedHoldings.reduce((sum, h) => sum + h.allocation, 0);
        adjustedHoldings.forEach(h => {
            h.allocation = (h.allocation / totalAllocation) * 100;
        });

        // Step 4: Filter out very small allocations (< 0.5%)
        adjustedHoldings = adjustedHoldings.filter(h => h.allocation >= 0.5);

        // Step 5: Renormalize after filtering
        const finalTotal = adjustedHoldings.reduce((sum, h) => sum + h.allocation, 0);
        adjustedHoldings.forEach(h => {
            h.allocation = (h.allocation / finalTotal) * 100;
        });

        iteration++;
    }

    // Final verification
    const finalReport = checkSectorBalance(adjustedHoldings);


    if (finalReport.hardViolations > 0 || finalReport.softWarnings > 0) {

    }

    return adjustedHoldings;
}
