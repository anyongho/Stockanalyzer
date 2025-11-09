import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import PortfolioInput from "@/pages/portfolio-input";
import AnalysisDashboard from "@/pages/analysis-dashboard";
import OptimizationResults from "@/pages/optimization-results";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PortfolioInput} />
      <Route path="/analysis" component={AnalysisDashboard} />
      <Route path="/optimize" component={OptimizationResults} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
