const geminiService = require('./gemini-service');

class TestPriceService {
    constructor() {
        this.singleTests = [];
        this.packages = [];
        this.initialized = false;
    }

    /**
     * Initialize the service with price list data
     */
    async initialize(singleTests, packages) {
        this.singleTests = singleTests || [];
        this.packages = packages || [];
        this.initialized = true;
        console.log(`TestPriceService initialized with ${this.singleTests.length} single tests and ${this.packages.length} packages`);
    }

    /**
     * Main function to estimate test prices
     */
    async estimateTestPrice(testInput) {
        if (!this.initialized) {
            throw new Error('TestPriceService not initialized');
        }

        try {
            console.log('Estimating price for:', testInput);

            // Step 1: Parse test names using Gemini AI
            const parseResult = await geminiService.parseTestNames(testInput, this.singleTests, this.packages);
            
            if (!parseResult.success) {
                console.log('Gemini parsing failed, using fallback:', parseResult.fallback);
                return this.calculatePriceFromParsedTests(parseResult.fallback);
            }

            const parsedTests = parseResult.result;
            console.log('Gemini parsed tests:', parsedTests);

            // Step 2: Calculate prices for identified tests
            const priceCalculation = this.calculatePriceFromParsedTests(parsedTests);

            // Step 3: Find relevant package recommendations based on test overlap
            if (parsedTests.isMultiple && parsedTests.tests.length > 1) {
                const enteredTestNames = parsedTests.tests.map(t => t.name);
                priceCalculation.packageRecommendations = this.findRelevantPackages(enteredTestNames);
            } else {
                priceCalculation.packageRecommendations = [];
            }

            return priceCalculation;

        } catch (error) {
            console.error('Error estimating test price:', error);
            return {
                success: false,
                error: error.message,
                totalPrice: 0,
                tests: [],
                recommendations: []
            };
        }
    }

    /**
     * Calculate price from parsed test results
     */
    calculatePriceFromParsedTests(parsedTests) {
        const result = {
            success: true,
            isMultiple: parsedTests.isMultiple,
            tests: [],
            totalPrice: 0,
            recommendations: [],
            reasoning: parsedTests.reasoning || ''
        };

        // Calculate price for each identified test
        parsedTests.tests.forEach(test => {
            const priceInfo = this.findTestPrice(test.name, test.type);
            
            if (priceInfo.found) {
                result.tests.push({
                    name: test.name,
                    type: test.type,
                    price: priceInfo.price,
                    confidence: test.confidence,
                    serviceCode: priceInfo.serviceCode
                });
                result.totalPrice += priceInfo.price;
            } else {
                result.tests.push({
                    name: test.name,
                    type: test.type,
                    price: 0,
                    confidence: test.confidence,
                    error: 'Test not found in price list'
                });
            }
        });

        return result;
    }

    /**
     * Find price for a specific test
     */
    findTestPrice(testName, testType) {
        const searchList = testType === 'package' ? this.packages : this.singleTests;
        
        // Exact match first
        let match = searchList.find(test => 
            test.testName.toLowerCase() === testName.toLowerCase()
        );

        // Fuzzy match if exact match fails
        if (!match) {
            match = searchList.find(test => 
                test.testName.toLowerCase().includes(testName.toLowerCase()) ||
                testName.toLowerCase().includes(test.testName.toLowerCase())
            );
        }

        if (match) {
            return {
                found: true,
                price: match.price,
                serviceCode: match.serviceCode,
                exactMatch: match.testName.toLowerCase() === testName.toLowerCase()
            };
        }

        return { found: false, price: 0 };
    }

    /**
     * Evaluate package recommendations against individual test prices
     */
    evaluatePackageRecommendations(recommendations, individualTotal) {
        const evaluatedRecs = [];

        recommendations.forEach(rec => {
            const packagePrice = this.findTestPrice(rec.packageName, 'package');
            
            if (packagePrice.found) {
                const savings = individualTotal - packagePrice.price;
                const savingsPercentage = individualTotal > 0 ? (savings / individualTotal) * 100 : 0;

                evaluatedRecs.push({
                    packageName: rec.packageName,
                    packagePrice: packagePrice.price,
                    individualTotal: individualTotal,
                    savings: savings,
                    savingsPercentage: savingsPercentage,
                    containsTests: rec.containsTests,
                    additionalTests: rec.additionalTests,
                    coverage: rec.coverage,
                    recommendation: rec.recommendation,
                    isRecommended: savings > 0
                });
            }
        });

        // Sort by savings (highest first)
        return evaluatedRecs.sort((a, b) => b.savings - a.savings);
    }

