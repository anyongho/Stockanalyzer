import type { SectorDistribution, SectorBalanceCheck, SectorBalanceReport } from "@shared/schema";

const HIGH_CORR_PAIRS: [string, string][] = [
    ["Information Technology", "Communication Services"],
    ["Energy", "Materials"],
    ["Consumer Staples", "Health Care"],
    ["Industrials", "Financials"],
    ["Consumer Discretionary", "Communication Services"],
];

const DEFENSIVE_SECTORS = ["Consumer Staples", "Health Care", "Utilities"];

export function checkSectorBalance(sectorDistribution: SectorDistribution[]): SectorBalanceReport {
    const checks: SectorBalanceCheck[] = [];

    const total = sectorDistribution.reduce((sum, s) => sum + s.allocation, 0);
    const normalized = sectorDistribution.map(s => ({
        sector: s.sector,
        allocation: (s.allocation / total) * 100
    }));

    // RULE 1: Single Sector Limit
    const maxSector = normalized.reduce((max, curr) =>
        curr.allocation > max.allocation ? curr : max
        , normalized[0]);

    let status: SectorBalanceCheck['status'] = 'OK';
    if (maxSector.allocation > 40) {
        status = 'HARD_VIOLATION';
    } else if (maxSector.allocation > 30) {
        status = 'SOFT_WARNING';
    }

    checks.push({
        rule: 1,
        status,
        sector: maxSector.sector,
        value: maxSector.allocation,
        message: `단일 섹터 '${maxSector.sector}' 비중: ${maxSector.allocation.toFixed(1)}% (권장 상한: 40%)`
    });

    // RULE 2: Correlated Sector Groups
    const sectorMap = new Map(normalized.map(s => [s.sector, s.allocation]));
    const correlatedGroups = findCorrelatedGroups(normalized, HIGH_CORR_PAIRS);

    correlatedGroups.forEach(group => {
        const groupWeight = group.members.reduce((sum, sector) =>
            sum + (sectorMap.get(sector) || 0), 0
        );

        let groupStatus: SectorBalanceCheck['status'] = 'OK';
        if (groupWeight > 60) {
            groupStatus = 'HARD_VIOLATION';
        } else if (groupWeight > 50) {
            groupStatus = 'SOFT_WARNING';
        }

        if (groupStatus !== 'OK') {
            checks.push({
                rule: 2,
                status: groupStatus,
                value: groupWeight,
                members: group.members,
                message: `상관 섹터군 [${group.members.join(', ')}] 합계: ${groupWeight.toFixed(1)}% (권장 상한: 60%)`
            });
        }
    });

    // RULE 3: Defensive Sectors Minimum
    const defensiveSum = normalized
        .filter(s => DEFENSIVE_SECTORS.includes(s.sector))
        .reduce((sum, s) => sum + s.allocation, 0);

    let defensiveStatus: SectorBalanceCheck['status'] = 'OK';
    if (defensiveSum < 5) {
        defensiveStatus = 'HARD_VIOLATION';
    } else if (defensiveSum < 10) {
        defensiveStatus = 'SOFT_WARNING';
    }

    checks.push({
        rule: 3,
        status: defensiveStatus,
        value: defensiveSum,
        message: `방어 섹터 합계: ${defensiveSum.toFixed(1)}% (권장 최소: 15%)`
    });

    // RULE 4: REITs Limit
    const reitSum = normalized
        .filter(s => s.sector.includes('Real Estate'))
        .reduce((sum, s) => sum + s.allocation, 0);

    let reitStatus: SectorBalanceCheck['status'] = 'OK';
    if (reitSum > 20) {
        reitStatus = 'HARD_VIOLATION';
    } else if (reitSum > 15) {
        reitStatus = 'SOFT_WARNING';
    }

    checks.push({
        rule: 4,
        status: reitStatus,
        value: reitSum,
        message: `REITs 합계: ${reitSum.toFixed(1)}% (권장 상한: 20%)`
    });

    // RULE 5: Energy + Materials Limit
    const energyMaterialsSum = normalized
        .filter(s => s.sector === 'Energy' || s.sector === 'Materials')
        .reduce((sum, s) => sum + s.allocation, 0);

    let emStatus: SectorBalanceCheck['status'] = 'OK';
    if (energyMaterialsSum > 25) {
        emStatus = 'HARD_VIOLATION';
    } else if (energyMaterialsSum > 20) {
        emStatus = 'SOFT_WARNING';
    } else if (energyMaterialsSum > 15) {
        emStatus = 'ADVISORY';
    }

    checks.push({
        rule: 5,
        status: emStatus,
        value: energyMaterialsSum,
        message: `Energy + Materials 합계: ${energyMaterialsSum.toFixed(1)}% (권장 상한: 25%)`
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

function findCorrelatedGroups(
    sectors: SectorDistribution[],
    corrPairs: [string, string][]
): { members: string[] }[] {
    const sectorNames = sectors.map(s => s.sector);
    const groups: { members: string[] }[] = [];
    const visited = new Set<string>();

    const adj = new Map<string, Set<string>>();
    sectorNames.forEach(s => adj.set(s, new Set()));

    corrPairs.forEach(([s1, s2]) => {
        if (sectorNames.includes(s1) && sectorNames.includes(s2)) {
            adj.get(s1)!.add(s2);
            adj.get(s2)!.add(s1);
        }
    });

    sectorNames.forEach(sector => {
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

            if (component.length > 1) {
                groups.push({ members: component });
            }
        }
    });

    return groups;
}
