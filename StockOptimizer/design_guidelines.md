# Portfolio Analyzer - Design Guidelines

## Design Approach

**Selected Approach:** Design System + Financial Platform Reference
- **Primary Inspiration:** Modern fintech dashboards (Robinhood, Interactive Brokers, TradingView analytics)
- **Supporting System:** Material Design principles for data-rich applications
- **Rationale:** Finance/analytics applications require clarity, data density, and professional credibility. Users prioritize accurate information display and efficient workflows over visual flair.

## Typography System

**Font Stack:**
- Primary: 'Inter' via Google Fonts (400, 500, 600, 700)
- Monospace: 'JetBrains Mono' for numerical data, tickers, percentages (400, 500)

**Hierarchy:**
- H1: text-4xl font-bold (Dashboard titles)
- H2: text-2xl font-semibold (Section headers)
- H3: text-xl font-semibold (Card titles, metric labels)
- Body: text-base font-normal (Descriptions, labels)
- Small: text-sm (Secondary information, timestamps)
- Numerical Data: text-lg font-mono font-medium (All financial figures, percentages, returns)
- Ticker Symbols: text-sm font-mono font-semibold uppercase

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-6 or p-8
- Section spacing: mb-8 or mb-12
- Card gaps: gap-6
- Form field spacing: space-y-4
- Tight numerical tables: gap-2

**Grid Structure:**
- Dashboard: 12-column grid (grid-cols-12) for flexible metric cards
- Comparison views: 2-column split (grid-cols-1 lg:grid-cols-2)
- Portfolio input: Single column max-w-4xl centered
- Analytics cards: 3-4 column grid on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed header with logo left, main nav center, user actions right
- Height: h-16
- Sticky positioning for scroll persistence
- Navigation items: Portfolio Input | Analysis | Optimization | History

### Dashboard Cards

**Metric Cards (KPI Display):**
- Prominent numerical value with clear label above
- Optional comparison indicator (↑ +12.5% vs benchmark)
- Min height: h-32, rounded-lg borders
- Use JetBrains Mono for all numerical displays

**Performance Chart Card:**
- Full-width card containing interactive line chart
- Time period selector tabs (1M, 3M, 6M, 1Y, 5Y, MAX)
- Tooltip on hover showing exact date and value
- Grid lines for readability
- Height: h-96 for primary chart

**Data Table Component:**
- Sticky header row
- Alternating row backgrounds for readability
- Right-aligned numerical columns with monospace font
- Sortable column headers with arrow indicators
- Compact row height with consistent padding: py-3 px-4

### Forms & Input

**Portfolio Input Interface:**
- Multi-row ticker input with allocation percentage
- Add/remove row buttons
- Real-time ticker validation with autocomplete dropdown
- Allocation total indicator (must equal 100%)
- Clear visual feedback for validation errors
- Form fields: h-12 with rounded-md borders

**Risk Questionnaire:**
- Step-by-step wizard interface (3-4 steps)
- Radio button groups for risk tolerance
- Slider input for target return percentage
- Progress indicator showing current step
- Next/Previous navigation buttons

### Data Visualization

**Chart Components (Using Chart.js):**
- **Portfolio Value Over Time:** Line chart with area fill, gridlines enabled
- **Drawdown Chart:** Filled area chart showing negative values
- **Annual Returns:** Vertical bar chart with value labels
- **Allocation Pie Chart:** Donut chart with percentage labels and legend
- **Efficient Frontier:** Scatter plot with highlighted current/optimized positions

**Chart Styling:**
- Consistent gridline opacity and spacing
- Clear axis labels with units
- Legend positioned top-right or bottom
- Responsive sizing maintaining aspect ratio
- Tooltip: rounded, semi-transparent, positioned to avoid overlap

### Comparison View

**Side-by-Side Layout:**
- Two equal-width columns (grid-cols-2)
- "Current Portfolio" left | "Optimized Portfolio" right
- Matching metric cards for easy comparison
- Visual connectors or arrows showing improvement
- Summary differences highlighted at top

**Optimization Suggestions:**
- List of recommended actions (Increase X by 5%, Decrease Y by 3%)
- Rationale for each suggestion in expandable sections
- Accept/Reject individual suggestions
- "Apply All" primary action button

### Supporting Elements

**Status Indicators:**
- Loading states: Skeleton loaders for charts and tables
- Success/Error messages: Inline alerts with icons
- Data freshness timestamp: "Last updated: 2 minutes ago"
- Progress bars for data loading/processing

**Icons:**
- Use Heroicons via CDN (outline for navigation, solid for indicators)
- TrendingUp/TrendingDown for performance indicators
- ChartBar, PieChart, Adjustments for navigation
- Plus/Minus/Trash for portfolio input actions

## Page Layouts

### 1. Portfolio Input Page
- Centered form max-w-4xl
- Header: "Build Your Portfolio"
- Ticker input table with add row button
- Risk profile questionnaire below
- Large "Analyze Portfolio" CTA button
- Spacing: Container py-12, sections mb-8

### 2. Analysis Dashboard
- Hero metrics row: 4 KPI cards (Total Return, Ann. Return, Sharpe Ratio, Max Drawdown)
- Full-width performance chart card
- Two-column grid: Annual Returns chart | Monthly Returns heatmap
- Portfolio composition table
- Historical statistics table
- All sections with consistent mb-8 spacing

### 3. Optimization Results
- Comparison header showing improvement summary
- Side-by-side portfolio cards
- Detailed recommendations list
- Efficient frontier visualization
- Action buttons: "Save Optimized" | "Adjust Parameters"

## Accessibility & Interaction

- All interactive elements have focus states with visible outlines
- Form inputs include clear labels and error messages
- Chart data accessible via screen readers (aria-labels)
- Keyboard navigation for all primary actions
- Sufficient contrast ratios for all text (WCAG AA minimum)
- Click targets minimum 44x44px

## Animation Guidelines

**Minimal Motion:**
- Chart rendering: Smooth line drawing animation (0.5s ease)
- Number changes: Counting animation for large value updates (0.3s)
- Page transitions: Simple fade-in (0.2s)
- NO: Parallax, continuous animations, decorative motion

## Professional Polish

- Consistent border radius: rounded-lg for cards, rounded-md for inputs
- Strategic use of subtle shadows for depth hierarchy
- Generous whitespace around dense data sections
- Professional, trust-building aesthetic throughout
- Data-first: Every pixel serves information delivery