    /**
     * Find relevant packages based on test overlap with entered tests
     * Only recommends packages where 70% or more of entered tests are covered
     */
    findRelevantPackages(enteredTestNames) {
        const recommendations = [];
        const OVERLAP_THRESHOLD = 0.7; // 70% overlap required

        // Get package details from Google Sheets (we need to parse column G - Test Details)
        this.packages.forEach(pkg => {
            const packageTestDetails = this.getPackageTestDetails(pkg.testName);
            if (!packageTestDetails || packageTestDetails.length === 0) {
                return; // Skip if no test details available
            }

            // Calculate overlap between entered tests and package tests
            const overlap = this.calculateTestOverlap(enteredTestNames, packageTestDetails);

            if (overlap.percentage >= OVERLAP_THRESHOLD) {
                recommendations.push({
                    packageName: pkg.testName,
                    packagePrice: pkg.price,
                    serviceCode: pkg.serviceCode,
                    overlapPercentage: overlap.percentage,
                    matchedTests: overlap.matchedTests,
                    additionalTests: overlap.additionalTests,
                    missingTests: overlap.missingTests,
                    totalPackageTests: packageTestDetails.length,
                    isRecommended: true,
                    savings: this.calculateIndividualTestsPrice(enteredTestNames) - pkg.price,
                    note: `${Math.round(overlap.percentage * 100)}% of your tests are included in this package`
                });
            }
        });

        // Sort by overlap percentage (highest first), then by price (lowest first)
        recommendations.sort((a, b) => {
            // First sort by overlap percentage (higher is better)
            if (b.overlapPercentage !== a.overlapPercentage) {
                return b.overlapPercentage - a.overlapPercentage;
            }
            // If overlap is the same, sort by price (lower is better)
            return a.packagePrice - b.packagePrice;
        });

        // If we have multiple packages with 100% match, only return the cheapest one
        const perfectMatches = recommendations.filter(pkg => pkg.overlapPercentage === 1.0);
        if (perfectMatches.length > 1) {
            // Return only the cheapest perfect match plus any partial matches
            const cheapestPerfectMatch = perfectMatches[0]; // Already sorted by price
            const partialMatches = recommendations.filter(pkg => pkg.overlapPercentage < 1.0);
            return [cheapestPerfectMatch, ...partialMatches];
        }

        return recommendations;
    }

