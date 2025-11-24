import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, TrendingUp, CheckCircle2, XCircle, Activity, Loader2, Download, Info } from "lucide-react";
import { type OptimizationResult, type PortfolioInput } from "@shared/schema";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis, PieChart, Pie, Cell } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";

export default function OptimizationResults() {
  const [, setLocation] = useLocation();
  const [portfolioInput, setPortfolioInput] = useState<PortfolioInput | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const optimizeMutation = useMutation<OptimizationResult, Error, PortfolioInput>({
    mutationFn: async (input: PortfolioInput) => {
      return await apiRequest("POST", "/api/optimize", input);
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem("portfolio-input");
    if (stored) {
      const input = JSON.parse(stored);

      // Read the sector rebalancing flag from localStorage
      const enableRebalancing = localStorage.getItem('enableSectorRebalancing') === 'true';

      // Add the rebalanceSectors flag to the input
      const inputWithRebalancing = {
        ...input,
        rebalanceSectors: enableRebalancing
      };

      setPortfolioInput(inputWithRebalancing);
      if (!optimizeMutation.data && !optimizeMutation.isPending) {
        optimizeMutation.mutate(inputWithRebalancing);
      }
    } else {
      setLocation("/");
    }
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (optimizeMutation.isPending) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = now - startTime;
        setElapsed(Math.floor(diff / 1000));

        // Animate to 90% over 60 seconds (the server timeout)
        // We leave the last 10% for the final response
        const newProgress = Math.min(90, (diff / 60000) * 90);
        setProgress(newProgress);
      }, 100);

      return () => clearInterval(interval);
    } else if (optimizeMutation.data) {
      setProgress(100);
    }
  }, [optimizeMutation.isPending, optimizeMutation.data]);

  const result = optimizeMutation.data;
  const isLoading = optimizeMutation.isPending;
  const isError = optimizeMutation.isError;

  if (!portfolioInput) {
    return null;
  }

  if (isLoading || !result) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-lg w-full">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto relative z-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">포트폴리오 최적화 진행 중</h2>
            <p className="text-muted-foreground">
              몬테카를로 시뮬레이션 및 섹터 밸런스 분석 중입니다...
              <br />
              최대 1분 정도 소요될 수 있습니다.
            </p>
          </div>

          <div className="space-y-2 max-w-xs mx-auto w-full">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}%</span>
              <span>{elapsed}s</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>최적화 실패</CardTitle>
            <CardDescription>포트폴리오를 최적화할 수 없습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/analysis")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              분석 페이지로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatPercent = (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
  const improvement = result.optimized.metrics.sharpeRatio - result.current.metrics.sharpeRatio;

  const downloadExcel = () => {
    if (!result) return;

    // 1. Metrics Row
    const metricsHeader = ["Metric", "Current", "Optimized", "Change"];
    const metricsRows = [
      ["Annual Return", formatPercent(result.current.metrics.annualizedReturn), formatPercent(result.optimized.metrics.annualizedReturn), formatPercent(result.optimized.metrics.annualizedReturn - result.current.metrics.annualizedReturn)],
      ["Sharpe Ratio", result.current.metrics.sharpeRatio.toFixed(2), result.optimized.metrics.sharpeRatio.toFixed(2), (result.optimized.metrics.sharpeRatio - result.current.metrics.sharpeRatio).toFixed(2)],
      ["Volatility", formatPercent(result.current.metrics.volatility), formatPercent(result.optimized.metrics.volatility), formatPercent(result.optimized.metrics.volatility - result.current.metrics.volatility)],
      ["Max Drawdown", formatPercent(result.current.metrics.maxDrawdown), formatPercent(result.optimized.metrics.maxDrawdown), formatPercent(result.optimized.metrics.maxDrawdown - result.current.metrics.maxDrawdown)]
    ];

    // 2. Holdings Row
    const holdingsHeader = ["Ticker", "Current Allocation", "Optimized Allocation", "Change"];
    const holdingsRows = result.optimized.holdings.map(h => {
      const current = result.current.holdings.find(c => c.ticker === h.ticker)?.allocation || 0;
      return [h.ticker, current.toFixed(2) + "%", h.allocation.toFixed(2) + "%", h.change.toFixed(2) + "%"];
    });

    // Combine into CSV
    const csvContent = [
      "Performance Metrics",
      metricsHeader.join(","),
      ...metricsRows.map(r => r.join(",")),
      "",
      "Portfolio Holdings",
      holdingsHeader.join(","),
      ...holdingsRows.map(r => r.join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "optimized_portfolio.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/analysis")} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로
              </Button>
              <h1 className="text-3xl font-bold">포트폴리오 최적화</h1>
            </div>
            <Button variant="outline" onClick={downloadExcel}>
              <Download className="h-4 w-4 mr-2" />
              Excel로 다운로드
            </Button>
          </div>
          <p className="text-muted-foreground">
            {
              portfolioInput.riskTolerance === 'conservative' ? '보수적' :
              portfolioInput.riskTolerance === 'moderate' ? '중도적' :
              '공격적'
            } 위험 선호도 및 {portfolioInput.targetReturn}% 목표수익률로 최적화됨
          </p>
        </div>

        <Card className="mb-8 border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle className="text-2xl">최적화 요약</CardTitle>
            <CardDescription className="text-base">
              샤프 지수 {improvement >= 0 ? "개선" : "악화"}: {improvement >= 0 ? "+" : ""}{improvement.toFixed(2)} ({((improvement / result.current.metrics.sharpeRatio) * 100).toFixed(1)}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">수익률 개선</div>
                <div className={`text-2xl font-mono font-bold ${result.optimized.metrics.annualizedReturn >= result.current.metrics.annualizedReturn ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {formatPercent(result.optimized.metrics.annualizedReturn - result.current.metrics.annualizedReturn)}
                </div>
              </div>
              <div className="text-center p-5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">변동성 변화</div>
                <div className={`text-2xl font-mono font-bold ${result.optimized.metrics.volatility <= result.current.metrics.volatility ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {formatPercent(result.optimized.metrics.volatility - result.current.metrics.volatility)}
                </div>
              </div>
              <div className="text-center p-5 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">샤프 지수 개선</div>
                <div className={`text-2xl font-mono font-bold ${improvement >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {improvement >= 0 ? "+" : ""}{improvement.toFixed(2)}
                </div>
              </div>
              <div className="text-center p-5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">최대 낙폭 변화</div>
                <div className={`text-2xl font-mono font-bold ${result.optimized.metrics.maxDrawdown >= result.current.metrics.maxDrawdown ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {formatPercent(result.optimized.metrics.maxDrawdown - result.current.metrics.maxDrawdown)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sector Balance Comparison - only show if rebalancing was applied */}
        {result.sectorRebalancingApplied && result.currentSectorBalance && result.optimized.sectorBalanceReport && (
          <Card className="mb-8 border-2 border-blue-500 shadow-lg bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <CardHeader className="bg-gradient-to-r from-blue-100/50 to-cyan-100/50 dark:from-blue-900/20 dark:to-cyan-900/20">
              <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <Activity className="h-5 w-5 text-blue-600" />
                섹터 리밸런싱 결과 (중간 단계)
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                최적화 전, 섹터 밸런스를 맞춘 포트폴리오입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Sector Balanced Portfolio Metrics */}
                <div className="space-y-4">
                  <div className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-3">섹터 조정 포트폴리오 성과</div>
                  {result.sectorBalancedPortfolio ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/40 rounded-xl border border-blue-200 dark:border-blue-700">
                        <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">Annual Return</div>
                        <div className="font-mono font-bold text-lg text-blue-900 dark:text-blue-100">
                          {formatPercent(result.sectorBalancedPortfolio.metrics.annualizedReturn)}
                        </div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:to-cyan-800/40 rounded-xl border border-cyan-200 dark:border-cyan-700">
                        <div className="text-xs text-cyan-700 dark:text-cyan-300 font-semibold mb-1">Sharpe Ratio</div>
                        <div className="font-mono font-bold text-lg text-cyan-900 dark:text-cyan-100">
                          {result.sectorBalancedPortfolio.metrics.sharpeRatio.toFixed(2)}
                        </div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/40 dark:to-teal-800/40 rounded-xl border border-teal-200 dark:border-teal-700">
                        <div className="text-xs text-teal-700 dark:text-teal-300 font-semibold mb-1">Volatility</div>
                        <div className="font-mono font-bold text-lg text-teal-900 dark:text-teal-100">
                          {result.sectorBalancedPortfolio.metrics.volatility.toFixed(2)}%
                        </div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-900/40 dark:to-sky-800/40 rounded-xl border border-sky-200 dark:border-sky-700">
                        <div className="text-xs text-sky-700 dark:text-sky-300 font-semibold mb-1">Sector Score</div>
                        <div className="font-mono font-bold text-lg text-sky-900 dark:text-sky-100">
                          {result.optimized.sectorBalanceReport.overallScore}/100
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">데이터 없음</div>
                  )}

                  {/* Sector Balance Issues */}
                  {result.optimized.sectorBalanceReport.checks.filter(c => c.status !== 'OK').length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="text-sm font-semibold">남은 섹터 이슈</div>
                      {result.optimized.sectorBalanceReport.checks
                        .filter(c => c.status !== 'OK')
                        .map((check, idx) => {
                          let bgColor = 'bg-green-50 border-green-200';
                          let textColor = 'text-green-800';
                          let icon = '✓';

                          if (check.status === 'HARD_VIOLATION') {
                            bgColor = 'bg-red-50 border-red-200';
                            textColor = 'text-red-800';
                            icon = '✗';
                          } else if (check.status === 'SOFT_WARNING') {
                            bgColor = 'bg-yellow-50 border-yellow-200';
                            textColor = 'text-yellow-800';
                            icon = '⚠';
                          } else if (check.status === 'ADVISORY') {
                            bgColor = 'bg-blue-50 border-blue-200';
                            textColor = 'text-blue-800';
                            icon = 'ℹ';
                          }

                          return (
                            <div key={idx} className={`p-2 rounded border text-xs ${bgColor} ${textColor}`}>
                              <span className="mr-2">{icon}</span>
                              {check.message}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Pie Chart of Sector Balanced Portfolio */}
                <div className="h-[320px] w-full">
                  <div className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-3 text-center">섹터 조정 후 종목 비중</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {(result.sectorBalancedPortfolio?.holdings || []).map((entry, index) => (
                          <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={`hsl(${(index * 45) % 360}, 70%, 55%)`} stopOpacity={0.9}></stop>
                            <stop offset="95%" stopColor={`hsl(${(index * 45) % 360}, 70%, 45%)`} stopOpacity={0.8}></stop>
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={result.sectorBalancedPortfolio?.holdings || []}
                        dataKey="allocation"
                        nameKey="ticker"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        paddingAngle={2}
                        label={({ ticker, allocation }) => `${ticker} ${allocation.toFixed(1)}%`}
                        labelLine={{ stroke: 'hsl(var(--foreground))', strokeWidth: 1 }}
                      >
                        {(result.sectorBalancedPortfolio?.holdings || []).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`url(#pieGradient-${index})`}
                            stroke="white"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '12px',
                          padding: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Sector Comparison Table */}
              <div className="mt-6">
                <div className="font-semibold text-sm text-muted-foreground mb-3">섹터 비중 변화 상세</div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Sector</th>
                        <th className="p-2 text-right">Before</th>
                        <th className="p-2 text-center">→</th>
                        <th className="p-2 text-right">After</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.optimized.sectorDistribution?.map((sector, idx) => {
                        const before = result.current.sectorDistribution?.find(s => s.sector === sector.sector)?.allocation || 0;
                        const after = sector.allocation;
                        const diff = after - before;

                        // Find violation status for this sector
                        const violation = result.currentSectorBalance?.checks.find(c => c.sector === sector.sector);
                        const wasViolation = violation && violation.status !== 'OK';

                        return (
                          <tr key={idx} className="border-t hover:bg-muted/50">
                            <td className="p-2 font-medium">{sector.sector}</td>
                            <td className="p-2 text-right font-mono text-muted-foreground">{before.toFixed(1)}%</td>
                            <td className="p-2 text-center text-muted-foreground">→</td>
                            <td className="p-2 text-right font-mono font-bold">{after.toFixed(1)}%</td>
                            <td className="p-2">
                              {wasViolation ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  Resolved
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 1. Current Portfolio */}
          <Card>
            <CardHeader>
              <CardTitle>현재 포트폴리오</CardTitle>
              <CardDescription>기존 종목 구성</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">연평균 수익률</div>
                  <div className="text-lg font-mono font-semibold" data-testid="current-return">
                    {formatPercent(result.current.metrics.annualizedReturn)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">샤프 지수</div>
                  <div className="text-lg font-mono font-semibold" data-testid="current-sharpe">
                    {result.current.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">최대 낙폭</div>
                  <div className="text-lg font-mono font-semibold text-destructive">
                    {formatPercent(result.current.metrics.maxDrawdown)}
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t">
                <div className="text-sm font-semibold mb-2">보유 종목</div>
                {result.current.holdings.map((holding, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="font-mono uppercase">{holding.ticker}</span>
                      <a
                        href={`https://finance.yahoo.com/quote/${holding.ticker}/profile/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Info className="h-3 w-3" />
                      </a>
                    </div>
                    <span className="font-mono text-muted-foreground">{holding.allocation.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 2. Sector Balanced Portfolio (Intermediate) */}
          {result.sectorBalancedPortfolio ? (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-blue-700">섹터 균형</CardTitle>
                <CardDescription>중간 단계: 섹터 조정됨</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">연평균 수익률</div>
                    <div className="text-lg font-mono font-semibold text-blue-700">
                      {formatPercent(result.sectorBalancedPortfolio.metrics.annualizedReturn)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">샤프 지수</div>
                    <div className="text-lg font-mono font-semibold text-blue-700">
                      {result.sectorBalancedPortfolio.metrics.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">최대 낙폭</div>
                    <div className="text-lg font-mono font-semibold text-destructive">
                      {formatPercent(result.sectorBalancedPortfolio.metrics.maxDrawdown)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-blue-100">
                  <div className="text-sm font-semibold mb-2 text-blue-900">보유 종목</div>
                  {result.sectorBalancedPortfolio.holdings.slice(0, 8).map((holding, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="font-mono uppercase">{holding.ticker}</span>
                        <a
                          href={`https://finance.yahoo.com/quote/${holding.ticker}/profile/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Info className="h-3 w-3" />
                        </a>
                      </div>
                      <span className="font-mono text-muted-foreground">{holding.allocation.toFixed(1)}%</span>
                    </div>
                  ))}
                  {result.sectorBalancedPortfolio.holdings.length > 8 && (
                    <div className="text-xs text-center text-muted-foreground pt-1">
                      + {result.sectorBalancedPortfolio.holdings.length - 8} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="opacity-50 border-dashed">
              <CardHeader>
                <CardTitle>섹터 균형</CardTitle>
                <CardDescription>해당 없음</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-40 text-muted-foreground">
                섹터 리밸런싱이 적용되지 않았습니다
              </CardContent>
            </Card>
          )}

          {/* 3. Optimized Portfolio */}
          <Card className="border-2 border-primary shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <TrendingUp className="h-5 w-5" />
                최적화 포트폴리오
              </CardTitle>
              <CardDescription>최종 추천 종목 구성</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">연평균 수익률</div>
                  <div className="text-lg font-mono font-bold text-green-600 dark:text-green-400" data-testid="optimized-return">
                    {formatPercent(result.optimized.metrics.annualizedReturn)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">샤프 지수</div>
                  <div className="text-lg font-mono font-bold text-green-600 dark:text-green-400" data-testid="optimized-sharpe">
                    {result.optimized.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">최대 낙폭</div>
                  <div className="text-lg font-mono font-semibold text-destructive">
                    {formatPercent(result.optimized.metrics.maxDrawdown)}
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t">
                <div className="text-sm font-semibold mb-2">보유 종목</div>
                {result.optimized.holdings.map((holding, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 text-sm border-b last:border-0 border-dashed">
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-semibold uppercase">{holding.ticker}</span>
                      <a
                        href={`https://finance.yahoo.com/quote/${holding.ticker}/profile/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Info className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{holding.allocation.toFixed(1)}%</span>
                      {holding.change !== 0 && (
                        <Badge variant={holding.change > 0 ? "default" : "secondary"} className="text-[10px] h-5 px-1">
                          {holding.change > 0 ? "+" : ""}{holding.change.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>최적화 권장 사항</CardTitle>
            <CardDescription>
              포트폴리오 개선을 위한 구체적인 조치
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border hover-elevate"
                  data-testid={`recommendation-${idx}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {rec.change > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div className="font-semibold">
                        {{
                          "Add position": "종목 추가",
                          "Increase allocation": "비중 확대",
                          "Remove position": "종목 제거",
                          "Decrease allocation": "비중 축소",
                        }[rec.action] || rec.action}
                      </div>
                    </div>
                    <Badge variant={rec.change > 0 ? "default" : "secondary"}>
                      {formatPercent(rec.change)}
                    </Badge>
                  </div>
                  <div className="ml-7 space-y-1">
                    <div className="text-sm flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-semibold uppercase">{rec.ticker}</span>
                        <a
                          href={`https://finance.yahoo.com/quote/${rec.ticker}/profile/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Info className="h-3 w-3" />
                        </a>
                      </div>
                      <span>:</span>
                      <span className="font-mono">{rec.currentAllocation.toFixed(1)}%</span>
                      <ArrowRight className="inline h-3 w-3 mx-2" />
                      <span className="font-mono font-semibold">{rec.recommendedAllocation.toFixed(1)}%</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{rec.rationale}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      포트폴리오 시뮬레이션
                    </CardTitle>
                    <CardDescription>
                      몬테카를로 시뮬레이션을 통해 생성된 포트폴리오들의 위험-수익 분포입니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={450}>
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                        <defs>
                          <linearGradient id="frontierGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}></stop>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.2}></stop>
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          opacity={0.2}
                          vertical={false}
                        />
                        <XAxis
                          type="number"
                          dataKey="volatility"
                          name="Volatility"
                          unit="%"
                          stroke="hsl(var(--foreground))"
                          fontSize={13}
                          fontWeight={500}
                          tickLine={false}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          label={{
                            value: "Volatility (%)",
                            position: "insideBottom",
                            offset: -15,
                            style: { fill: 'hsl(var(--muted-foreground))', fontSize: 13, fontWeight: 600 }
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="return"
                          name="Return"
                          unit="%"
                          stroke="hsl(var(--foreground))"
                          fontSize={13}
                          fontWeight={500}
                          tickLine={false}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          label={{
                            value: "Annual Return (%)",
                            angle: -90,
                            position: "insideLeft",
                            style: { fill: 'hsl(var(--muted-foreground))', fontSize: 13, fontWeight: 600 }
                          }}
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--primary))", strokeWidth: 1.5 }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              let label = "시뮬레이션 포트폴리오";
                              let bgColor = "bg-background";
                              let borderColor = "border-border";
        
                              if (data.isCurrent) {
                                label = "Current Portfolio";
                                borderColor = "border-red-500";
                              } else if (data.isOptimal) {
                                label = "Optimized Portfolio";
                                borderColor = "border-green-500";
                              } else if (data.isSectorCompliant) {
                                label = "Sector Balanced";
                                borderColor = "border-blue-500";
                              }
        
                              return (
                                <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-4 shadow-xl backdrop-blur-sm bg-opacity-95`}>
                                  <div className="font-bold mb-2 text-sm">{label}</div>
                                  <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-muted-foreground">Return:</span>
                                      <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                                        {data.return.toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-muted-foreground">Volatility:</span>
                                      <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                                        {data.volatility.toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter
                          name="시뮬레이션 포트폴리오"
                          data={result.efficientFrontier.filter(p => !p.isCurrent && !p.isOptimal && !p.isSectorCompliant)}
                          fill="url(#frontierGradient)"
                          opacity={0.8}
                          shape="circle"
                        />                <Scatter
                  name="Current"
                  data={result.efficientFrontier.filter(p => p.isCurrent)}
                  fill="#ef4444"
                  shape={(props) => {
                    const { cx, cy } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={8} fill="#ef4444" opacity={0.2} />
                        <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                      </g>
                    );
                  }}
                />
                <Scatter
                  name="Sector Balanced"
                  data={result.efficientFrontier.filter(p => p.isSectorCompliant)}
                  fill="#3b82f6"
                  shape={(props) => {
                    const { cx, cy } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={8} fill="#3b82f6" opacity={0.2} />
                        <polygon
                          points={`${cx},${cy - 5} ${cx + 4.5},${cy + 3} ${cx - 4.5},${cy + 3}`}
                          fill="#3b82f6"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }}
                />
                <Scatter
                  name="Optimized"
                  data={result.efficientFrontier.filter(p => p.isOptimal)}
                  fill="#22c55e"
                  shape={(props) => {
                    const { cx, cy } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={10} fill="#22c55e" opacity={0.2} />
                        <circle cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#fff" strokeWidth={2.5} />
                        <circle cx={cx} cy={cy} r={2.5} fill="#fff" />
                      </g>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div >
    </div >
  );
}
