import type { PerformanceMetrics } from "@shared/schema";

export interface MetricEvaluation {
    level: "excellent" | "good" | "average" | "poor";
    label: string;
    color: string;
}

export const METRIC_DESCRIPTIONS: Record<string, string> = {
    totalReturn: "전체 기간 동안의 누적 수익률",
    annualizedReturn: "전체 누적 수익률을 연 단위로 환산한 연평균 복리 수익률",
    volatility: "수익률의 연간 표준편차로, 변동성 수준을 나타내는 지표",
    sharpeRatio: "무위험수익률 대비 초과수익을 변동성으로 나눈 위험 대비 성과 지표",
    sortinoRatio: "초과수익을 하락 변동성으로 나눈 위험 대비 성과 지표",
    downsideDeviation: "수익률이 0% 또는 목표수익률 아래로 내려간 구간만의 표준편차",
    maxDrawdown: "투자 기간 중 최고점 대비 최저점까지의 최대 낙폭",
    beta: "포트폴리오가 시장 수익률에 얼마나 민감하게 반응하는지 나타내는 민감도 계수",
    alpha: "시장과 위험수준으로 설명되는 기대수익을 초과한 초과성과",
    rSquare: "포트폴리오 수익률 변동 중 시장 수익률로 설명되는 비율",
    informationRatio: "벤치마크 대비 초과수익을 추적오차로 나눈 액티브 성과 지표",
    trackingError: "포트폴리오와 벤치마크 수익률 간의 차이 변동성",
};