    /**
     * Get package test details from the stored package data
     * This would need to be enhanced to parse column G from Google Sheets
     */
    getPackageTestDetails(packageName) {
        // For now, return mock data based on known packages
        // In a real implementation, this would parse column G from the Google Sheets
        const packageTestMap = {
            'Neuberg Diabetes Care - Basic': [
                'Glucose - Fasting', 'Glyco Hemoglobin', 'Insulin Fasting', 'Microalbumin Level from urine'
            ],
            'Neuberg Diabetes Care - Intermediate': [
                'Glucose - Fasting', 'Glyco Hemoglobin', 'Liver Function Test', 'Lipid Profile',
                'Urea', 'Creatinine', 'Uric Acid', 'Blood Urea Nitrogen (BUN)', 'Electrolytes',
                'Calcium', 'Insulin Fasting', 'Microalbumin Level from urine'
            ],
            'Neuberg Full Body Health Checkup - Express': [
                'CBC', 'Glucose - Fasting', 'Glyco Hemoglobin', 'Liver Function Test',
                'Free Thyroxine(Free T4)', 'Free Triiodothyronine(Free T3)', 'TSH',
                'Lipid Profile', 'Urea', 'Creatinine', 'Uric Acid', 'Urine Examination'
            ],
            'Neuberg Full Body Health Checkup - Vita plus': [
                'CBC', 'Glucose - Fasting', 'Glyco Hemoglobin', 'Liver Function Test',
                'Free Thyroxine(Free T4)', 'Free Triiodothyronine(Free T3)', 'TSH',
                'Lipid Profile', 'Urea', 'Creatinine', 'Uric Acid', 'Urine Examination',
                'Electrolytes', 'Calcium', '25 OH Cholecalciferol (D2+D3)', 'Iron Level'
            ],
            'Comprehensive Full Body Checkup - Male': [
                'CBC', 'Glucose - Fasting', 'Glucose - Post Prandial', 'Glyco Hemoglobin',
                'Liver Function Test', 'Free Thyroxine(Free T4)', 'Free Triiodothyronine(Free T3)',
                'TSH', 'Lipid Profile', 'Urea', 'Creatinine', 'Uric Acid', 'Blood Urea Nitrogen (BUN)',
                'Urine Examination', 'Electrolytes', 'Calcium', '25 OH Cholecalciferol (D2+D3)',
                'Iron Level', 'Prostate Specific Antigen level', 'High Sensitive CRP', 'Amylase-Serum', 'Lipase'
            ],
            'Comprehensive Full Body Checkup - Female': [
                'CBC', 'Glucose - Fasting', 'Glucose - Post Prandial', 'Glyco Hemoglobin',
                'Liver Function Test', 'Free Thyroxine(Free T4)', 'Free Triiodothyronine(Free T3)',
                'TSH', 'Lipid Profile', 'Urea', 'Creatinine', 'Uric Acid', 'Blood Urea Nitrogen (BUN)',
                'Urine Examination', 'Electrolytes', 'Calcium', '25 OH Cholecalciferol (D2+D3)',
                'Iron Level', 'CA-125 level', 'High Sensitive CRP', 'Amylase-Serum', 'Lipase'
            ]
        };

        return packageTestMap[packageName] || [];
    }

    /**
     * Calculate overlap between entered tests and package tests
     */
    calculateTestOverlap(enteredTests, packageTests) {
        const normalizeTestName = (name) => {
            return name.toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/[()]/g, '')
                .trim();
        };

        const normalizedEnteredTests = enteredTests.map(normalizeTestName);
        const normalizedPackageTests = packageTests.map(normalizeTestName);

        const matchedTests = [];
        const missingTests = [];

        // Check which entered tests are covered by the package
        normalizedEnteredTests.forEach((enteredTest, index) => {
            const isMatched = normalizedPackageTests.some(packageTest => {
                // Check for exact match or partial match
                return packageTest.includes(enteredTest) || enteredTest.includes(packageTest);
            });

            if (isMatched) {
                matchedTests.push(enteredTests[index]); // Use original name
            } else {
                missingTests.push(enteredTests[index]); // Use original name
            }
        });

        // Find additional tests in package that weren't requested
        const additionalTests = packageTests.filter(packageTest => {
            const normalizedPackageTest = normalizeTestName(packageTest);
            return !normalizedEnteredTests.some(enteredTest => {
                return normalizedPackageTest.includes(enteredTest) || enteredTest.includes(normalizedPackageTest);
            });
        });

        const overlapPercentage = matchedTests.length / enteredTests.length;

        return {
            percentage: overlapPercentage,
            matchedTests,
            missingTests,
            additionalTests
        };
    }

    /**
     * Calculate total price for individual tests
     */
    calculateIndividualTestsPrice(testNames) {
        let totalPrice = 0;

        testNames.forEach(testName => {
            const test = this.singleTests.find(t =>
                t.testName.toLowerCase() === testName.toLowerCase()
            );
            if (test) {
                totalPrice += test.price;
            }
        });

        return totalPrice;
    }

    /**
     * Get the lowest price option (individual tests vs packages)
     */
    getLowestPriceOption(estimation) {
        if (!estimation.success) {
            return estimation;
        }

        let lowestOption = {
            type: 'individual',
            price: estimation.totalPrice,
            tests: estimation.tests,
            description: 'Individual tests'
        };

        // Since we don't have package contents, we can't automatically recommend packages
        // Users will need to manually check if packages contain their required tests

        return {
            ...estimation,
            lowestPriceOption: lowestOption
        };
    }
}

module.exports = new TestPriceService();
