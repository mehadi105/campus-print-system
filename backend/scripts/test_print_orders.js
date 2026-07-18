/**
 * Test Suite for Campus Printing System Cost & Range Calculations (SCRUM-52)
 * Run this test using: npm test
 */

const assert = require('assert');

// 1. Replicate range parsing logic
function parsePageRangeCount(rangeStr, docPages) {
    const clean = (rangeStr || '').trim().toLowerCase();
    if (!clean || clean === 'all') return docPages;
    
    let total = 0;
    const parts = clean.split(',');
    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        
        const rangeMatch = part.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            if (start > 0 && end >= start && start <= docPages && end <= docPages) {
                total += (end - start + 1);
            } else {
                return -1;
            }
        } else if (/^\d+$/.test(part)) {
            const single = parseInt(part);
            if (single > 0 && single <= docPages) {
                total += 1;
            } else {
                return -1;
            }
        } else {
            return -1;
        }
    }
    return total > 0 ? total : -1;
}

// 2. Replicate cost calculation logic
function calculateCost(pages, copies, colorMode, duplex, paperSize) {
    const isColor = colorMode === 'Color';
    const isDuplex = duplex === 'Double-Sided';
    let unitCost = isColor ? (isDuplex ? 4.0 : 5.0) : (isDuplex ? 1.5 : 2.0);
    if (paperSize === 'Legal') {
        unitCost += 1.0;
    }
    return pages * copies * unitCost;
}

// ── TEST CASES ──

console.log('=== Running Printing System Cost & Range Tests ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`[PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error(err);
    }
}

// Range Parser Tests
runTest('Page Range: "All" yields total document pages', () => {
    assert.strictEqual(parsePageRangeCount('All', 15), 15);
    assert.strictEqual(parsePageRangeCount('', 25), 25);
});

runTest('Page Range: Single page yields 1 page', () => {
    assert.strictEqual(parsePageRangeCount('5', 15), 1);
});

runTest('Page Range: Simple range yields exact span', () => {
    assert.strictEqual(parsePageRangeCount('3-7', 15), 5); // 3, 4, 5, 6, 7
});

runTest('Page Range: Comma-separated ranges and singles yield sum', () => {
    assert.strictEqual(parsePageRangeCount('1-3, 5, 8-10', 15), 7); // (3) + (1) + (3) = 7
    assert.strictEqual(parsePageRangeCount('  2 - 4 ,  6 , 9 - 9  ', 10), 5); // (3) + (1) + (1) = 5
});

runTest('Page Range: Invalid values out of bounds return -1', () => {
    assert.strictEqual(parsePageRangeCount('1-20', 15), -1); // 20 is out of bounds
    assert.strictEqual(parsePageRangeCount('18', 15), -1);   // 18 is out of bounds
    assert.strictEqual(parsePageRangeCount('0-5', 15), -1);   // 0 is out of bounds
});

runTest('Page Range: Invalid formats return -1', () => {
    assert.strictEqual(parsePageRangeCount('1-a', 15), -1);
    assert.strictEqual(parsePageRangeCount('hello', 15), -1);
    assert.strictEqual(parsePageRangeCount('1-5-9', 15), -1);
});

// Cost Calculation Tests
runTest('Cost: B&W Simplex A4 standard price', () => {
    assert.strictEqual(calculateCost(15, 1, 'Black & White', 'Single-Sided', 'A4'), 30.0);
});

runTest('Cost: B&W Duplex A4 discounted price', () => {
    assert.strictEqual(calculateCost(15, 2, 'Black & White', 'Double-Sided', 'A4'), 45.0);
});

runTest('Cost: Color Simplex A4 standard price', () => {
    assert.strictEqual(calculateCost(10, 3, 'Color', 'Single-Sided', 'A4'), 150.0);
});

runTest('Cost: Color Duplex A4 discounted price', () => {
    assert.strictEqual(calculateCost(10, 2, 'Color', 'Double-Sided', 'A4'), 80.0);
});

runTest('Cost: Legal size paper surcharge (+৳ 1.00/page)', () => {
    assert.strictEqual(calculateCost(10, 1, 'Black & White', 'Single-Sided', 'Legal'), 30.0);
    assert.strictEqual(calculateCost(10, 2, 'Color', 'Double-Sided', 'Legal'), 100.0);
});

console.log(`\n=== Test Results: ${passedTests}/${totalTests} Passed ===`);
if (passedTests === totalTests) {
    console.log('✓ All cost and range calculation tests passed successfully.');
} else {
    console.log('✗ Some tests failed. Please review assertions.');
    process.exit(1);
}