export function evaluateMetric(key: string, value: number): MetricEvaluation {
    switch (key) {
        case "totalReturn":
            if (value >= 100) return { level: "excellent", label: "고성과", color: "text-green-600 dark:text-green-400" };
            if (value >= 0) return { level: "good", label: "정상적 장기 수익", color: "text-blue-600 dark:text-blue-400" };
            return { level: "poor", label: "손실", color: "text-red-600 dark:text-red-400" };

        case "annualizedReturn":
            if (value >= 30) return { level: "excellent", label: "매우 높은 성과", color: "text-green-600 dark:text-green-400" };
            if (value >= 15) return { level: "good", label: "고위험 초과성과", color: "text-green-600 dark:text-green-400" };
            if (value >= 5) return { level: "average", label: "시장 평균", color: "text-blue-600 dark:text-blue-400" };
            if (value >= 0) return { level: "average", label: "보수적 안정형", color: "text-blue-600 dark:text-blue-400" };
            return { level: "poor", label: "손실", color: "text-red-600 dark:text-red-400" };

        case "volatility":
            if (value >= 30) return { level: "poor", label: "고위험", color: "text-red-600 dark:text-red-400" };
            if (value >= 20) return { level: "average", label: "적극적 투자", color: "text-yellow-600 dark:text-yellow-400" };
            if (value >= 10) return { level: "good", label: "일반적 시장 수준", color: "text-blue-600 dark:text-blue-400" };
            return { level: "excellent", label: "극저변동", color: "text-green-600 dark:text-green-400" };

        case "sharpeRatio":
            if (value >= 2.0) return { level: "excellent", label: "매우 우수", color: "text-green-600 dark:text-green-400" };
            if (value >= 1.0) return { level: "good", label: "우수", color: "text-green-600 dark:text-green-400" };
            if (value >= 0.5) return { level: "average", label: "보통", color: "text-blue-600 dark:text-blue-400" };
            return { level: "poor", label: "비효율적", color: "text-red-600 dark:text-red-400" };

        case "sortinoRatio":
            if (value >= 2.0) return { level: "excellent", label: "매우 우수", color: "text-green-600 dark:text-green-400" };
            if (value >= 1.0) return { level: "good", label: "우수", color: "text-green-600 dark:text-green-400" };
            if (value >= 0.5) return { level: "average", label: "평균", color: "text-blue-600 dark:text-blue-400" };
            return { level: "poor", label: "하락 위험 대비 성과 낮음", color: "text-red-600 dark:text-red-400" };

        case "downsideDeviation":
            if (value >= 2) return { level: "poor", label: "하방 변동성 높음", color: "text-red-600 dark:text-red-400" };
            if (value >= 1) return { level: "average", label: "중간 수준", color: "text-yellow-600 dark:text-yellow-400" };
            return { level: "good", label: "하방 위험 낮음", color: "text-green-600 dark:text-green-400" };

        case "maxDrawdown":
            if (value <= -40) return { level: "poor", label: "심각한 낙폭", color: "text-red-600 dark:text-red-400" };
            if (value <= -25) return { level: "poor", label: "고위험 조정", color: "text-red-600 dark:text-red-400" };
            if (value <= -10) return { level: "average", label: "일반적 조정", color: "text-yellow-600 dark:text-yellow-400" };
            return { level: "good", label: "낮은 낙폭", color: "text-green-600 dark:text-green-400" };

        case "beta":
            if (value >= 1.6) return { level: "poor", label: "매우 공격적", color: "text-red-600 dark:text-red-400" };
            if (value >= 1.3) return { level: "average", label: "공격적", color: "text-yellow-600 dark:text-yellow-400" };
            if (value >= 0.7) return { level: "good", label: "시장과 유사", color: "text-blue-600 dark:text-blue-400" };
            return { level: "good", label: "방어적", color: "text-green-600 dark:text-green-400" };

        case "alpha":
            if (value >= 15) return { level: "excellent", label: "매우 높은 초과성과", color: "text-green-600 dark:text-green-400" };
            if (value >= 5) return { level: "good", label: "뛰어난 능력", color: "text-green-600 dark:text-green-400" };
            if (value >= 0) return { level: "average", label: "시장 초과 성과", color: "text-blue-600 dark:text-blue-400" };
            return { level: "poor", label: "시장 대비 부진", color: "text-red-600 dark:text-red-400" };

        case "rSquare":
            if (value >= 0.9) return { level: "average", label: "거의 패시브 수준", color: "text-blue-600 dark:text-blue-400" };
            if (value >= 0.6) return { level: "average", label: "시장에 상당히 종속", color: "text-blue-600 dark:text-blue-400" };
            if (value >= 0.3) return { level: "good", label: "절반 정도 시장 영향", color: "text-green-600 dark:text-green-400" };
            return { level: "good", label: "시장과 거의 무관", color: "text-green-600 dark:text-green-400" };

        case "informationRatio":
            if (value >= 1.0) return { level: "excellent", label: "매우 우수한 액티브 전략", color: "text-green-600 dark:text-green-400" };
            if (value >= 0.7) return { level: "good", label: "우수", color: "text-green-600 dark:text-green-400" };
            if (value >= 0.3) return { level: "average", label: "보통", color: "text-blue-600 dark:text-blue-400" };
            return { level: "poor", label: "액티브 성과 미흡", color: "text-red-600 dark:text-red-400" };

        case "trackingError":
            if (value >= 20) return { level: "average", label: "강한 액티브", color: "text-yellow-600 dark:text-yellow-400" };
            if (value >= 10) return { level: "average", label: "액티브", color: "text-blue-600 dark:text-blue-400" };
            if (value >= 5) return { level: "good", label: "준액티브", color: "text-blue-600 dark:text-blue-400" };
            return { level: "good", label: "패시브 전략", color: "text-green-600 dark:text-green-400" };

        default:
            return { level: "average", label: "", color: "" };
    }
}

