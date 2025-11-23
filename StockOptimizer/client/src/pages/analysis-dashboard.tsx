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

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "white",
        border: "1.5px solid #cdd5df",
        padding: "12px",
        borderRadius: "7px",
        boxShadow: "0 2px 12px #eef2fb",
        minWidth: 170,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 5 }}>{formatDate(label || "")}</div>
        <div style={{ color: "#0066ff", fontWeight: 500 }}>My Portfolio: <span style={{ fontWeight: 700 }}>{formatCurrency(payload[0].value)}</span></div>
        <div style={{ color: "#50B37B", fontWeight: 500 }}>S&P 500: <span style={{ fontWeight: 700 }}>{formatCurrency(payload[1].value)}</span></div>
      </div>
    );
  }
  return null;
};

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
      title: "Total Return",
      icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
      value: metrics.totalReturn,
      color: metrics.totalReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive",
      desc: `Over ${periodYears.toFixed(1)} years`
    },
    {
      title: "Annualized Return",
      icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
      value: metrics.annualizedReturn,
      color: metrics.annualizedReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive",
      desc: "Average annual growth"
    },
    {
      title: "Sharpe Ratio",
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      value: metrics.sharpeRatio,
      color: "",
      desc: "Risk-adjusted return"
    },
    {
      title: "Max Drawdown",
      icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      value: metrics.maxDrawdown,
      color: "text-destructive",
      desc: "Largest peak-to-trough decline"
    }
  ];

  const metricList = [
    { key: "totalReturn", label: "Total Return" },
    { key: "annualizedReturn", label: "Annualized Return" },
    { key: "volatility", label: "Volatility" },
    { key: "sharpeRatio", label: "Sharpe Ratio" },
    { key: "sortinoRatio", label: "Sortino Ratio" },
    { key: "downsideDeviation", label: "Downside Deviation" },
    { key: "maxDrawdown", label: "Max Drawdown" },
    { key: "beta", label: "Beta" },
    { key: "alpha", label: "Alpha" },
    { key: "rSquare", label: "R²" },
    { key: "informationRatio", label: "Information Ratio" },
    { key: "trackingError", label: "Tracking Error" }
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
            Back
          </Button>
          <h1 className="text-3xl font-bold">Portfolio Analysis</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Analysis Period: {analysis.startDate ? new Date(analysis.startDate).toLocaleDateString() : "N/A"}
          {" - "}
          {analysis.endDate ? new Date(analysis.endDate).toLocaleDateString() : "N/A"}
          {" "}({periodYears.toFixed(1)} years)
        </p>
        <Button onClick={() => setLocation("/optimize")} size="lg" className="mb-8">
          <Target className="h-4 w-4 mr-2" /> Optimize Portfolio
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
                    ? `${item.value >= 0 ? "+" : ""}${item.value.toFixed(2)}${item.title.includes("Ratio") ? "" : "%"}`
                    : "-"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-2">Performance Metrics Comparison</h2>
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full border divide-y divide-gray-300">
            <thead>
              <tr>
                <th className="px-2 py-2 bg-gray-50 font-semibold">Metric</th>
                <th className="px-2 py-2 bg-gray-50 font-semibold">My Portfolio</th>
                <th className="px-2 py-2 bg-gray-50 font-semibold">Portfolio Evaluation</th>
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

        <h2 className="text-xl font-semibold mb-2">Sector Distribution</h2>
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sector Allocation</CardTitle>
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
              <CardTitle>Sector Breakdown</CardTitle>
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

        <h2 className="text-xl font-semibold mb-2">Cumulative Value Comparison</h2>
        <div className="mb-8 bg-white rounded shadow p-4">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="2 2" stroke="#ececec" />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={20} />
              <YAxis tickFormatter={formatCurrency} domain={['auto', 'auto']} allowDecimals={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  fontWeight: "bold",
                  fontSize: "15px",
                  marginTop: "10px"
                }}
                formatter={(value, entry, index) => {
                  // entry.color는 실제 그래프 컬러
                  if (value === "portfolio") return <span style={{ color: "#0066ff" }}>My Portfolio</span>;
                  if (value === "benchmark") return <span style={{ color: "#50B37B" }}>S&P 500</span>;
                  return value;
                }}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                name="My Portfolio"
                stroke="#0066ff"
                strokeWidth={2.7}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                name="S&P 500"
                stroke="#50B37B"
                strokeWidth={2.7}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <h2 className="text-xl font-semibold mb-2">Annual Returns</h2>
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full border">
            <thead>
              <tr>
                <th className="px-2 py-2">Year</th>
                <th className="px-2 py-2">Portfolio (%)</th>
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
