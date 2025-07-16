const fetch = require('node-fetch');

async function testVitaminMapping() {
    try {
        // Test various B12 variations
        const b12Variations = ['vit b12', 'vitamin b12', 'b12', 'vit b-12', 'vitamin b-12'];

        for (const variation of b12Variations) {
            console.log(`\nTesting B12 variation: "${variation}"`);
            const response = await fetch('http://localhost:10000/api/estimate-test-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testNames: variation })
            });

            const data = await response.json();
            if (data.success && data.estimation.tests.length > 0) {
                const test = data.estimation.tests[0];
                console.log(`  → ${test.name} (₹${test.price})`);
            } else {
                console.log('  → No match found');
            }
        }

        // Test various Vitamin D variations
        const vitDVariations = ['vit d', 'vitamin d', 'vitamin d3'];

        for (const variation of vitDVariations) {
            console.log(`\nTesting Vitamin D variation: "${variation}"`);
            const response = await fetch('http://localhost:10000/api/estimate-test-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testNames: variation })
            });

            const data = await response.json();
            if (data.success && data.estimation.tests.length > 0) {
                const test = data.estimation.tests[0];
                console.log(`  → ${test.name} (₹${test.price})`);
            } else {
                console.log('  → No match found');
            }
        }
        
        // Also get the price list to see what vitamin tests are available
        console.log('\nGetting available vitamin tests...');
        const priceResponse = await fetch('http://localhost:10000/api/blood-test-prices');
        const priceData = await priceResponse.json();
        
        const vitaminTests = priceData.priceList.filter(test => 
            test.testName.toLowerCase().includes('vitamin') || 
            test.testName.toLowerCase().includes('b12') ||
            test.testName.toLowerCase().includes('b-12')
        );
        
        console.log('Available vitamin tests:');
        vitaminTests.forEach(test => {
            console.log(`- ${test.testName} (Price: ₹${test.price})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testVitaminMapping();