export function generatePortfolioEvaluation(metrics: PerformanceMetrics): string {
    const evaluations = {
        returns: evaluateMetric("annualizedReturn", metrics.annualizedReturn),
        risk: evaluateMetric("volatility", metrics.volatility),
        efficiency: evaluateMetric("sharpeRatio", metrics.sharpeRatio),
        drawdown: evaluateMetric("maxDrawdown", metrics.maxDrawdown),
        alpha: evaluateMetric("alpha", metrics.alpha),
        sortino: evaluateMetric("sortinoRatio", metrics.sortinoRatio),
        beta: evaluateMetric("beta", metrics.beta),
    };

    let summary = "";

    // Overall performance assessment
    summary += `본 포트폴리오는 분석 기간 동안 연평균 ${metrics.annualizedReturn.toFixed(2)}%의 수익률을 기록하였으며, `;

    if (evaluations.returns.level === "excellent") {
        summary += "이는 매우 우수한 성과로 평가됩니다. ";
    } else if (evaluations.returns.level === "good") {
        summary += "이는 양호한 성과로 평가됩니다. ";
    } else if (evaluations.returns.level === "poor") {
        summary += "이는 개선이 필요한 수준입니다. ";
    } else {
        summary += "이는 안정적인 수준으로 평가됩니다. ";
    }

    // Risk analysis
    summary += `변동성(Volatility)은 ${metrics.volatility.toFixed(2)}%로 `;
    if (evaluations.risk.level === "excellent" || evaluations.risk.level === "good") {
        summary += "낮은 수준을 유지하고 있어 안정적인 투자 환경을 제공합니다. ";
    } else if (evaluations.risk.level === "poor") {
        summary += "높은 수준으로, 적극적인 리스크 관리가 요구됩니다. ";
    } else {
        summary += "시장 평균 수준을 보이고 있습니다. ";
    }

    // Risk-adjusted performance
    summary += `위험 조정 수익률을 나타내는 Sharpe Ratio는 ${metrics.sharpeRatio.toFixed(2)}로 `;
    if (evaluations.efficiency.level === "excellent" || evaluations.efficiency.level === "good") {
        summary += "우수한 효율성을 보여주고 있으며, 이는 투자 위험 대비 적절한 보상을 받고 있음을 의미합니다. ";
    } else if (evaluations.efficiency.level === "poor") {
        summary += "개선이 필요한 수준으로, 포트폴리오 재구성을 검토할 필요가 있습니다. ";
    } else {
        summary += "평균적인 효율성을 나타내고 있습니다. ";
    }

    // Sortino Ratio analysis
    summary += `하방 위험을 고려한 Sortino Ratio는 ${metrics.sortinoRatio.toFixed(2)}로 `;
    if (evaluations.sortino.level === "excellent" || evaluations.sortino.level === "good") {
        summary += "손실 위험 대비 우수한 성과를 달성하고 있습니다. ";
    } else {
        summary += "하방 리스크 관리에 주의가 필요합니다. ";
    }

    // Drawdown assessment
    summary += `최대 낙폭(Max Drawdown)은 ${metrics.maxDrawdown.toFixed(2)}%로 `;
    if (evaluations.drawdown.level === "poor") {
        summary += "상당한 수준이며, 이는 투자자의 심리적 부담을 가중시킬 수 있습니다. ";
    } else if (evaluations.drawdown.level === "good") {
        summary += "양호한 수준으로 관리되고 있습니다. ";
    } else {
        summary += "일반적인 조정 범위 내에 있습니다. ";
    }

    // Market sensitivity
    summary += `시장 민감도(Beta)는 ${metrics.beta.toFixed(2)}로 `;
    if (evaluations.beta.level === "good") {
        if (metrics.beta < 0.7) {
            summary += "방어적 성향을 보이며, 시장 하락 시 상대적으로 안정적일 것으로 예상됩니다. ";
        } else {
            summary += "시장과 유사한 움직임을 보이고 있습니다. ";
        }
    } else if (evaluations.beta.level === "poor") {
        summary += "매우 공격적인 성향으로, 시장 변동성에 크게 노출되어 있습니다. ";
    } else {
        summary += "다소 공격적인 성향을 나타내고 있습니다. ";
    }

    // Alpha assessment
    summary += `초과 수익(Alpha)은 ${metrics.alpha.toFixed(2)}%로 `;
    if (evaluations.alpha.level === "excellent" || evaluations.alpha.level === "good") {
        summary += "시장 대비 우수한 성과를 달성하고 있으며, 이는 효과적인 종목 선정 능력을 시사합니다.";
    } else if (evaluations.alpha.level === "poor") {
        summary += "시장 대비 부진한 성과를 보이고 있어, 투자 전략의 재검토가 권장됩니다.";
    } else {
        summary += "시장 수익률을 소폭 상회하는 성과를 보이고 있습니다.";
    }

    return summary.trim();
}
