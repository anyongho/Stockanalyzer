import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, TrendingUp, Activity, Target, AlertTriangle, BarChart3, Info, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { generatePortfolioEvaluation, evaluateMetric, METRIC_DESCRIPTIONS } from "@/lib/metric-utils";
import { checkSectorBalance } from "@/lib/sector-balance-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Area,
} from "recharts";

const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8",
  "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57"
];

// 숫자 포맷 함수 (소수점 없이, $, 콤마)
function formatCurrency(value: number) {
  return "$" + Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function formatDate(dateStr: string) {
  return dateStr.slice(0, 7); // "2022-03"
}



export default function AnalysisDashboard() {
  const [, setLocation] = useLocation();
  const [portfolioInput, setPortfolioInput] = useState<any>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (input: any) => await apiRequest("POST", "/api/analyze", input),
  });

  useEffect(() => {
    const stored = localStorage.getItem("portfolio-input");
    if (stored) {
      const input = JSON.parse(stored);
      setPortfolioInput(input);
      if (!analyzeMutation.data && !analyzeMutation.isPending) {
        analyzeMutation.mutate(input);
      }
    } else {
      setLocation("/");
    }
  }, []);

  const analysis = analyzeMutation.data?.analysis ?? analyzeMutation.data;
  const isLoading = analyzeMutation.isPending;
  const isError = analyzeMutation.isError;

  console.log("Analysis Data:", analysis);
  if (analysis?.sectorDistribution) {
    console.log("Sector Distribution:", analysis.sectorDistribution);
  }

  // Calculate sector balance
  const sectorBalanceReport = analysis?.sectorDistribution
    ? checkSectorBalance(analysis.sectorDistribution)
    : null;

  // Sector rebalancing state
  const [enableRebalancing, setEnableRebalancing] = useState(() => {
    return localStorage.getItem('enableSectorRebalancing') === 'true';
  });

  if (!analysis || !portfolioInput) return null;

  const periodYears = analysis.periodYears ?? 0;
  const metrics = analysis?.portfolio?.metrics ?? analysis?.metrics ?? {};
  const bm = analysis?.benchmark?.metrics ?? {};
  const chartData = analysis?.chartData ?? [];
  const yearlyPt = analysis?.portfolio?.yearlyReturns ?? [];
  const yearlyBm = analysis?.benchmark?.yearlyReturns ?? [];

  const coreCards = [
    {
      title: "총수익률",
      icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
      value: metrics.totalReturn,
      color: metrics.totalReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive",
      desc: `${periodYears.toFixed(1)}년 동안`
    },
    {
      title: "연평균 수익률",
      icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
      value: metrics.annualizedReturn,
      color: metrics.annualizedReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive",
      desc: "연평균 성장률"
    },
    {
      title: "샤프 지수",
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      value: metrics.sharpeRatio,
      color: "",
      desc: "위험 조정 수익률"
    },
    {
      title: "최대 낙폭",
      icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      value: metrics.maxDrawdown,
      color: "text-destructive",
      desc: "최대 하락률"
    }
  ];

  const metricList = [
    { key: "totalReturn", label: "총수익률" },
    { key: "annualizedReturn", label: "연평균 수익률" },
    { key: "volatility", label: "변동성" },
    { key: "sharpeRatio", label: "샤프 지수" },
    { key: "sortinoRatio", label: "소티노 지수" },
    { key: "downsideDeviation", label: "하방 편차" },
    { key: "maxDrawdown", label: "최대 낙폭" },
    { key: "beta", label: "베타" },
    { key: "alpha", label: "알파" },
    { key: "rSquare", label: "결정계수 (R²)" },
    { key: "informationRatio", label: "정보 비율" },
    { key: "trackingError", label: "추적 오차" }
  ];

  function formatValue(val: number | undefined, key: string) {
    if (val === undefined || val === null) return "-";
    if (["sharpeRatio", "sortinoRatio", "beta", "rSquare", "alpha", "informationRatio"].includes(key)) {
      return val.toFixed(2);
    }
    return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-7xl mx-auto py-8 px-4">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96 mb-8" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Analysis Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Input
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="mb-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
          <h1 className="text-3xl font-bold">포트폴리오 분석</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Analysis Period: {analysis.startDate ? new Date(analysis.startDate).toLocaleDateString() : "N/A"}
          {" - "}
          {analysis.endDate ? new Date(analysis.endDate).toLocaleDateString() : "N/A"}
          {" "}({periodYears.toFixed(1)} years)
        </p>
        <Button onClick={() => setLocation("/optimize")} size="lg" className="mb-8">
          <Target className="h-4 w-4 mr-2" /> 포트폴리오 최적화
        </Button>

        {/* Portfolio Evaluation Card */}
        <Card className="mb-8 border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>포트폴리오 종합 평가</CardTitle>
            </div>
            <CardDescription>
              성과 지표를 종합적으로 분석한 평가입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed">
              {generatePortfolioEvaluation(metrics)}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {coreCards.map((item, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                {item.icon}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-mono font-bold ${item.color}`}>
                  {typeof item.value === "number"
                    ? `${item.value >= 0 ? "+" : ""}${item.value.toFixed(2)}${item.title.includes("지수") ? "" : "%"}`
                    : "-"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-2">성과 지표 비교</h2>
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full border divide-y divide-gray-300">
            <thead>
              <tr>
                <th className="px-2 py-2 bg-gray-50 font-semibold">지표</th>
                <th className="px-2 py-2 bg-gray-50 font-semibold">내 포트폴리오</th>
                <th className="px-2 py-2 bg-gray-50 font-semibold">포트폴리오 평가</th>
                <th className="px-2 py-2 bg-gray-50 font-semibold">S&P 500</th>
              </tr>
            </thead>
            <tbody>
              <TooltipProvider>
                {metricList.map(row => {
                  const evaluation = evaluateMetric(row.key, metrics[row.key]);
                  const description = METRIC_DESCRIPTIONS[row.key] || "";

                  return (
                    <tr key={row.key} className="text-center">
                      <td className="border px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <span>{row.label}</span>
                          {description && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="text-sm">{description}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      <td className="border px-2 py-2 font-mono">{formatValue(metrics[row.key], row.key)}</td>
                      <td className={`border px-2 py-2 text-sm font-medium ${evaluation.color}`}>
                        {evaluation.label}
                      </td>
                      <td className="border px-2 py-2 font-mono">{formatValue(bm[row.key], row.key)}</td>
                    </tr>
                  );
                })}
              </TooltipProvider>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold mb-2">섹터 비중</h2>
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>섹터 할당</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analysis.sectorDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="allocation"
                      nameKey="sector"
                    >
                      {(analysis.sectorDistribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>섹터 상세 비중</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(analysis.sectorDistribution || []).map((item: any, index: number) => (
                  <div key={item.sector} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{item.sector}</span>
                    </div>
                    <span className="font-mono">{item.allocation.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sector Balance Analysis */}
        {sectorBalanceReport && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                섹터 밸런스 분석
              </CardTitle>
              <CardDescription>
                포트폴리오의 섹터 분산 수준을 평가합니다 (점수: {sectorBalanceReport.overallScore}/100)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sectorBalanceReport.checks.map((check, idx) => {
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
                    <div key={idx} className={`p-3 rounded border ${bgColor} ${textColor}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1">
                          <p className="font-medium">{check.message}</p>
                          {check.members && (
                            <p className="text-sm mt-1">포함 섹터: {check.members.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rebalancing Checkbox */}
              {(sectorBalanceReport.hardViolations > 0 || sectorBalanceReport.softWarnings > 0) && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableRebalancing}
                      onChange={(e) => {
                        setEnableRebalancing(e.target.checked);
                        localStorage.setItem('enableSectorRebalancing', e.target.checked.toString());
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-blue-900">최적화 시 섹터 리밸런싱 적용</p>
                      <p className="text-sm text-blue-700 mt-1">
                        활성화 시 포트폴리오 최적화 과정에서 섹터 밸런스를 개선하기 위해
                        종목 비중 조정 또는 신규 종목 추가가 이루어질 수 있습니다.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>누적 수익률 비교</CardTitle>
            <CardDescription>
              초기 투자금 $10,000 기준, 내 포트폴리오와 S&P 500의 성과 비교
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="benchmarkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  minTickGap={30}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  domain={['auto', 'auto']}
                  allowDecimals={false}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <RechartsTooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-4 rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm">
                          <p className="font-medium text-foreground mb-2">{formatDate(label || "")}</p>
                          {payload.map((p, i) => (
                            <div key={i} className="flex items-center justify-between gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-muted-foreground">{p.name}:</span>
                              </div>
                              <span className="font-mono font-semibold">{formatCurrency(p.value as number)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="내 포트폴리오"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, style: { fill: "hsl(var(--background))", stroke: "hsl(var(--primary))" } }}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="S&P 500"
                  stroke="#22c55e" // A vivid green
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, style: { fill: "hsl(var(--background))", stroke: "#22c55e" } }}
                />
                <Area type="monotone" dataKey="portfolio" stroke="none" fillOpacity={1} fill="url(#portfolioGradient)" />
                <Area type="monotone" dataKey="benchmark" stroke="none" fillOpacity={1} fill="url(#benchmarkGradient)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <h2 className="text-xl font-semibold mb-2">연도별 수익률</h2>
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full border">
            <thead>
              <tr>
                <th className="px-2 py-2">연도</th>
                <th className="px-2 py-2">포트폴리오 (%)</th>
                <th className="px-2 py-2">S&P 500 (%)</th>
              </tr>
            </thead>
            <tbody>
              {yearlyPt.map((yr: any, idx: number) => (
                <tr key={yr.year} className="text-center">
                  <td className="border px-2 py-2">{yr.year}</td>
                  <td className="border px-2 py-2">{yr.return.toFixed(2)}</td>
                  <td className="border px-2 py-2">{yearlyBm[idx]?.return?.toFixed(2) ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
