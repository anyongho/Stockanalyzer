// Test scenarios for sector balance and optimization
const { checkSectorBalance, applySectorBalanceAdjustments } = require('./server/sector-balance');

// Test Case 1: 100% Single Sector (Extreme violation)
console.log('\n=== TEST 1: 100% Single Sector ===');
const test1Holdings = [
    { ticker: 'AAPL', allocation: 50 },
    { ticker: 'MSFT', allocation: 30 },
    { ticker: 'GOOGL', allocation: 20 }
];

const test1Report = checkSectorBalance(test1Holdings);
console.log('Violations:', {
    hard: test1Report.hardViolations,
    soft: test1Report.softWarnings,
    score: test1Report.overallScore
});

console.log('\nChecks:');
test1Report.checks.forEach(check => {
    console.log(`  Rule ${check.rule}: ${check.status} - ${check.message}`);
});

// Test Case 2: Multiple sector violations
console.log('\n=== TEST 2: Multiple Violations ===');
const test2Holdings = [
    { ticker: 'AAPL', allocation: 25 },  // IT
    { ticker: 'MSFT', allocation: 25 },  // IT
    { ticker: 'GOOGL', allocation: 20 }, // Communication
    { ticker: 'XOM', allocation: 15 },   // Energy
    { ticker: 'CVX', allocation: 15 }    // Energy
];

const test2Report = checkSectorBalance(test2Holdings);
console.log('Violations:', {
    hard: test2Report.hardViolations,
    soft: test2Report.softWarnings,
    score: test2Report.overallScore
});

// Test Case 3: No defensive sectors
console.log('\n=== TEST 3: No Defensive Sectors ===');
const test3Holdings = [
    { ticker: 'AAPL', allocation: 30 },  // IT
    { ticker: 'JPM', allocation: 30 },   // Financials
    { ticker: 'XOM', allocation: 20 },   // Energy
    { ticker: 'CAT', allocation: 20 }    // Industrials
];

const test3Report = checkSectorBalance(test3Holdings);
console.log('Violations:', {
    hard: test3Report.hardViolations,
    soft: test3Report.softWarnings,
    score: test3Report.overallScore
});

console.log('\n=== Adjustment Test ===');
// Create a mock alignedData
const mockAlignedData = new Map();
['AAPL', 'MSFT', 'GOOGL', 'XOM', 'CVX', 'JPM', 'CAT', 'JNJ', 'PG', 'UNH'].forEach(ticker => {
    mockAlignedData.set(ticker, [{ date: '2024-01-01', adjClose: 100 }]);
});

console.log('\nAdjusting Test 1 (100% IT)...');
const adjusted1 = applySectorBalanceAdjustments(test1Holdings, test1Report, mockAlignedData);
console.log('Adjusted holdings:', adjusted1);

const adjusted1Report = checkSectorBalance(adjusted1);
console.log('After adjustment:', {
    hard: adjusted1Report.hardViolations,
    soft: adjusted1Report.softWarnings,
    score: adjusted1Report.overallScore
});
