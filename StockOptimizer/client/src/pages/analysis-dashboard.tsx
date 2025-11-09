import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, Activity, Target, AlertTriangle, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// 숫자 포맷 함수 (소수점 없이, $, 콤마)
function formatCurrency(value) {
  return "$" + Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function formatDate(dateStr) {
  return dateStr.slice(0, 7); // "2022-03"
}

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }) => {
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
        <div style={{ fontWeight: 700, marginBottom: 5 }}>{formatDate(label)}</div>
        <div style={{ color: "#0066ff", fontWeight: 500 }}>My Portfolio: <span style={{fontWeight:700}}>{formatCurrency(payload[0].value)}</span></div>
        <div style={{ color: "#50B37B", fontWeight: 500 }}>S&P 500: <span style={{fontWeight:700}}>{formatCurrency(payload[1].value)}</span></div>
      </div>
    );
  }
  return null;
};

export default function AnalysisDashboard() {
  const [, setLocation] = useLocation();
  const [portfolioInput, setPortfolioInput] = useState(null);

  const analyzeMutation = useMutation({
    mutationFn: async (input) => await apiRequest("POST", "/api/analyze", input),
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

  function formatValue(val, key) {
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
                <th className="px-2 py-2 bg-gray-50 font-semibold">S&P 500</th>
              </tr>
            </thead>
            <tbody>
              {metricList.map(row => (
                <tr key={row.key} className="text-center">
                  <td className="border px-2 py-2">{row.label}</td>
                  <td className="border px-2 py-2">{formatValue(metrics[row.key], row.key)}</td>
                  <td className="border px-2 py-2">{formatValue(bm[row.key], row.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold mb-2">Cumulative Value Comparison</h2>
        <div className="mb-8 bg-white rounded shadow p-4">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="2 2" stroke="#ececec" />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={20} />
              <YAxis tickFormatter={formatCurrency} domain={['auto', 'auto']} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
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
              {yearlyPt.map((yr, idx) => (
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
