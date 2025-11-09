import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { portfolioInputSchema, type PortfolioInput, type PortfolioHolding } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, TrendingUp, Target, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function PortfolioInput() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "holdings",
  });

  const totalAllocation = form.watch("holdings").reduce((sum, h) => sum + (Number(h.allocation) || 0), 0);

  const onSubmit = async (data: PortfolioInput) => {
    if (Math.abs(totalAllocation - 100) > 0.01) {
      toast({
        title: "Invalid Allocation",
        description: "Total allocation must equal 100%",
        variant: "destructive",
      });
      return;
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-12 px-4">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-3">Portfolio Analyzer</h1>
          <p className="text-lg text-muted-foreground">
            Analyze and optimize your US stock portfolio with advanced metrics
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Portfolio Holdings
                </CardTitle>
                <CardDescription>
                  Enter your stock tickers and their allocation percentages. Total must equal 100%.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-4">
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
                                data-testid={`input-ticker-${index}`}
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
                          <FormItem className="w-32">
                            {index === 0 && <FormLabel>Allocation %</FormLabel>}
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="25.00"
                                className="font-mono"
                                data-testid={`input-allocation-${index}`}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
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
                          className={index === 0 ? "mt-8" : ""}
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ ticker: "", allocation: 0 })}
                    data-testid="button-add-holding"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Holding
                  </Button>
                  <div className="text-sm font-mono">
                    Total: <span className={totalAllocation === 100 ? "text-green-600 dark:text-green-400 font-semibold" : totalAllocation > 100 ? "text-destructive font-semibold" : "text-muted-foreground"}>{totalAllocation.toFixed(2)}%</span>
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
                          data-testid="radio-risk-tolerance"
                        >
                          <label
                            htmlFor="conservative"
                            className={`flex items-start space-x-3 space-y-0 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                              field.value === "conservative"
                                ? "border-primary bg-primary/5"
                                : "border-border hover-elevate"
                            }`}
                          >
                            <RadioGroupItem value="conservative" id="conservative" />
                            <div className="flex-1">
                              <div className="font-semibold mb-1">Conservative</div>
                              <div className="text-sm text-muted-foreground">
                                Prioritize capital preservation with lower volatility
                              </div>
                            </div>
                          </label>
                          <label
                            htmlFor="moderate"
                            className={`flex items-start space-x-3 space-y-0 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                              field.value === "moderate"
                                ? "border-primary bg-primary/5"
                                : "border-border hover-elevate"
                            }`}
                          >
                            <RadioGroupItem value="moderate" id="moderate" />
                            <div className="flex-1">
                              <div className="font-semibold mb-1">Moderate</div>
                              <div className="text-sm text-muted-foreground">
                                Balance growth and stability with moderate risk
                              </div>
                            </div>
                          </label>
                          <label
                            htmlFor="aggressive"
                            className={`flex items-start space-x-3 space-y-0 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                              field.value === "aggressive"
                                ? "border-primary bg-primary/5"
                                : "border-border hover-elevate"
                            }`}
                          >
                            <RadioGroupItem value="aggressive" id="aggressive" />
                            <div className="flex-1">
                              <div className="font-semibold mb-1">Aggressive</div>
                              <div className="text-sm text-muted-foreground">
                                Seek maximum growth with higher volatility
                              </div>
                            </div>
                          </label>
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
                          data-testid="slider-target-return"
                        />
                      </FormControl>
                      <FormDescription>
                        Your desired annual return percentage (realistic range: 5-20%)
                      </FormDescription>
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
                disabled={isAnalyzing || totalAllocation !== 100}
                data-testid="button-analyze"
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Portfolio"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
