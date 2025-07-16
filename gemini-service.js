const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        this.apiKey = process.env.API || process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            throw new Error('Gemini API key not found. Please set API or GEMINI_API_KEY environment variable.');
        }
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    /**
     * Parse test names and determine if they are single tests or multiple tests
     * @param {string} testInput - The input test names string
     * @param {Array} singleTests - Array of single test names from price list
     * @param {Array} packages - Array of package names from price list
     * @returns {Object} - Parsed result with test classification
     */
    /**
     * Normalize test names by mapping common abbreviations to full names
     */
    normalizeTestNames(testInput) {
        const abbreviationMap = {
            // Common diabetes/blood sugar tests
            'hba1c': 'Glyco Hemoglobin',
            'hb a1c': 'Glyco Hemoglobin',
            'a1c': 'Glyco Hemoglobin',
            'glycohemoglobin': 'Glyco Hemoglobin',
            'fbs': 'Glucose - Fasting',
            'ppbs': 'Glucose - Post Prandial',
            'rbs': 'Glucose - Random',

            // Lipid profile variations
            'lipid': 'Lipid Profile',
            'lipids': 'Lipid Profile',
            'cholesterol': 'Lipid Profile',

            // Vitamin tests - Updated to match exact test names in Price_list_bloodtest sheet
            'vit d': 'Vitamin D total - 25 hydroxy (Serum/LCMS)#',
            'vitamin d': 'Vitamin D total - 25 hydroxy (Serum/LCMS)#',
            'vitamin d3': 'Vitamin D total - 25 hydroxy (Serum/LCMS)#',
            'vit b12': 'Vitamin B - 12 Level',
            'vitamin b12': 'Vitamin B - 12 Level',
            'b12': 'Vitamin B - 12 Level',
            'vit b-12': 'Vitamin B - 12 Level',
            'vitamin b-12': 'Vitamin B - 12 Level',
            'vit c': 'Vitamin C',
            'vitamin c': 'Vitamin C',

            // Thyroid tests
            'tsh': 'TSH',
            't3': 'Free Triiodothyronine(Free T3)',
            't4': 'Free Thyroxine(Free T4)',
            'free t3': 'Free Triiodothyronine(Free T3)',
            'free t4': 'Free Thyroxine(Free T4)',

            // Liver function
            'lft': 'Liver Function Test',
            'liver function': 'Liver Function Test',
            'sgpt': 'SGPT',
            'sgot': 'SGOT',
            'alt': 'SGPT',
            'ast': 'SGOT',

            // Kidney function
            'kft': 'Kidney Function Test',
            'kidney function': 'Kidney Function Test',
            'creat': 'Creatinine',
            'bun': 'Blood Urea Nitrogen (BUN)',

            // Complete blood count
            'cbc': 'CBC',
            'complete blood count': 'CBC',
            'hemogram': 'CBC',

            // Other common abbreviations
            'esr': 'ESR',
            'crp': 'C-Reactive Protein',
            'uric': 'Uric Acid',
            'calcium': 'Calcium',
            'iron': 'Iron Level',
            'ferritin': 'Ferritin Level'
        };

        // Normalize the input by converting to lowercase and mapping abbreviations
        let normalizedInput = testInput.toLowerCase();

        // Replace abbreviations with full names
        Object.keys(abbreviationMap).forEach(abbrev => {
            const fullName = abbreviationMap[abbrev];
            // Use word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
            normalizedInput = normalizedInput.replace(regex, fullName);
        });

        return normalizedInput;
    }

    async parseTestNames(testInput, singleTests, packages) {
        try {
            // First normalize the test input to handle abbreviations
            const normalizedInput = this.normalizeTestNames(testInput);
            console.log(`Original input: "${testInput}"`);
            console.log(`Normalized input: "${normalizedInput}"`);

            const singleTestNames = singleTests.map(t => t.testName).join('\n');
            const packageNames = packages.map(p => p.testName).join('\n');

            const prompt = `
You are a medical test name parser. Your task is to analyze the input test names and determine if they represent single tests or multiple tests.

SINGLE TESTS LIST:
${singleTestNames}

PACKAGE TESTS LIST:
${packageNames}

INPUT TO ANALYZE: "${normalizedInput}"

IMPORTANT RULES:
1. Some single tests contain commas (like "1,3-Beta D Glucan Level") - these are SINGLE tests, not multiple
2. Multiple tests are separated by commas AND each part should be a valid test name
3. Use the provided lists to verify if each part is a valid test name
4. If a comma-separated part matches a single test exactly, treat it as one test
5. Only split on commas if each resulting part is a valid test name
6. PRESERVE ALL SPECIAL CHARACTERS including #, (), -, etc. in test names - return the EXACT test name from the list

PARSING LOGIC:
1. First, check if the entire input matches a single test name exactly
2. If not, try splitting by commas and check each part
3. For each part, find the best match from single tests or packages
4. If a part doesn't match any test, try extending it with the next comma-separated part

Please respond with a JSON object in this exact format:
{
    "isMultiple": boolean,
    "tests": [
        {
            "name": "exact test name",
            "type": "single" or "package",
            "confidence": 0.0 to 1.0
        }
    ],
    "reasoning": "explanation of your decision"
}

Example responses:
- For "1,3-Beta D Glucan Level": {"isMultiple": false, "tests": [{"name": "1,3-Beta D Glucan Level", "type": "single", "confidence": 1.0}]}
- For "CBC,ESR": {"isMultiple": true, "tests": [{"name": "CBC", "type": "single", "confidence": 1.0}, {"name": "ESR", "type": "single", "confidence": 1.0}]}
- For "Vitamin D total - 25 hydroxy (Serum/LCMS)#": {"isMultiple": false, "tests": [{"name": "Vitamin D total - 25 hydroxy (Serum/LCMS)#", "type": "single", "confidence": 1.0}]}
`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log('Gemini raw response:', text);
            
            // Parse JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedResult = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    result: parsedResult
                };
            } else {
                throw new Error('Invalid JSON response from Gemini');
            }

        } catch (error) {
            console.error('Error parsing test names with Gemini:', error);
            return {
                success: false,
                error: error.message,
                fallback: this.fallbackParsing(testInput, singleTests, packages)
            };
        }
    }

    /**
     * Fallback parsing logic when Gemini fails
     */
    fallbackParsing(testInput, singleTests, packages) {
        const allTests = [...singleTests, ...packages];
        
        // First try exact match
        const exactMatch = allTests.find(test => 
            test.testName.toLowerCase() === testInput.toLowerCase()
        );
        
        if (exactMatch) {
            return {
                isMultiple: false,
                tests: [{
                    name: exactMatch.testName,
                    type: exactMatch.type,
                    confidence: 1.0
                }],
                reasoning: "Exact match found"
            };
        }

        // Try comma splitting with progressive matching
        const parts = testInput.split(',').map(p => p.trim());
        const foundTests = [];
        let currentPart = '';
        
        for (let i = 0; i < parts.length; i++) {
            currentPart = currentPart ? `${currentPart},${parts[i]}` : parts[i];
            
            const match = allTests.find(test => 
                test.testName.toLowerCase().includes(currentPart.toLowerCase()) ||
                currentPart.toLowerCase().includes(test.testName.toLowerCase())
            );
            
            if (match) {
                foundTests.push({
                    name: match.testName,
                    type: match.type,
                    confidence: 0.8
                });
                currentPart = '';
            }
        }

        return {
            isMultiple: foundTests.length > 1,
            tests: foundTests.length > 0 ? foundTests : [{
                name: testInput,
                type: 'unknown',
                confidence: 0.1
            }],
            reasoning: "Fallback parsing used"
        };
    }

    /**
     * Find package recommendations for a list of tests
     * This is a simplified version that doesn't use AI for package analysis
     * since we don't have detailed package contents in the sheet
     */
    async findPackageRecommendations(testNames, singleTests, packages) {
        try {
            // For now, return empty recommendations since we don't have
            // detailed package contents in the Price_list_bloodtest sheet
            // The package column (F) only contains package names, not their contents

            return {
                success: true,
                result: {
                    recommendations: []
                }
            };

        } catch (error) {
            console.error('Error finding package recommendations:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new GeminiService();
