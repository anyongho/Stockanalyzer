import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { type OptimizationResult, type PortfolioInput } from "@shared/schema";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from "recharts";
import { apiRequest } from "@/lib/queryClient";

export default function OptimizationResults() {
  const [, setLocation] = useLocation();
  const [portfolioInput, setPortfolioInput] = useState<PortfolioInput | null>(null);

  const optimizeMutation = useMutation<OptimizationResult, Error, PortfolioInput>({
    mutationFn: async (input: PortfolioInput) => {
      return await apiRequest("POST", "/api/optimize", input);
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem("portfolio-input");
    if (stored) {
      const input = JSON.parse(stored);
      setPortfolioInput(input);
      if (!optimizeMutation.data && !optimizeMutation.isPending) {
        optimizeMutation.mutate(input);
      }
    } else {
      setLocation("/");
    }
  }, []);

  const result = optimizeMutation.data;
  const isLoading = optimizeMutation.isPending;
  const isError = optimizeMutation.isError;

  if (!portfolioInput) {
    return null;
  }

  if (isLoading || !result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-7xl mx-auto py-8 px-4">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
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
            <CardTitle>Optimization Failed</CardTitle>
            <CardDescription>Unable to optimize portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/analysis")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatPercent = (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
  const improvement = result.optimized.metrics.sharpeRatio - result.current.metrics.sharpeRatio;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/analysis")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Portfolio Optimization</h1>
          </div>
          <p className="text-muted-foreground">
            Optimized for {portfolioInput.riskTolerance} risk tolerance with {portfolioInput.targetReturn}% target return
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Optimization Summary</CardTitle>
            <CardDescription>
              Improved Sharpe Ratio by {improvement >= 0 ? "+" : ""}{improvement.toFixed(2)} ({((improvement / result.current.metrics.sharpeRatio) * 100).toFixed(1)}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-sm text-muted-foreground mb-1">Return Improvement</div>
                <div className={`text-xl font-mono font-bold ${result.optimized.metrics.annualizedReturn >= result.current.metrics.annualizedReturn ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {formatPercent(result.optimized.metrics.annualizedReturn - result.current.metrics.annualizedReturn)}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-sm text-muted-foreground mb-1">Volatility Change</div>
                <div className={`text-xl font-mono font-bold ${result.optimized.metrics.volatility <= result.current.metrics.volatility ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {formatPercent(result.optimized.metrics.volatility - result.current.metrics.volatility)}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-sm text-muted-foreground mb-1">Sharpe Improvement</div>
                <div className={`text-xl font-mono font-bold ${improvement >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {improvement >= 0 ? "+" : ""}{improvement.toFixed(2)}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-sm text-muted-foreground mb-1">Drawdown Change</div>
                <div className={`text-xl font-mono font-bold ${result.optimized.metrics.maxDrawdown >= result.current.metrics.maxDrawdown ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {formatPercent(result.optimized.metrics.maxDrawdown - result.current.metrics.maxDrawdown)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Current Portfolio</CardTitle>
              <CardDescription>Your existing allocation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Annual Return</div>
                  <div className="text-lg font-mono font-semibold" data-testid="current-return">
                    {formatPercent(result.current.metrics.annualizedReturn)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Volatility</div>
                  <div className="text-lg font-mono font-semibold">
                    {result.current.metrics.volatility.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Sharpe Ratio</div>
                  <div className="text-lg font-mono font-semibold" data-testid="current-sharpe">
                    {result.current.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Max Drawdown</div>
                  <div className="text-lg font-mono font-semibold text-destructive">
                    {formatPercent(result.current.metrics.maxDrawdown)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold mb-2">Holdings</div>
                {result.current.holdings.map((holding, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="font-mono font-semibold uppercase">{holding.ticker}</span>
                    <span className="font-mono">{holding.allocation.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Optimized Portfolio
              </CardTitle>
              <CardDescription>Recommended allocation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Annual Return</div>
                  <div className="text-lg font-mono font-semibold text-green-600 dark:text-green-400" data-testid="optimized-return">
                    {formatPercent(result.optimized.metrics.annualizedReturn)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Volatility</div>
                  <div className="text-lg font-mono font-semibold">
                    {result.optimized.metrics.volatility.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Sharpe Ratio</div>
                  <div className="text-lg font-mono font-semibold text-green-600 dark:text-green-400" data-testid="optimized-sharpe">
                    {result.optimized.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Max Drawdown</div>
                  <div className="text-lg font-mono font-semibold text-destructive">
                    {formatPercent(result.optimized.metrics.maxDrawdown)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold mb-2">Holdings</div>
                {result.optimized.holdings.map((holding, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="font-mono font-semibold uppercase">{holding.ticker}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{holding.allocation.toFixed(1)}%</span>
                      {holding.change !== 0 && (
                        <Badge variant={holding.change > 0 ? "default" : "secondary"} className="text-xs">
                          {formatPercent(holding.change)}
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
            <CardTitle>Optimization Recommendations</CardTitle>
            <CardDescription>
              Specific actions to improve your portfolio
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
                      <div className="font-semibold">{rec.action}</div>
                    </div>
                    <Badge variant={rec.change > 0 ? "default" : "secondary"}>
                      {formatPercent(rec.change)}
                    </Badge>
                  </div>
                  <div className="ml-7 space-y-1">
                    <div className="text-sm">
                      <span className="font-mono font-semibold uppercase">{rec.ticker}</span>:{" "}
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

        <Card>
          <CardHeader>
            <CardTitle>Efficient Frontier</CardTitle>
            <CardDescription>
              Risk-return tradeoff visualization (your position vs optimal)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  type="number"
                  dataKey="volatility"
                  name="Volatility"
                  unit="%"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: "Volatility (%)", position: "insideBottom", offset: -10 }}
                />
                <YAxis
                  type="number"
                  dataKey="return"
                  name="Return"
                  unit="%"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: "Annual Return (%)", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-popover p-3 shadow-md">
                          <div className="font-semibold mb-2">
                            {data.isCurrent ? "Current Portfolio" : data.isOptimal ? "Optimized Portfolio" : "Frontier Point"}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div>Return: <span className="font-mono font-semibold">{data.return.toFixed(2)}%</span></div>
                            <div>Volatility: <span className="font-mono font-semibold">{data.volatility.toFixed(2)}%</span></div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter
                  name="Efficient Frontier"
                  data={result.efficientFrontier.filter(p => !p.isCurrent && !p.isOptimal)}
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.4}
                />
                <Scatter
                  name="Current"
                  data={result.efficientFrontier.filter(p => p.isCurrent)}
                  fill="hsl(var(--destructive))"
                  shape="star"
                />
                <ZAxis range={[100, 100]} />
                <Scatter
                  name="Optimized"
                  data={result.efficientFrontier.filter(p => p.isOptimal)}
                  fill="hsl(var(--chart-2))"
                  shape="star"
                />
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
