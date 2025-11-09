# Portfolio Analyzer

A comprehensive US stock portfolio analysis and optimization platform that evaluates user portfolios using historical stock data and provides personalized recommendations.

## Overview

This application allows users to:
- Input their US stock portfolio with ticker symbols and allocation percentages
- Analyze portfolio performance with advanced metrics (Sharpe ratio, max drawdown, volatility, returns)
- Visualize historical performance with interactive charts
- Receive optimized portfolio recommendations based on risk tolerance and target returns
- Compare current vs. optimized portfolios side-by-side

## Recent Changes

### 2025-01-26
- Initial project setup with schema-first development approach
- Created comprehensive data models for portfolios, stock data, and analysis results
- Built beautiful frontend components:
  - Portfolio input form with dynamic holdings management
  - Risk profile questionnaire with visual selection
  - Analysis dashboard with performance metrics and charts
  - Optimization results page with recommendations and efficient frontier
- Implemented theme support (light/dark mode)
- Configured design system with financial dashboard aesthetic

## Project Architecture

### Frontend (`client/`)
- **React** with TypeScript for type safety
- **Wouter** for client-side routing
- **TanStack Query** for data fetching and caching
- **React Hook Form** + **Zod** for form validation
- **Recharts** for interactive data visualizations
- **Shadcn UI** components for consistent design
- **Tailwind CSS** for styling

### Backend (`server/`)
- **Express.js** server
- In-memory storage for stock price caching
- Portfolio analytics engine with custom calculations
- yfinance integration for historical stock data
- RESTful API design

### Data Models (`shared/schema.ts`)
- `PortfolioInput`: User portfolio with holdings, risk tolerance, target return
- `PortfolioHolding`: Individual stock with ticker and allocation
- `StockData`: Historical price data for each ticker
- `PortfolioAnalysis`: Complete analysis results with metrics and visualizations
- `OptimizationResult`: Optimized portfolio with recommendations

## Key Features

### 1. Portfolio Input
- Dynamic form for adding/removing holdings
- Real-time allocation validation (must total 100%)
- Risk tolerance selection (conservative/moderate/aggressive)
- Target return slider (1-30%)
- Clean, intuitive UX with immediate feedback

### 2. Portfolio Analysis
- Performance metrics display:
  - Total return over analysis period
  - Annualized return
  - Sharpe ratio (risk-adjusted return)
  - Maximum drawdown
  - Volatility
  - Best/worst years
- Interactive charts:
  - Portfolio value over time (area chart)
  - Annual returns (bar chart)
  - Drawdown history (area chart)
- Responsive layout adapting to all screen sizes

### 3. Portfolio Optimization
- Efficient frontier analysis
- Risk-optimized allocation suggestions
- Side-by-side comparison of current vs. optimized
- Detailed recommendations with rationales
- Visual scatter plot showing position on efficient frontier

## Technical Details

### Analysis Period Logic
- Default: 5-year historical analysis
- Automatic adjustment: If any stock has less than 5 years of data, use the shortest available period across all holdings
- Ensures fair comparison and accurate metrics

### Performance Calculations
- **Total Return**: `(final_value - initial_value) / initial_value * 100`
- **Annualized Return**: `((final_value / initial_value) ^ (1 / years)) - 1) * 100`
- **Volatility**: Standard deviation of daily returns × √252 (annualized)
- **Sharpe Ratio**: `(annualized_return - risk_free_rate) / volatility`
- **Max Drawdown**: Largest peak-to-trough decline during period

### Optimization Algorithm
- Mean-variance optimization framework
- Efficient frontier generation (100+ portfolio combinations)
- Risk tolerance constraints:
  - Conservative: Minimize volatility
  - Moderate: Maximize Sharpe ratio
  - Aggressive: Maximize returns
- Target return constraints applied when specified

## Design System

### Colors
- Professional financial theme with blue primary color
- Excellent contrast ratios for accessibility
- Semantic color tokens (success/green, danger/red)
- Full dark mode support

### Typography
- **Inter**: Primary sans-serif font for readability
- **JetBrains Mono**: Monospace for numerical data, tickers, percentages
- Clear hierarchy with consistent sizing

### Components
- Card-based layout for information grouping
- Subtle elevation on hover for interactive elements
- Smooth transitions and animations
- Responsive grid layouts

## API Endpoints (To Be Implemented)

### POST /api/analyze
- **Body**: `PortfolioInput`
- **Response**: `PortfolioAnalysis`
- Fetches stock data, calculates metrics, generates visualizations

### POST /api/optimize
- **Body**: `PortfolioInput`
- **Response**: `OptimizationResult`
- Performs optimization, generates efficient frontier, creates recommendations

## User Preferences

- Language: Korean support (UI labels can be localized)
- Focus: Professional, data-driven interface
- No AI integration required (custom algorithms only)

## Development Status

✅ Phase 1: Schema & Frontend (Complete)
⏳ Phase 2: Backend Implementation (Next)
⏳ Phase 3: Integration & Testing (Pending)
