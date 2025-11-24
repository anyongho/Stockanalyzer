import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { portfolioInputSchema, type PortfolioInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, TrendingUp, Target, Shield, GripVertical, Search, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Company {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  founded: string;
}

export default function PortfolioInput() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [useAmountInput, setUseAmountInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<PortfolioInput>({
    resolver: zodResolver(portfolioInputSchema),
    defaultValues: {
      holdings: [
        { ticker: "", allocation: 0 },
      ],
      riskTolerance: "moderate",
      targetReturn: 10,
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "holdings",
  });

  // Fetch available tickers with metadata
  const { data: companyData } = useQuery({
    queryKey: ["tickers"],
    queryFn: async () => {
      const res = await fetch("/api/tickers");
      if (!res.ok) throw new Error("Failed to fetch tickers");
      const data = await res.json();
      // Handle both old format { tickers: string[] } and new format { companies: Company[] }
      if (data.companies) return data.companies as Company[];
      if (data.tickers) return data.tickers.map((t: any) => typeof t === 'string' ? { ticker: t, name: t, description: "", founded: "" } : t) as Company[];
      return [] as Company[];
    },
  });

  const filteredCompanies = companyData?.filter(c =>
    c.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Watch holdings to calculate totals
  const holdings = form.watch("holdings");

  // Calculate total allocation or amount
  const totalValue = holdings.reduce((sum, h) => {
    // In amount mode, we treat 'allocation' field as amount temporarily
    return sum + (Number(h.allocation) || 0);
  }, 0);

  const onSubmit = async (data: PortfolioInput) => {
    // If using amount input, convert to percentages
    if (useAmountInput) {
      if (totalValue === 0) {
        toast({
          title: "Invalid Amount",
          description: "Total investment amount must be greater than 0",
          variant: "destructive",
        });
        return;
      }

      // Convert amounts to percentages
      data.holdings = data.holdings.map(h => ({
        ticker: h.ticker,
        allocation: Number(((h.allocation / totalValue) * 100).toFixed(2))
      }));

      // Adjust last item to ensure exactly 100% due to rounding
      const currentSum = data.holdings.reduce((sum, h) => sum + h.allocation, 0);
      const diff = 100 - currentSum;
      if (Math.abs(diff) > 0.001) {
        data.holdings[data.holdings.length - 1].allocation += diff;
      }
    } else {
      // Percentage mode validation
      if (Math.abs(totalValue - 100) > 0.01) {
        toast({
          title: "Invalid Allocation",
          description: "Total allocation must equal 100%",
          variant: "destructive",
        });
        return;
      }
    }

    setIsAnalyzing(true);
    try {
      localStorage.setItem("portfolio-input", JSON.stringify(data));
      setLocation("/analysis");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process portfolio",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, ticker: string) => {
    e.dataTransfer.setData("ticker", ticker);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const ticker = e.dataTransfer.getData("ticker");
    if (ticker) {
      // Check if ticker already exists
      const exists = holdings.some(h => h.ticker === ticker);
      if (!exists) {
        // If the last row is empty, update it, otherwise append
        const lastIdx = fields.length - 1;
        if (lastIdx >= 0 && !holdings[lastIdx].ticker) {
          update(lastIdx, { ticker, allocation: 0 });
        } else {
          append({ ticker, allocation: 0 });
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
                <div className="mb-8 text-center">
                  <h1 className="text-4xl font-bold mb-3">포트폴리오 분석기</h1>
                  <p className="text-lg text-muted-foreground">
                    고급 지표를 사용하여 미국 주식 포트폴리오를 분석하고 최적화하세요
                  </p>
                </div>
        
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Main Form Area */}
                  <div className="lg:col-span-2">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          className="border-dashed border-2 border-transparent hover:border-primary/20 transition-colors"
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Portfolio Holdings
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Label htmlFor="input-mode" className="text-sm font-medium">
                                  {useAmountInput ? "Amount ($)" : "Percentage (%)"}
                                </Label>
                                <Switch
                                  id="input-mode"
                                  checked={useAmountInput}
                                  onCheckedChange={setUseAmountInput}
                                />
                              </div>
                            </div>
                            <CardDescription>
                              {useAmountInput
                                ? "Enter the investment amount for each stock. We'll calculate the weights."
                                : "Enter allocation percentages. Total must equal 100%."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="space-y-4">
                              {fields.map((field, index) => (
                                <div key={field.id} className="flex items-start gap-4 p-2 rounded-lg hover:bg-accent/50 transition-colors group">
                                  <div className="mt-3 text-muted-foreground cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  <FormField
                                    control={form.control}
                                    name={`holdings.${index}.ticker`}
                                    render={({ field }) => (
                                      <FormItem className="flex-1">
                                        {index === 0 && <FormLabel>Ticker Symbol</FormLabel>}
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="AAPL"
                                            className="uppercase font-mono"
                                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`holdings.${index}.allocation`}
                                    render={({ field }) => (
                                      <FormItem className="w-40">
                                        {index === 0 && <FormLabel>{useAmountInput ? "Amount" : "Allocation %"}</FormLabel>}
                                        <FormControl>
                                          <div className="relative">
                                            <Input
                                              {...field}
                                              type="number"
                                              step={useAmountInput ? "1" : "0.01"}
                                              min="0"
                                              placeholder={useAmountInput ? "10000" : "25.00"}
                                              className="font-mono pr-12"
                                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                            {useAmountInput && totalValue > 0 && (
                                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                                                {((field.value / totalValue) * 100).toFixed(1)}%
                                              </div>
                                            )}
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => remove(index)}
                                      className={index === 0 ? "mt-8" : "mt-0"}
                                    >
                                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
        
                            <div className="flex items-center justify-between pt-4 border-t">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ ticker: "", allocation: 0 })}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Holding
                              </Button>
                              <div className="text-right">
                                <div className="text-sm font-mono">
                                  Total: <span className={
                                    (!useAmountInput && Math.abs(totalValue - 100) < 0.01) || (useAmountInput && totalValue > 0)
                                      ? "text-green-600 dark:text-green-400 font-semibold"
                                      : "text-destructive font-semibold"
                                  }>
                                    {useAmountInput
                                      ? `${totalValue.toLocaleString()}`
                                      : `${totalValue.toFixed(2)}%`
                                    }
                                  </span>
                                </div>
                                {useAmountInput && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Weighted average calculation enabled
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
        
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              Risk Profile
                            </CardTitle>
                            <CardDescription>
                              Help us understand your investment preferences
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <FormField
                              control={form.control}
                              name="riskTolerance"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Risk Tolerance</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                    >
                                      {["conservative", "moderate", "aggressive"].map((risk) => (
                                        <label
                                          key={risk}
                                          htmlFor={risk}
                                          className={`flex items-start space-x-3 space-y-0 rounded-lg border-2 p-4 cursor-pointer transition-colors ${field.value === risk
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-accent"
                                            }`}
                                        >
                                          <RadioGroupItem value={risk} id={risk} />
                                          <div className="flex-1 capitalize">
                                            <div className="font-semibold mb-1">{risk}</div>
                                            <div className="text-sm text-muted-foreground">
                                              {risk === "conservative" && "Prioritize capital preservation"}
                                              {risk === "moderate" && "Balance growth and stability"}
                                              {risk === "aggressive" && "Seek maximum growth"}
                                            </div>
                                          </div>
                                        </label>
                                      ))}
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
        
                            <FormField
                              control={form.control}
                              name="targetReturn"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center gap-2">
                                    <Target className="h-4 w-4" />
                                    Target Annual Return: <span className="font-mono font-semibold">{field.value}%</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Slider
                                      min={1}
                                      max={30}
                                      step={0.5}
                                      value={[field.value || 10]}
                                      onValueChange={(vals) => field.onChange(vals[0])}
                                      className="py-4"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>
        
                        <div className="flex justify-center">
                                            <Button
                                              type="submit"
                                              size="lg"
                                              className="w-full md:w-auto px-12"
                                              disabled={isAnalyzing || (!useAmountInput && Math.abs(totalValue - 100) > 0.01)}
                                            >
                                              {isAnalyzing ? "분석 중..." : "포트폴리오 분석"}
                                            </Button>                        </div>
                      </form>
                    </Form>
                  </div>
                  
                  {/* Sidebar - Ticker List */}
                  <div className="lg:col-span-1">
                    <Card className="h-full max-h-[800px] flex flex-col sticky top-8">
                      <CardHeader>
                        <CardTitle>Available Companies</CardTitle>
                        <CardDescription>
                          Drag and drop to add to portfolio
                        </CardDescription>
                        <div className="relative mt-2">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by ticker or name..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-[600px] px-4 pb-4">
                          <div className="grid grid-cols-1 gap-2">
                            {filteredCompanies.map((company) => (
                              <TooltipProvider key={company.ticker}>
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <div
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, company.ticker)}
                                      className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent cursor-grab active:cursor-grabbing transition-colors group"
                                    >
                                      <div className="flex flex-col items-start overflow-hidden">
                                        <span className="font-bold font-mono text-sm">{company.ticker}</span>
                                        <span className="text-xs text-muted-foreground truncate w-full text-left" title={company.name}>
                                          {company.name}
                                        </span>
                                      </div>
                                      <Info className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[300px] p-4">
                                    <div className="space-y-2">
                                      <div className="font-bold">{company.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {company.sector} | {company.industry}
                                      </div>
                                      {company.founded && (
                                        <div className="text-xs text-muted-foreground">
                                          Founded: {company.founded}
                                        </div>
                                      )}
                                      <div className="text-xs line-clamp-6 pt-2 border-t mt-2">
                                        {company.description}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {filteredCompanies.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                No companies found
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
