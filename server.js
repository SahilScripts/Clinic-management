const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const testPriceService = require('./test-price-service');

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Load Google Sheets credentials
let credentials;
if (process.env.GOOGLE_CREDENTIALS) {
    // Production: Use environment variable
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} else {
    console.error('GOOGLE_CREDENTIALS environment variable is required');
    console.error('Please set up your environment variables. See ENVIRONMENT_SETUP.md for details.');
    process.exit(1);
}

// Google Sheets configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
if (!SPREADSHEET_ID) {
    console.error('SPREADSHEET_ID environment variable is required');
    process.exit(1);
}

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// Helper function to get next Tuesday or Friday
function getNextTestDate() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Tuesday = 2, Friday = 5
    const tuesday = 2;
    const friday = 5;

    let daysToAdd = 0;

    if (currentDay < tuesday) {
        // If today is before Tuesday, next test is this Tuesday
        daysToAdd = tuesday - currentDay;
    } else if (currentDay < friday) {
        // If today is Tuesday, Wednesday, or Thursday, next test is this Friday
        daysToAdd = friday - currentDay;
    } else {
        // If today is Friday, Saturday, or Sunday, next test is next Tuesday
        daysToAdd = (7 - currentDay) + tuesday;
    }

    const nextTestDate = new Date(today);
    nextTestDate.setDate(today.getDate() + daysToAdd);

    return nextTestDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// API Routes

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Google Sheets API server is running!', timestamp: new Date().toISOString() });
});

// Lookup patient by IYC number
app.get('/api/patient/:iycNumber', async (req, res) => {
    try {
        const { iycNumber } = req.params;

        console.log(`Looking up patient with IYC: ${iycNumber}`);

        // Read from Patient Database worksheet - main patient area (A-H)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!A:H',
        });

        const rows = response.data.values || [];

        // Find matching IYC number (case-insensitive)
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row[1] && row[1].toString().toLowerCase() === iycNumber.toLowerCase()) {
                return res.json({
                    found: true,
                    name: row[0] || '',        // A: Name
                    iycNumber: row[1] || '',   // B: IYC Number
                    email: row[2] || '',       // C: Email
                    phone: row[4] || '',       // E: Phone Numbers
                    department: row[5] || '',  // F: Current Department
                    category: row[6] || '',    // G: Category
                    age: row[7] || ''          // H: Age
                });
            }
        }

        res.json({ found: false });

    } catch (error) {
        console.error('Error looking up patient:', error);
        res.status(500).json({
            error: 'Failed to lookup patient',
            details: error.message
        });
    }
});

// Save blood test
app.post('/api/blood-test', async (req, res) => {
    try {
        const { schedule, testDate, iycNumber, patientName, category, phoneNumber, testName, testPrice, referredBy, payment } = req.body;

        console.log('Saving blood test:', req.body);

        // Use single worksheet for all blood tests
        const worksheetName = 'Blood_Test_Data';
        const insertAfterRow = 3; // Insert after row 2 (header in row 1)

        // Use provided date or calculate next test date
        const finalDate = testDate || getNextTestDate();

        // Generate unique ID (timestamp-based)
        const testId = `BT${Date.now()}`;
        const currentTimestamp = new Date().toISOString();

        // Prepare row data with all columns including ID, Created, and Updated timestamps
        // Insert price after testName
        const values = [[testId, finalDate, iycNumber, patientName, category, phoneNumber, testName, testPrice, referredBy, schedule, '', payment || '', currentTimestamp, currentTimestamp]];

        // First, insert a new row at the specified position
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    insertDimension: {
                        range: {
                            sheetId: await getSheetId(worksheetName),
                            dimension: 'ROWS',
                            startIndex: insertAfterRow - 1,
                            endIndex: insertAfterRow
                        },
                        inheritFromBefore: false
                    }
                }]
            }
        });

        // Then update the values in the new row
        const range = `${worksheetName}!A${insertAfterRow}:N${insertAfterRow}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });

        res.json({
            success: true,
            message: 'Blood test saved successfully',
            data: {
                worksheet: worksheetName,
                row: insertAfterRow,
                values: values[0]
            }
        });

    } catch (error) {
        console.error('Error saving blood test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save blood test',
            error: error.message
        });
    }
});

// Helper function to get sheet ID by name
async function getSheetId(worksheetName) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        const sheet = response.data.sheets.find(s => s.properties.title === worksheetName);

        if (!sheet) {
            throw new Error(`Worksheet '${worksheetName}' not found`);
        }

        return sheet.properties.sheetId;
    } catch (error) {
        console.error('Error getting sheet ID:', error);
        throw error;
    }
}

// Helper function to ensure Blood_Test_Data worksheet has correct headers
async function ensureBloodTestHeaders() {
    try {
        console.log('Checking Blood_Test_Data worksheet headers...');

        // Check if the worksheet exists and has correct headers
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Blood_Test_Data!A1:N1',
        });

        const expectedHeaders = ['ID', 'Date', 'IYC Number', 'Name', 'Category', 'Phone', 'Test Name', 'Price', 'Referred By', 'Status', 'Remarks', 'Payment', 'Created', 'Updated'];
        const currentHeaders = response.data.values ? response.data.values[0] : [];

        // Check if headers match
        const headersMatch = expectedHeaders.every((header, index) => currentHeaders[index] === header);

        if (!headersMatch) {
            console.log('Updating Blood_Test_Data headers to include Price column...');

            // Update the header row
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Blood_Test_Data!A1:N1',
                valueInputOption: 'RAW',
                resource: {
                    values: [expectedHeaders]
                }
            });

            console.log('Blood_Test_Data headers updated successfully');
        } else {
            console.log('Blood_Test_Data headers are correct');
        }
    } catch (error) {
        console.error('Error ensuring Blood_Test_Data headers:', error);
        // Don't throw error, just log it - the app should still work
    }
}

// Get all tests (for client-side filtering) - MUST come before /api/tests/:status
app.get('/api/tests/all', async (req, res) => {
    try {
        console.log('Getting all tests from Blood_Test_Data');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Blood_Test_Data!A:M`,
        });

        const rows = response.data.values || [];

        // Skip header row and format all data
        const tests = rows.slice(1).map((row, index) => ({
            id: row[0] || '', // Use the ID from column A
            rowIndex: index + 2, // Actual row number in sheet (0-indexed + 2 for header)
            date: row[1] || '',
            iycNumber: row[2] || '',
            name: row[3] || '',
            category: row[4] || '',
            phone: row[5] || '',
            testName: row[6] || '',
            referredBy: row[7] || '',
            status: row[8] || '',
            remarks: row[9] || '',
            payment: row[10] || '',
            created: row[11] || '',
            updated: row[12] || ''
        })).filter(test => {
            // Only include rows with IYC numbers
            return test.iycNumber;
        });

        res.json({
            success: true,
            tests: tests,
            count: tests.length
        });

    } catch (error) {
        console.error('Error getting all tests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get all tests',
            error: error.message
        });
    }
});

// Get tests filtered by status
app.get('/api/tests/:status', async (req, res) => {
    try {
        const { status } = req.params;

        console.log(`Getting tests with status: ${status}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Blood_Test_Data!A:M`,
        });

        const rows = response.data.values || [];

        // Skip header row and filter by status
        const tests = rows.slice(1).map((row, index) => ({
            id: row[0] || '', // A=ID
            rowIndex: index + 2, // Actual row number in sheet (0-indexed + 2 for header)
            date: row[1] || '', // B=Date
            iycNumber: row[2] || '', // C=IYC
            name: row[3] || '', // D=Name
            category: row[4] || '', // E=Category
            phone: row[5] || '', // F=Phone
            testName: row[6] || '', // G=Test Name
            referredBy: row[7] || '', // H=Referred By
            status: row[8] || '', // I=Status
            remarks: row[9] || '', // J=Remarks
            payment: row[10] || '', // K=Payment
            created: row[11] || '', // L=Created
            updated: row[12] || '' // M=Updated
        })).filter(test => {
            // Filter by status and ensure we have required data
            return test.iycNumber && test.status === status;
        });

        res.json({
            success: true,
            status: status,
            tests: tests,
            count: tests.length
        });

    } catch (error) {
        console.error('Error getting tests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tests',
            error: error.message
        });
    }
});

// Update test status (bulk operation) - much more efficient than moving between sheets
app.post('/api/update-status', async (req, res) => {
    try {
        const { testIds, newStatus, rowIndices } = req.body;

        console.log(`Updating ${testIds.length} tests to status: ${newStatus}`);

        if (testIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No tests provided for update'
            });
        }

        const currentTimestamp = new Date().toISOString();
        const updates = [];

        // Prepare batch update for all selected tests
        for (let i = 0; i < rowIndices.length; i++) {
            const rowIndex = rowIndices[i];

            // Update status (column I) and updated timestamp (column M)
            updates.push({
                range: `Blood_Test_Data!I${rowIndex}:M${rowIndex}`,
                values: [[newStatus, '', '', '', currentTimestamp]] // Status, Remarks (unchanged), Payment (unchanged), Created (unchanged), Updated
            });
        }

        // Execute batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data: updates
            }
        });

        res.json({
            success: true,
            message: `Successfully updated ${testIds.length} tests to ${newStatus}`,
            updatedCount: testIds.length,
            newStatus: newStatus
        });

    } catch (error) {
        console.error('Error updating test status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update test status',
            error: error.message
        });
    }
});

// Update test status and date (for moving pending tests to upcoming with date change)
app.post('/api/update-status-and-date', async (req, res) => {
    try {
        const { testIds, newStatus, newDate, rowIndices } = req.body;

        console.log(`Updating ${testIds.length} tests to status: ${newStatus} with date: ${newDate}`);

        if (testIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No tests provided for update'
            });
        }

        const currentTimestamp = new Date().toISOString();
        const updates = [];

        // Prepare batch update for all selected tests
        for (let i = 0; i < rowIndices.length; i++) {
            const rowIndex = rowIndices[i];

            // Update date (column B), status (column I), and updated timestamp (column M)
            updates.push({
                range: `Blood_Test_Data!B${rowIndex}`,
                values: [[newDate]]
            });
            updates.push({
                range: `Blood_Test_Data!I${rowIndex}`,
                values: [[newStatus]]
            });
            updates.push({
                range: `Blood_Test_Data!M${rowIndex}`,
                values: [[currentTimestamp]]
            });
        }

        // Execute batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data: updates
            }
        });

        res.json({
            success: true,
            message: `Successfully updated ${testIds.length} tests to ${newStatus} with date ${newDate}`,
            updatedCount: testIds.length,
            newStatus: newStatus,
            newDate: newDate
        });

    } catch (error) {
        console.error('Error updating test status and date:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update test status and date',
            error: error.message
        });
    }
});

// Update test dates only (without changing status)
app.post('/api/update-dates', async (req, res) => {
    try {
        console.log('=== UPDATE DATES ENDPOINT CALLED ===');
        console.log('Request body:', req.body);

        const { testIds, newDate, rowIndices } = req.body;

        console.log(`Updating dates for ${testIds.length} tests to date: ${newDate}`);

        if (testIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No tests provided for date update'
            });
        }

        const currentTimestamp = new Date().toISOString();
        const updates = [];

        // Prepare batch update for all selected tests (only date and updated timestamp)
        for (let i = 0; i < rowIndices.length; i++) {
            const rowIndex = rowIndices[i];

            // Update date (column B) and updated timestamp (column M)
            updates.push({
                range: `Blood_Test_Data!B${rowIndex}`,
                values: [[newDate]]
            });
            updates.push({
                range: `Blood_Test_Data!M${rowIndex}`,
                values: [[currentTimestamp]]
            });
        }

        // Execute batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data: updates
            }
        });

        res.json({
            success: true,
            message: `Successfully updated dates for ${testIds.length} tests to ${newDate}`,
            updatedCount: testIds.length,
            newDate: newDate
        });

    } catch (error) {
        console.error('Error updating test dates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update test dates',
            error: error.message
        });
    }
});

// Update individual test data
app.put('/api/test/:rowIndex', async (req, res) => {
    try {
        const { rowIndex } = req.params;
        const { date, iycNumber, name, category, phone, testName, referredBy, status, remarks } = req.body;

        console.log(`Updating test at row ${rowIndex}`);

        const currentTimestamp = new Date().toISOString();

        // Update only the editable fields (B to M for updated timestamp)
        // Keep ID (A), Created (L) unchanged
        const range = `Blood_Test_Data!B${rowIndex}:M${rowIndex}`;
        const values = [[date, iycNumber, name, category, phone, testName, referredBy, status, remarks, '', '', currentTimestamp]];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });

        res.json({
            success: true,
            message: 'Test updated successfully',
            data: values[0]
        });

    } catch (error) {
        console.error('Error updating test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update test',
            error: error.message
        });
    }
});

// Delete tests (bulk operation)
app.delete('/api/tests', async (req, res) => {
    try {
        const { rowIndices } = req.body;

        console.log(`Deleting ${rowIndices.length} tests from Blood_Test_Data`);

        // Delete rows in reverse order to maintain indices
        const sortedIndices = rowIndices.sort((a, b) => b - a);
        for (const rowIndex of sortedIndices) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: await getSheetId('Blood_Test_Data'),
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex
                            }
                        }
                    }]
                }
            });
        }

        res.json({
            success: true,
            message: `Successfully deleted ${rowIndices.length} tests`,
            deletedCount: rowIndices.length
        });

    } catch (error) {
        console.error('Error deleting tests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete tests',
            error: error.message
        });
    }
});

// Get blood test price list from Price_list_bloodtest sheet
app.get('/api/blood-test-prices', async (req, res) => {
    try {
        console.log('Getting blood test price list from Price_list_bloodtest sheet');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Price_list_bloodtest!A:H',
        });

        const rows = response.data.values || [];
        console.log('Price list raw data sample:', rows.slice(0, 3));

        // Skip header row and format data
        const singleTests = [];
        const packages = [];

        rows.slice(1).forEach(row => {
            // Single tests are in column C (Service Name) with price in column D (Revised MRP)
            if (row[2] && row[2].trim()) {
                singleTests.push({
                    testName: row[2].trim(),
                    serviceCode: row[1] || '',
                    price: parseFloat(row[3]) || 0, // Column D: Revised MRP
                    type: 'single'
                });
            }

            // Packages are in column F (Package Name) with price in column H (Price)
            if (row[5] && row[5].trim()) {
                packages.push({
                    testName: row[5].trim(),
                    serviceCode: row[1] || '',
                    price: parseFloat(row[7]) || 0, // Column H: Price
                    type: 'package'
                });
            }
        });

        const allTests = [...singleTests, ...packages];

        res.json({
            success: true,
            priceList: allTests,
            singleTests: singleTests,
            packages: packages,
            count: allTests.length
        });

        // Initialize test price service with the data
        await testPriceService.initialize(singleTests, packages);

    } catch (error) {
        console.error('Error getting blood test price list:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get blood test price list',
            error: error.message
        });
    }
});

// Debug endpoint to check price list data
app.get('/api/debug-price-list', async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Price_list_bloodtest!A:H',
        });

        const rows = response.data.values || [];

        // Show first 10 rows with all columns
        const debugData = rows.slice(0, 10).map((row, index) => ({
            rowIndex: index,
            A: row[0] || '',
            B: row[1] || '',
            C: row[2] || '',
            D: row[3] || '',
            E: row[4] || '',
            F: row[5] || '',
            G: row[6] || '',
            H: row[7] || ''
        }));

        res.json({
            success: true,
            totalRows: rows.length,
            sampleData: debugData
        });
    } catch (error) {
        console.error('Debug price list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estimate test price using Gemini AI
app.post('/api/estimate-test-price', async (req, res) => {
    try {
        const { testNames } = req.body;

        if (!testNames || typeof testNames !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Test names are required'
            });
        }

        console.log('Estimating price for test names:', testNames);

        // Get fresh price list data
        const priceResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Price_list_bloodtest!A:H',
        });

        const rows = priceResponse.data.values || [];
        const singleTests = [];
        const packages = [];

        rows.slice(1).forEach(row => {
            // Single tests are in column C (Service Name) with price in column D (Revised MRP)
            if (row[2] && row[2].trim()) {
                singleTests.push({
                    testName: row[2].trim(),
                    serviceCode: row[1] || '',
                    price: parseFloat(row[3]) || 0, // Column D: Revised MRP
                    type: 'single'
                });
            }

            // Packages are in column F (Package Name) with price in column H (Price)
            if (row[5] && row[5].trim()) {
                packages.push({
                    testName: row[5].trim(),
                    serviceCode: row[1] || '',
                    price: parseFloat(row[7]) || 0, // Column H: Price
                    type: 'package'
                });
            }
        });

        // Initialize and get estimation
        await testPriceService.initialize(singleTests, packages);
        const estimation = await testPriceService.estimateTestPrice(testNames);
        const finalResult = testPriceService.getLowestPriceOption(estimation);

        res.json({
            success: true,
            estimation: finalResult,
            inputText: testNames
        });

    } catch (error) {
        console.error('Error estimating test price:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to estimate test price',
            error: error.message
        });
    }
});

// Save ultrasound
app.post('/api/ultrasound', async (req, res) => {
    try {
        const { schedule, testDate, iycNumber, patientName, category, phoneNumber, testName, referredBy, payment } = req.body;

        console.log('Saving ultrasound:', req.body);

        // Use single worksheet for all ultrasounds
        const worksheetName = 'Ultrasound_Data';
        const insertAfterRow = 3; // Insert after row 2 (header in row 1)

        // Ensure the worksheet exists with correct headers
        await ensureUltrasoundHeaders();

        // Use provided date or leave empty (different from blood test)
        const finalDate = testDate || '';

        // Generate unique ID (timestamp-based)
        const ultrasoundId = `US${Date.now()}`;
        const currentTimestamp = new Date().toISOString();

        // Prepare row data with all columns including ID, Timing, Created, Updated, Scheduling Doctor, and Payment timestamps
        const values = [[ultrasoundId, finalDate, iycNumber, patientName, category, phoneNumber, testName, referredBy, schedule, '', '', currentTimestamp, currentTimestamp, '', payment || '']];

        // First, insert a new row at the specified position
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    insertDimension: {
                        range: {
                            sheetId: await getSheetId(worksheetName),
                            dimension: 'ROWS',
                            startIndex: insertAfterRow - 1,
                            endIndex: insertAfterRow
                        },
                        inheritFromBefore: false
                    }
                }]
            }
        });

        // Then update the values in the new row
        const range = `${worksheetName}!A${insertAfterRow}:O${insertAfterRow}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });

        res.json({
            success: true,
            message: 'Ultrasound saved successfully',
            data: {
                worksheet: worksheetName,
                row: insertAfterRow,
                values: values[0]
            }
        });

    } catch (error) {
        console.error('Error saving ultrasound:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save ultrasound',
            error: error.message
        });
    }
});

// Helper function to ensure Ultrasound_Data worksheet exists and has correct headers
async function ensureUltrasoundHeaders() {
    try {
        console.log('Checking Ultrasound_Data worksheet headers...');

        // First, try to get the worksheet to see if it exists
        let worksheetExists = true;
        try {
            await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Ultrasound_Data!A1:L1',
            });
        } catch (error) {
            if (error.message.includes('Unable to parse range') || error.message.includes('not found')) {
                worksheetExists = false;
            } else {
                throw error;
            }
        }

        // If worksheet doesn't exist, create it
        if (!worksheetExists) {
            console.log('Creating Ultrasound_Data worksheet...');

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: 'Ultrasound_Data'
                            }
                        }
                    }]
                }
            });

            console.log('Ultrasound_Data worksheet created successfully');
        }

        // Now check and update headers
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Ultrasound_Data!A1:O1',
        });

        const expectedHeaders = ['ID', 'Date', 'IYC Number', 'Name', 'Category', 'Phone', 'Ultrasound Type', 'Referred By', 'Status', 'Remarks', 'Timing', 'Created', 'Updated', 'Scheduling Doctor', 'Payment'];
        const currentHeaders = response.data.values ? response.data.values[0] : [];

        // Check if headers match
        const headersMatch = expectedHeaders.every((header, index) => currentHeaders[index] === header);

        if (!headersMatch) {
            console.log('Updating Ultrasound_Data headers...');

            // Update the header row
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Ultrasound_Data!A1:O1',
                valueInputOption: 'RAW',
                resource: {
                    values: [expectedHeaders]
                }
            });

            console.log('Ultrasound_Data headers updated successfully');
        } else {
            console.log('Ultrasound_Data headers are correct');
        }
    } catch (error) {
        console.error('Error ensuring Ultrasound_Data headers:', error);
        throw error; // Throw error so the calling function can handle it
    }
}

// Get all ultrasounds (for client-side filtering)
app.get('/api/ultrasounds/all', async (req, res) => {
    try {
        console.log('Getting all ultrasounds from Ultrasound_Data');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Ultrasound_Data!A:N`,
        });

        const rows = response.data.values || [];

        // Skip header row and format all data
        const ultrasounds = rows.slice(1).map((row, index) => ({
            id: row[0] || '', // Use the ID from column A
            rowIndex: index + 2, // Actual row number in sheet (0-indexed + 2 for header)
            date: row[1] || '',
            iycNumber: row[2] || '',
            name: row[3] || '',
            category: row[4] || '',
            phone: row[5] || '',
            testName: row[6] || '',
            referredBy: row[7] || '',
            status: row[8] || '',
            remarks: row[9] || '',
            timing: row[10] || '',
            created: row[11] || '',
            updated: row[12] || '',
            schedulingDoctor: row[13] || ''
        })).filter(ultrasound => {
            // Only include rows with IYC numbers
            return ultrasound.iycNumber;
        });

        res.json({
            success: true,
            ultrasounds: ultrasounds,
            count: ultrasounds.length
        });

    } catch (error) {
        console.error('Error getting all ultrasounds:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get all ultrasounds',
            error: error.message
        });
    }
});

// Get ultrasounds filtered by status
app.get('/api/ultrasounds/:status', async (req, res) => {
    try {
        const { status } = req.params;

        console.log(`Getting ultrasounds with status: ${status}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Ultrasound_Data!A:N`,
        });

        const rows = response.data.values || [];

        // Skip header row and filter by status
        const ultrasounds = rows.slice(1).map((row, index) => ({
            id: row[0] || '', // A=ID
            rowIndex: index + 2, // Actual row number in sheet (0-indexed + 2 for header)
            date: row[1] || '', // B=Date
            iycNumber: row[2] || '', // C=IYC
            name: row[3] || '', // D=Name
            category: row[4] || '', // E=Category
            phone: row[5] || '', // F=Phone
            testName: row[6] || '', // G=Ultrasound Type
            referredBy: row[7] || '', // H=Referred By
            status: row[8] || '', // I=Status
            remarks: row[9] || '', // J=Remarks
            timing: row[10] || '', // K=Timing
            created: row[11] || '', // L=Created
            updated: row[12] || '', // M=Updated
            schedulingDoctor: row[13] || '', // N=Scheduling Doctor
            payment: row[14] || '' // O=Payment
        })).filter(ultrasound => {
            // Filter by status and ensure we have required data
            return ultrasound.iycNumber && ultrasound.status === status;
        });

        res.json({
            success: true,
            status: status,
            ultrasounds: ultrasounds,
            count: ultrasounds.length
        });

    } catch (error) {
        console.error('Error getting ultrasounds:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get ultrasounds',
            error: error.message
        });
    }
});

// Update ultrasound status (bulk operation)
app.post('/api/ultrasound-status', async (req, res) => {
    try {
        const { ultrasoundIds, newStatus, rowIndices } = req.body;

        console.log(`Updating ${ultrasoundIds.length} ultrasounds to status: ${newStatus}`);

        if (ultrasoundIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No ultrasounds provided for update'
            });
        }

        const currentTimestamp = new Date().toISOString();
        const updates = [];

        // Prepare batch update for all selected ultrasounds
        for (let i = 0; i < rowIndices.length; i++) {
            const rowIndex = rowIndices[i];

            // Update status (column I) and updated timestamp (column L)
            updates.push({
                range: `Ultrasound_Data!I${rowIndex}:L${rowIndex}`,
                values: [[newStatus, '', '', currentTimestamp]] // Status, Remarks (unchanged), Created (unchanged), Updated
            });
        }

        // Execute batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data: updates
            }
        });

        res.json({
            success: true,
            message: `Successfully updated ${ultrasoundIds.length} ultrasounds to ${newStatus}`,
            updatedCount: ultrasoundIds.length,
            newStatus: newStatus
        });

    } catch (error) {
        console.error('Error updating ultrasound status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ultrasound status',
            error: error.message
        });
    }
});

// Update individual ultrasound data
app.put('/api/ultrasound/:rowIndex', async (req, res) => {
    try {
        const { rowIndex } = req.params;
        const { date, iycNumber, name, category, phone, testName, referredBy, status, remarks, timing, schedulingDoctor } = req.body;

        console.log(`Updating ultrasound at row ${rowIndex}`);

        const currentTimestamp = new Date().toISOString();

        // Update only the editable fields (B to N for updated timestamp)
        // Keep ID (A), Created (L) unchanged
        const range = `Ultrasound_Data!B${rowIndex}:N${rowIndex}`;
        const values = [[date, iycNumber, name, category, phone, testName, referredBy, status, remarks, timing || '', '', currentTimestamp, schedulingDoctor || '']];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });

        res.json({
            success: true,
            message: 'Ultrasound updated successfully',
            data: values[0]
        });

    } catch (error) {
        console.error('Error updating ultrasound:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ultrasound',
            error: error.message
        });
    }
});

// Delete ultrasounds (bulk operation)
app.delete('/api/ultrasounds', async (req, res) => {
    try {
        const { rowIndices } = req.body;

        console.log(`Deleting ${rowIndices.length} ultrasounds from Ultrasound_Data`);

        // Delete rows in reverse order to maintain indices
        const sortedIndices = rowIndices.sort((a, b) => b - a);
        for (const rowIndex of sortedIndices) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: await getSheetId('Ultrasound_Data'),
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex
                            }
                        }
                    }]
                }
            });
        }

        res.json({
            success: true,
            message: `Successfully deleted ${rowIndices.length} ultrasounds`,
            deletedCount: rowIndices.length
        });

    } catch (error) {
        console.error('Error deleting ultrasounds:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete ultrasounds',
            error: error.message
        });
    }
});

// Get hospitals from Hospital Directory
app.get('/api/hospitals', async (req, res) => {
    try {
        console.log('Getting hospitals from Hospital Directory...');

        // Read from Hospital Directory worksheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital Directory!B:B',
        });

        const rows = response.data.values || [];

        // Extract hospital names (skip header row)
        const hospitals = rows.slice(1)
            .map(row => row[0])
            .filter(hospital => hospital && hospital.trim() !== '');

        res.json({
            success: true,
            hospitals: hospitals
        });

    } catch (error) {
        console.error('Error getting hospitals:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hospitals',
            error: error.message
        });
    }
});

// Get all patients for search functionality
app.get('/api/patients', async (req, res) => {
    try {
        console.log('Getting all patients for search...');

        // Read from Patient Database worksheet - main patient area (A-H)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!A:H',
        });

        const rows = response.data.values || [];

        // Extract patient data (skip header row)
        const patients = [];
        for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            if (row[0] && row[1]) { // Must have name and IYC
                patients.push({
                    name: row[0] || '',              // A: Name
                    iycNumber: row[1] || '',         // B: IYC Number
                    email: row[2] || '',             // C: Email
                    personalEmail: row[3] || '',     // D: Personal Email
                    phone: row[4] || '',             // E: Phone Numbers
                    department: row[5] || '',        // F: Current Department
                    category: row[6] || '',          // G: Category
                    rowIndex: i + 1                  // Actual row index in sheet (i+1 because sheets are 1-indexed)
                });
            }
        }

        res.json({
            success: true,
            patients: patients
        });

    } catch (error) {
        console.error('Error getting patients:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get patients',
            error: error.message
        });
    }
});

// Save hospital visit data
app.post('/api/hospital-visit', async (req, res) => {
    try {
        const visitData = req.body;
        console.log('Saving hospital visit:', visitData);

        // Ensure Hospital_Visit_Data worksheet has correct headers
        await ensureHospitalVisitHeaders();

        // Generate unique ID
        const visitId = `HV${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Prepare row data
        const rowData = [
            visitId,
            visitData.dateRequested,
            visitData.iycNumber,
            visitData.patientName,
            visitData.phoneNumber,
            visitData.hospital,
            visitData.purpose,
            visitData.doctor,
            visitData.priority,
            visitData.remarks,
            visitData.status,
            timestamp,
            timestamp,
            'No', // Email Sent - default to No
            '', // Appointment Date - default to empty
            'No', // Bills Submission - default to No
            'No' // Reports Submission - default to No
        ];

        // Append to Hospital_Visit_Data worksheet
        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:O',
            valueInputOption: 'RAW',
            resource: {
                values: [rowData]
            }
        });

        console.log('Hospital visit saved successfully:', appendResponse.data);

        res.json({
            success: true,
            message: 'Hospital visit saved successfully',
            visitId: visitId,
            data: appendResponse.data
        });

    } catch (error) {
        console.error('Error saving hospital visit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save hospital visit',
            error: error.message
        });
    }
});

// Update hospital visit submission status
app.post('/api/hospital-visit-submission', async (req, res) => {
    try {
        const { visitId, field, value } = req.body;

        if (!visitId || !field || value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Visit ID, field, and value are required'
            });
        }

        if (!['billsSubmission', 'reportsSubmission'].includes(field)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid field. Must be billsSubmission or reportsSubmission'
            });
        }

        console.log(`Updating ${field} for visit ${visitId} to: ${value}`);

        // Get visit details from Hospital_Visit_Data
        const visitResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:Q',
        });

        const visitRows = visitResponse.data.values || [];
        const visitRowIndex = visitRows.findIndex(row => row[0] === visitId);

        if (visitRowIndex < 0) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Determine which column to update
        const columnMap = {
            'billsSubmission': 'P', // Column P (index 15)
            'reportsSubmission': 'Q' // Column Q (index 16)
        };

        const column = columnMap[field];
        const updateRange = `Hospital_Visit_Data!${column}${visitRowIndex + 1}`;

        // Update the submission status
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: updateRange,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[value]]
            }
        });

        console.log(`Updated ${field} for visit ${visitId} to: ${value}`);

        res.json({
            success: true,
            message: `${field} updated successfully`,
            visitId: visitId,
            field: field,
            value: value
        });

    } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update submission status',
            error: error.message
        });
    }
});

// Get hospital visits by status
app.get('/api/hospital-visits/:status', async (req, res) => {
    try {
        const { status } = req.params;
        console.log(`Getting hospital visits with status: ${status}`);

        // Read from Hospital_Visit_Data worksheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:Q',
        });

        const rows = response.data.values || [];

        if (rows.length <= 1) {
            return res.json({
                success: true,
                visits: []
            });
        }

        // Filter visits by status (skip header row)
        const visits = rows.slice(1)
            .map((row, index) => ({
                id: row[0] || '',
                dateRequested: row[1] || '',
                iycNumber: row[2] || '',
                patientName: row[3] || '',
                phoneNumber: row[4] || '',
                hospital: row[5] || '',
                purpose: row[6] || '',
                doctor: row[7] || '',
                priority: row[8] || '',
                remarks: row[9] || '',
                status: row[10] || '',
                created: row[11] || '',
                updated: row[12] || '',
                emailSent: row[13] || '',
                appointmentDate: row[14] || '',
                billsSubmission: row[15] || 'No',
                reportsSubmission: row[16] || 'No',
                rowIndex: index + 2 // +2 because we skip header and arrays are 0-indexed
            }))
            .filter(visit => visit.status === status);

        res.json({
            success: true,
            visits: visits
        });

    } catch (error) {
        console.error('Error getting hospital visits:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hospital visits',
            error: error.message
        });
    }
});

// Helper function to ensure Hospital_Visit_Data worksheet has correct headers
async function ensureHospitalVisitHeaders() {
    try {
        console.log('Checking Hospital_Visit_Data worksheet headers...');

        // Check if the worksheet exists and has correct headers
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A1:Q1',
        });

        const expectedHeaders = ['ID', 'Date Requested', 'IYC Number', 'Name', 'Phone', 'Hospital', 'Purpose', 'Doctor', 'Priority', 'Remarks', 'Status', 'Created', 'Updated', 'Email Sent', 'Appointment Date', 'Bills Submission', 'Reports Submission'];
        const currentHeaders = response.data.values ? response.data.values[0] : [];

        // Check if headers match
        const headersMatch = expectedHeaders.every((header, index) => currentHeaders[index] === header);

        if (!headersMatch) {
            console.log('Headers do not match. Creating/updating Hospital_Visit_Data worksheet...');

            // Update headers
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Hospital_Visit_Data!A1:Q1',
                valueInputOption: 'RAW',
                resource: {
                    values: [expectedHeaders]
                }
            });

            console.log('Hospital_Visit_Data headers updated successfully');
        } else {
            console.log('Hospital_Visit_Data headers are correct');
        }

    } catch (error) {
        if (error.message.includes('Unable to parse range')) {
            console.log('Hospital_Visit_Data worksheet does not exist. Creating it...');

            try {
                // Create the worksheet
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'Hospital_Visit_Data'
                                }
                            }
                        }]
                    }
                });

                // Add headers
                const expectedHeaders = ['ID', 'Date Requested', 'IYC Number', 'Name', 'Phone', 'Hospital', 'Purpose', 'Doctor', 'Priority', 'Remarks', 'Status', 'Created', 'Updated', 'Email Sent', 'Appointment Date'];
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Hospital_Visit_Data!A1:O1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [expectedHeaders]
                    }
                });

                console.log('Hospital_Visit_Data worksheet created successfully');

            } catch (createError) {
                console.error('Error creating Hospital_Visit_Data worksheet:', createError);
                throw createError;
            }
        } else {
            console.error('Error checking Hospital_Visit_Data headers:', error);
            throw error;
        }
    }
}

// Helper function to read System Config data
async function getSystemConfig() {
    try {
        console.log('Reading System Config worksheet...');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'System Config!C1:C15', // Read from C1 to C15 to get all config data
        });

        const values = response.data.values || [];
        console.log('Raw System Config values:', values);

        const config = {
            username: values[1] && values[1][0] ? values[1][0].toString().trim() : '', // C2 - username
            password: values[2] && values[2][0] ? values[2][0].toString().trim() : '', // C3 - password
            anchors: values[4] && values[4][0] ? values[4][0].toString().trim() : '', // C5 - anchors JSON
            referredBy: values[5] && values[5][0] ? values[5][0].toString().trim() : '', // C6 - referred by names
            others: values[6] && values[6][0] ? values[6][0].toString().trim() : '', // C7 - others names
            ultrasound_doctor: values[11] && values[11][0] ? values[11][0].toString().trim() : '' // C12 - ultrasound doctors
        };

        console.log('System Config processed:', {
            username: config.username ? `"${config.username}"` : 'not set',
            password: config.password ? '***' : 'not set',
            anchors: config.anchors ? `"${config.anchors.substring(0, 50)}..."` : 'not set',
            referredBy: config.referredBy ? `"${config.referredBy}"` : 'not set',
            others: config.others ? `"${config.others}"` : 'not set',
            ultrasound_doctor: config.ultrasound_doctor ? `"${config.ultrasound_doctor}"` : 'not set'
        });

        return config;
    } catch (error) {
        console.error('Error reading System Config:', error);
        if (error.message && error.message.includes('Unable to parse range')) {
            console.error('System Config worksheet does not exist!');
        }
        return {
            username: '',
            password: '',
            anchors: '',
            referredBy: '',
            others: '',
            ultrasound_doctor: ''
        };
    }
}


// Helper function to ensure Diet_Request_Data worksheet has correct headers
async function ensureDietRequestHeaders() {
    try {
        console.log('Checking Diet_Request_Data worksheet headers...');

        // Check if the worksheet exists and has correct headers
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Diet_Request_Data!A1:S1',
        });

        const expectedHeaders = ['ID', 'Date Requested', 'IYC Number', 'Patient Name', 'Email', 'Phone Number', 'Anchor', 'Others', 'Brunch', 'Lunch', 'Dinner', 'One Time Takeaway', 'Duration', 'Start Date', 'End Date', 'Remarks', 'Status', 'Created', 'Updated'];
        const currentHeaders = response.data.values ? response.data.values[0] : [];

        // Check if headers match
        const headersMatch = expectedHeaders.every((header, index) => currentHeaders[index] === header);

        if (!headersMatch) {
            console.log('Headers do not match. Creating/updating Diet_Request_Data worksheet...');

            // Update headers
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Diet_Request_Data!A1:S1',
                valueInputOption: 'RAW',
                resource: {
                    values: [expectedHeaders]
                }
            });

            console.log('Diet_Request_Data headers updated successfully');
        } else {
            console.log('Diet_Request_Data headers are correct');
        }

    } catch (error) {
        if (error.message.includes('Unable to parse range')) {
            console.log('Diet_Request_Data worksheet does not exist. Creating it...');

            try {
                // Create the worksheet
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'Diet_Request_Data'
                                }
                            }
                        }]
                    }
                });

                // Add headers to the new worksheet
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Diet_Request_Data!A1:S1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [expectedHeaders]
                    }
                });

                console.log('Diet_Request_Data worksheet created successfully');

            } catch (createError) {
                console.error('Error creating Diet_Request_Data worksheet:', createError);
                throw createError;
            }
        } else {
            console.error('Error checking Diet_Request_Data headers:', error);
            throw error;
        }
    }
}

// Helper function to send credit email using OAuth2
async function sendCreditEmail(emailAddresses, content, visitDetails, patientEmail = '', i2Emails = []) {
    try {
        // Read email credentials
        let credentials;
        if (process.env.EMAIL_CREDENTIALS) {
            // Production: Use environment variable
            credentials = JSON.parse(process.env.EMAIL_CREDENTIALS);
        } else {
            throw new Error('EMAIL_CREDENTIALS environment variable is required. See ENVIRONMENT_SETUP.md for details.');
        }
        console.log('Email credentials loaded successfully');

        // Check if OAuth2 refresh token is available
        console.log('Checking OAuth2 refresh token...');
        console.log('Has oauth2 object:', !!credentials.oauth2);
        console.log('Has refresh_token:', !!credentials.oauth2?.refresh_token);
        console.log('Refresh token length:', credentials.oauth2?.refresh_token?.length || 0);

        if (!credentials.oauth2 || !credentials.oauth2.refresh_token ||
            credentials.oauth2.refresh_token === 'WILL_BE_GENERATED_AUTOMATICALLY' ||
            credentials.oauth2.refresh_token.trim() === '') {
            console.log('OAuth2 refresh token not found or invalid. Please run: node generate-hospital-oauth.js');

            // For demo purposes, simulate successful email sending
            console.log('DEMO MODE: Simulating email send to:', emailAddresses);
            console.log('Email content:', content);

            return {
                success: true,
                messageId: 'demo-' + Date.now(),
                demo: true
            };
        }

        console.log('OAuth2 refresh token found and valid, proceeding with real email sending...');

        // OAuth2 token is available, proceed with Gmail API email sending
        console.log('OAuth2 refresh token found, using Gmail API for email sending...');

        // Create OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            credentials.oauth2.client_id,
            credentials.oauth2.client_secret,
            'http://localhost:10000'  // Use OOB (out-of-band) for server applications
        );

        // Set refresh token
        oauth2Client.setCredentials({
            refresh_token: credentials.oauth2.refresh_token
        });

        console.log('Getting fresh access token...');

        // Get fresh access token with timeout
        let token;
        try {
            const tokenResponse = await Promise.race([
                oauth2Client.getAccessToken(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('OAuth2 token refresh timeout after 10 seconds')), 10000)
                )
            ]);
            token = tokenResponse.token;
        } catch (tokenError) {
            console.error('OAuth2 token refresh failed:', tokenError);
            throw new Error(`OAuth2 token refresh failed: ${tokenError.message}`);
        }

        if (!token) {
            throw new Error('Failed to get access token from OAuth2');
        }

        console.log('Access token obtained successfully');

        // Create Gmail API instance
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Create email content in RFC 2822 format
        let emailContent = `To: ${emailAddresses.join(', ')}
From: ${credentials.from.name} <${credentials.from.email}>`;

        // Build CC field with I2 emails and patient email
        const ccEmails = [];
        if (i2Emails && i2Emails.length > 0) {
            ccEmails.push(...i2Emails);
        }
        if (patientEmail) {
            ccEmails.push(patientEmail);
        }

        if (ccEmails.length > 0) {
            emailContent += `\nCc: ${ccEmails.join(', ')}`;
        }

        // Since we now require appointment date to be present, we can use it directly
        // Create subject line in the required format: Credit info-Isha Foundation-[Patient Name]-[Appointment Date]
        const emailSubject = `Credit info-Isha Foundation-${visitDetails.patientName}-${visitDetails.appointmentDate}`;

        emailContent += `\nSubject: ${emailSubject}
Content-Type: text/plain; charset=utf-8

${content}`;

        // Encode email content for Gmail API
        const encodedEmail = Buffer.from(emailContent)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        console.log('Sending email via Gmail API to:', emailAddresses);
        console.log('Email subject:', emailSubject);

        // Send email using Gmail API
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });

        console.log('Email sent successfully via Gmail API:', result.data.id);

        return {
            success: true,
            messageId: result.data.id,
            method: 'Gmail API'
        };

    } catch (error) {
        console.error('Error sending email:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            command: error.command
        });

        return {
            success: false,
            error: error.message
        };
    }
}

// Helper function to send diet request email using OAuth2
async function sendDietRequestEmail(emailAddresses, content, dietRequestDetails, patientEmail = '', ccEmails = []) {
    try {
        // Read email credentials
        let credentials;
        if (process.env.DIET_EMAIL_CREDENTIALS) {
            // Production: Use diet-specific environment variable
            credentials = JSON.parse(process.env.DIET_EMAIL_CREDENTIALS);
            console.log('Using DIET_EMAIL_CREDENTIALS environment variable');
        } else if (process.env.EMAIL_CREDENTIALS) {
            // Production: Fallback to general email credentials
            credentials = JSON.parse(process.env.EMAIL_CREDENTIALS);
            console.log('Using EMAIL_CREDENTIALS environment variable');
        } else {
            throw new Error('Email credentials not found. Please set DIET_EMAIL_CREDENTIALS or EMAIL_CREDENTIALS environment variable. See ENVIRONMENT_SETUP.md for details.');
        }

        console.log('Diet request credentials loaded:', {
            email: credentials.email,
            client_id: credentials.oauth2?.client_id,
            has_refresh_token: !!credentials.oauth2?.refresh_token
        });

        if (!credentials.oauth2 || !credentials.oauth2.refresh_token) {
            throw new Error('OAuth2 refresh token not found in credentials');
        }

        // OAuth2 token is available, proceed with Gmail API email sending
        console.log('OAuth2 refresh token found, using Gmail API for diet request email sending...');

        // Create OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            credentials.oauth2.client_id,
            credentials.oauth2.client_secret,
            'http://localhost:10000'  // Use same redirect URI as token generation
        );

        // Set refresh token
        oauth2Client.setCredentials({
            refresh_token: credentials.oauth2.refresh_token
        });

        console.log('Getting fresh access token for diet request email...');

        // Get fresh access token
        const { token } = await oauth2Client.getAccessToken();

        if (!token) {
            throw new Error('Failed to get access token from OAuth2');
        }

        console.log('Access token obtained successfully for diet request');

        // Create Gmail API instance
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Create email content in RFC 2822 format
        let emailContent = `To: ${emailAddresses.join(', ')}
From: ${credentials.from.name} <${credentials.from.email}>`;

        // Build CC field with CC emails and patient email
        const allCcEmails = [];
        if (ccEmails && ccEmails.length > 0) {
            allCcEmails.push(...ccEmails);
        }
        if (patientEmail) {
            allCcEmails.push(patientEmail);
        }

        if (allCcEmails.length > 0) {
            emailContent += `\nCc: ${allCcEmails.join(', ')}`;
        }

        // Check if this might be a renewal (same patient with request date = today)
        const today = new Date().toISOString().split('T')[0];
        const isLikelyRenewal = dietRequestDetails.dateRequested === today;

        // Create subject line for diet request
        const emailSubject = isLikelyRenewal
            ? `Diet Request Renewal - Isha Foundation - ${dietRequestDetails.patientName} - ${dietRequestDetails.startDate}`
            : `Diet Request - Isha Foundation - ${dietRequestDetails.patientName} - ${dietRequestDetails.startDate}`;

        emailContent += `\nSubject: ${emailSubject}
Content-Type: text/html; charset=utf-8

${content}`;

        // Encode email content for Gmail API
        const encodedEmail = Buffer.from(emailContent)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        console.log('Sending diet request email via Gmail API to:', emailAddresses);
        console.log('Email subject:', emailSubject);

        // Send email using Gmail API
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });

        console.log('Diet request email sent successfully via Gmail API:', result.data.id);

        return {
            success: true,
            messageId: result.data.id,
            method: 'Gmail API'
        };

    } catch (error) {
        console.error('Error sending diet request email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Simple email test endpoint
app.post('/api/test-simple-email', async (req, res) => {
    try {
        const { visitId } = req.body;

        console.log('🧪 Testing simple email for visit:', visitId);

        // Get visit details
        const visitResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:O',
        });

        const visitRows = visitResponse.data.values || [];
        const visitData = visitRows.find(row => row[0] === visitId);

        if (!visitData) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        const visitDetails = {
            patientName: visitData[3],
            hospital: visitData[5],
            purpose: visitData[6],
            phoneNumber: visitData[4]
        };

        // Get hospital email from Hospital Directory
        const hospitalResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital Directory!B:E',
        });

        const hospitalRows = hospitalResponse.data.values || [];
        console.log('Hospital Directory rows:', hospitalRows);

        const hospitalRow = hospitalRows.find(row => row[0] === visitDetails.hospital);
        console.log('Found hospital row:', hospitalRow);

        if (!hospitalRow || !hospitalRow[3]) {
            return res.status(404).json({
                success: false,
                message: 'Hospital email addresses not found',
                hospital: visitDetails.hospital,
                availableHospitals: hospitalRows.map(row => row[0]).filter(Boolean)
            });
        }

        // Parse email addresses
        const emailAddresses = hospitalRow[3].split(',').map(email => email.trim()).filter(email => email);
        console.log('Email addresses:', emailAddresses);

        // Simple test email content
        const simpleContent = `Test Email from Clinic Management System

Patient: ${visitDetails.patientName}
Hospital: ${visitDetails.hospital}
Purpose: ${visitDetails.purpose}
Contact: ${visitDetails.phoneNumber}

This is a test email to verify the email system is working.

Best regards,
Isha Yoga Center - Clinic Management`;

        // Send simple email
        const emailResult = await sendCreditEmail(emailAddresses, simpleContent, visitDetails, '', []);

        if (emailResult.success) {
            res.json({
                success: true,
                message: 'Simple test email sent successfully',
                messageId: emailResult.messageId,
                demo: emailResult.demo || false,
                emailAddresses: emailAddresses,
                content: simpleContent
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send test email',
                error: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error in test-simple-email endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email',
            error: error.message,
            stack: error.stack
        });
    }
});

// Send credit letter email endpoint
app.post('/api/send-credit-email', async (req, res) => {
    try {
        const { visitId } = req.body;

        if (!visitId) {
            return res.status(400).json({
                success: false,
                message: 'Visit ID is required'
            });
        }

        console.log('Processing credit email for visit:', visitId);

        console.log('Step 1: Fetching visit details from Hospital_Visit_Data...');
        // Get visit details from Hospital_Visit_Data
        const visitResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:O',
        });
        console.log('Step 1: Visit details fetched successfully');

        const visitRows = visitResponse.data.values || [];
        console.log('Step 2: Processing visit data, total rows:', visitRows.length);
        const visitData = visitRows.find(row => row[0] === visitId);

        if (!visitData) {
            console.log('Step 2: Visit not found for ID:', visitId);
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }
        console.log('Step 2: Visit data found successfully');

        const visitDetails = {
            id: visitData[0],
            dateRequested: visitData[1],
            iycNumber: visitData[2],
            patientName: visitData[3],
            phoneNumber: visitData[4],
            hospital: visitData[5],
            purpose: visitData[6],
            doctor: visitData[7],
            priority: visitData[8],
            remarks: visitData[9],
            status: visitData[10],
            created: visitData[11],
            updated: visitData[12],
            emailSent: visitData[13] || 'No', // Column N (index 13 in 0-based array)
            appointmentDate: visitData[14] || '' // Column O (index 14 in 0-based array)
        };

        console.log('Step 3: Visit details parsed, appointment date:', visitDetails.appointmentDate);

        // Check if appointment date is empty and require it before sending email
        if (!visitDetails.appointmentDate || visitDetails.appointmentDate.trim() === '') {
            console.log('Step 3: Appointment date missing, returning error');
            return res.status(400).json({
                success: false,
                message: 'Appointment date is required before sending credit email. Please update the appointment date first.',
                requiresAppointmentDate: true,
                visitId: visitId
            });
        }

        console.log('Step 3: Appointment date found, proceeding to hospital lookup');

        console.log('Step 4: Fetching hospital directory...');
        // Get hospital email addresses from Hospital Directory
        const hospitalResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital Directory!B:I',
        });
        console.log('Step 4: Hospital directory fetched successfully');

        const hospitalRows = hospitalResponse.data.values || [];
        console.log('Step 4: Processing hospital rows, total:', hospitalRows.length);
        console.log('Step 4: Looking for hospital:', visitDetails.hospital);
        console.log('Step 4: Available hospitals:', hospitalRows.map(row => row[0]).filter(name => name));
        const hospitalRow = hospitalRows.find(row => row[0] === visitDetails.hospital);
        console.log('Step 4: Hospital row found:', !!hospitalRow);

        if (!hospitalRow || !hospitalRow[3]) {
            console.log('Step 4: Hospital not found or no email addresses configured');
            return res.status(404).json({
                success: false,
                message: `Hospital email addresses not found for: ${visitDetails.hospital}. Available hospitals: ${hospitalRows.map(row => row[0]).filter(name => name).join(', ')}`
            });
        }

        console.log('Step 4: Hospital found, proceeding with email addresses');

        // Parse comma-separated email addresses from Column E (index 3) - these go to "To" field
        const hospitalEmails = hospitalRow[3].split(',').map(email => email.trim()).filter(email => email);

        // Get additional emails from I2 cell (index 7) - these go to "CC" field
        const i2Emails = hospitalRow[7] ? hospitalRow[7].split(',').map(email => email.trim()).filter(email => email) : [];

        // Use only hospital emails for the main "To" field
        const emailAddresses = hospitalEmails;

        // Get patient email for CC
        let patientEmail = '';
        try {
            if (visitDetails.iycNumber) {
                const patientResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Patient Database!A:H',
                });
                const patientRows = patientResponse.data.values || [];
                const patientRow = patientRows.find(row => row[1] && row[1].toString().toLowerCase() === visitDetails.iycNumber.toLowerCase());
                if (patientRow && patientRow[2]) {
                    patientEmail = patientRow[2].trim();
                }
            }
        } catch (error) {
            console.error('Error fetching patient email:', error);
        }

        // Get purpose-specific email template from System Config sheet
        const templateResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'System Config!B:C', // Read Purpose (B) and Email template (C) columns
        });

        let template = 'Dear {name},\n\nWe are pleased to inform you that your appointment for {Purpose} has been confirmed.\n\nPlease contact us at {Contact} for any queries.\n\nBest regards,\nIsha Yoga Center - Clinic Management';

        // Find template matching the visit purpose
        if (templateResponse.data.values && templateResponse.data.values.length > 0) {
            console.log('Looking for template for purpose:', visitDetails.purpose);

            // Skip header row and search for matching purpose
            for (let i = 1; i < templateResponse.data.values.length; i++) {
                const row = templateResponse.data.values[i];
                if (row && row.length >= 2) {
                    const purposeInSheet = row[0]; // Column B
                    const templateInSheet = row[1]; // Column C

                    if (purposeInSheet && templateInSheet &&
                        purposeInSheet.trim().toLowerCase() === visitDetails.purpose.trim().toLowerCase()) {
                        template = templateInSheet;
                        console.log('Found matching template for purpose:', purposeInSheet);
                        break;
                    }
                }
            }
        }

        // Replace placeholders in template (case-insensitive)
        let emailContent = template
            .replace(/{name}/gi, visitDetails.patientName)
            .replace(/{Name}/g, visitDetails.patientName)
            .replace(/{CONTACT}/gi, visitDetails.phoneNumber)
            .replace(/{Contact}/g, visitDetails.phoneNumber);

        // Handle PURPOSE and DOCTOR placeholders conditionally based on purpose type
        if (visitDetails.purpose === 'Consultation & Investigation') {
            // For Consultation & Investigation, include doctor name
            emailContent = emailContent
                .replace(/{PURPOSE}/gi, visitDetails.purpose)
                .replace(/{Purpose}/g, visitDetails.purpose)
                .replace(/{DOCTOR}/gi, visitDetails.doctor || 'Not specified')
                .replace(/{Doctor}/g, visitDetails.doctor || 'Not specified')
                .replace(/{Doctot}/g, visitDetails.doctor || 'Not specified'); // Handle typo in template
        } else {
            // For other purposes, replace purpose normally but remove doctor references
            emailContent = emailContent
                .replace(/{PURPOSE}/gi, visitDetails.purpose)
                .replace(/{Purpose}/g, visitDetails.purpose);

            // Remove doctor placeholders and any "to" text that precedes them
            emailContent = emailContent
                .replace(/\s+to\s+{DOCTOR}/gi, '')
                .replace(/\s+to\s+{Doctor}/gi, '')
                .replace(/\s+to\s+{Doctot}/gi, '') // Handle typo in template
                .replace(/{DOCTOR}/gi, '')
                .replace(/{Doctor}/g, '')
                .replace(/{Doctot}/g, ''); // Handle typo in template
        }

        // Send email with I2 emails in CC
        const emailResult = await sendCreditEmail(emailAddresses, emailContent, visitDetails, patientEmail, i2Emails);

        if (emailResult.success) {
            // Update the Hospital_Visit_Data sheet to mark email as sent
            try {
                const visitRowIndex = visitRows.findIndex(row => row[0] === visitId);
                if (visitRowIndex >= 0) {
                    // Update the Email Sent column (Column N, index 13)
                    const updateRange = `Hospital_Visit_Data!N${visitRowIndex + 1}`;
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: SPREADSHEET_ID,
                        range: updateRange,
                        valueInputOption: 'RAW',
                        requestBody: {
                            values: [['Yes']]
                        }
                    });
                    console.log('Updated email sent status for visit:', visitId);
                }
            } catch (updateError) {
                console.error('Failed to update email sent status:', updateError);
                // Don't fail the whole request if status update fails
            }

            res.json({
                success: true,
                message: 'Credit email sent successfully',
                messageId: emailResult.messageId,
                demo: emailResult.demo || false,
                emailAddresses: emailAddresses,
                emailsSent: emailAddresses.length,
                content: emailContent
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send credit email',
                error: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error in send-credit-email endpoint:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to send credit email',
            error: error.message,
            stack: error.stack
        });
    }
});

// Update appointment date endpoint
app.post('/api/update-appointment-date', async (req, res) => {
    try {
        const { visitId, appointmentDate } = req.body;

        if (!visitId) {
            return res.status(400).json({
                success: false,
                message: 'Visit ID is required'
            });
        }

        console.log('Updating appointment date for visit:', visitId, 'to:', appointmentDate);

        // Get visit details from Hospital_Visit_Data
        const visitResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:Q',
        });

        const visitRows = visitResponse.data.values || [];
        const visitRowIndex = visitRows.findIndex(row => row[0] === visitId);

        if (visitRowIndex < 0) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Update the Appointment Date column (Column O, index 14)
        const updateRange = `Hospital_Visit_Data!O${visitRowIndex + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: updateRange,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[appointmentDate || '']]
            }
        });

        console.log('Updated appointment date for visit:', visitId);

        res.json({
            success: true,
            message: 'Appointment date updated successfully',
            visitId: visitId,
            appointmentDate: appointmentDate
        });

    } catch (error) {
        console.error('Error updating appointment date:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update appointment date',
            error: error.message
        });
    }
});

// Update visit status for multiple visits
app.post('/api/update-visit-status', async (req, res) => {
    try {
        const { visitIds, newStatus } = req.body;
        console.log(`Updating status for visits: ${visitIds} to: ${newStatus}`);

        // Get all rows from Hospital_Visit_Data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:O',
        });

        const rows = response.data.values || [];
        let updatedCount = 0;
        const updates = [];

        // Find and prepare updates for each visit
        for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            const visitId = row[0]; // ID is in column A

            if (visitIds.includes(visitId)) {
                // Update status in column K (index 10) - Status column
                const rowIndex = i + 1; // Convert to 1-based row number
                updates.push({
                    range: `Hospital_Visit_Data!K${rowIndex}`,
                    values: [[newStatus]]
                });
                updatedCount++;
            }
        }

        // Execute batch update if we have updates
        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    valueInputOption: 'RAW',
                    data: updates
                }
            });
        }

        console.log(`Updated status for ${updatedCount} visits`);
        res.json({
            success: true,
            message: `Successfully updated ${updatedCount} visit(s) to ${newStatus}`,
            updatedCount
        });

    } catch (error) {
        console.error('Error updating visit status:', error);
        res.status(500).json({ success: false, message: 'Failed to update visit status' });
    }
});

// Update hospital visit status (bulk operation) - following blood test pattern
app.post('/api/hospital-visit-status', async (req, res) => {
    try {
        const { visitIds, newStatus, rowIndices } = req.body;

        console.log(`Updating ${visitIds.length} visits to status: ${newStatus} using row indices`);

        if (visitIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No visits provided for update'
            });
        }

        // Get all visits to find row indices
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:P',
        });

        const rows = response.data.values || [];
        let updatedCount = 0;

        // Find and update each visit
        for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            const visitId = row[0]; // ID is in column A

            if (visitIds.includes(visitId)) {
                // Update status in column K (index 10)
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `Hospital_Visit_Data!K${i + 1}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [[newStatus]]
                    }
                });
                updatedCount++;
            }
        }

        console.log(`Updated ${updatedCount} visits to status: ${newStatus}`);
        res.json({
            success: true,
            message: `Successfully updated ${updatedCount} visit(s) to ${newStatus}`,
            updatedCount
        });

    } catch (error) {
        console.error('Error updating visit status:', error);
        res.status(500).json({ success: false, message: 'Failed to update visit status' });
    }
});



// Delete multiple visits
app.post('/api/delete-visits', async (req, res) => {
    try {
        const { visitIds } = req.body;
        console.log(`Deleting visits: ${visitIds}`);

        // Get all rows from Hospital_Visit_Data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Hospital_Visit_Data!A:O',
        });

        const rows = response.data.values || [];
        let deletedCount = 0;
        const rowsToDelete = [];

        // Find rows to delete
        for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            const visitId = row[0]; // ID is in column A

            if (visitIds.includes(visitId)) {
                rowsToDelete.push(i + 1); // Convert to 1-based row number
                deletedCount++;
            }
        }

        // Delete rows in reverse order to maintain indices
        const sortedRows = rowsToDelete.sort((a, b) => b - a);
        for (const rowIndex of sortedRows) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: await getSheetId('Hospital_Visit_Data'),
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex
                            }
                        }
                    }]
                }
            });
        }

        console.log(`Deleted ${deletedCount} visits`);
        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} visit(s)`,
            deletedCount
        });

    } catch (error) {
        console.error('Error deleting visits:', error);
        res.status(500).json({ success: false, message: 'Failed to delete visits' });
    }
});







// Get system configuration
app.get('/api/system-config', async (req, res) => {
    try {
        const config = await getSystemConfig();

        // Parse anchors JSON if it exists
        let anchors = [];
        if (config.anchors) {
            try {
                console.log('Raw anchors string:', config.anchors);

                // Try to fix common JSON issues
                let cleanedAnchors = config.anchors
                    .replace(/\n/g, '') // Remove newlines
                    .replace(/\r/g, '') // Remove carriage returns
                    .trim(); // Remove leading/trailing spaces

                console.log('Cleaned anchors string:', cleanedAnchors);

                const anchorsData = JSON.parse(cleanedAnchors);

                if (Array.isArray(anchorsData)) {
                    // Already in correct format
                    anchors = anchorsData;
                } else if (typeof anchorsData === 'object') {
                    // Convert from {name: email} format to [{name: name, email: email}] format
                    anchors = Object.keys(anchorsData).map(name => ({
                        name: name,
                        email: anchorsData[name]
                    }));
                }

                console.log('Successfully parsed anchors:', anchors);
            } catch (parseError) {
                console.error('Error parsing anchors JSON:', parseError.message);
                console.error('Raw anchors data:', JSON.stringify(config.anchors));

                // Try to extract names manually if JSON parsing fails
                try {
                    const nameMatches = config.anchors.match(/"([^"]+)":/g);
                    if (nameMatches) {
                        anchors = nameMatches.map(match => ({
                            name: match.replace(/"/g, '').replace(':', ''),
                            email: ''
                        }));
                        console.log('Extracted anchor names manually:', anchors);
                    }
                } catch (extractError) {
                    console.error('Failed to extract anchor names manually');
                    anchors = [];
                }
            }
        }

        // Parse referred by names (comma-separated)
        let referredByList = [];
        if (config.referredBy) {
            referredByList = config.referredBy.split(',').map(name => name.trim()).filter(name => name);
        }

        // Parse others JSON if it exists
        let othersList = [];
        if (config.others) {
            try {
                console.log('Raw others string:', config.others);

                // Try to fix common JSON issues
                let cleanedOthers = config.others
                    .replace(/\n/g, '') // Remove newlines
                    .replace(/\r/g, '') // Remove carriage returns
                    .trim(); // Remove leading/trailing spaces

                console.log('Cleaned others string:', cleanedOthers);

                const othersData = JSON.parse(cleanedOthers);

                if (Array.isArray(othersData)) {
                    // Already in correct format
                    othersList = othersData;
                } else if (typeof othersData === 'object') {
                    // Convert from {name: email} format to array of names
                    othersList = Object.keys(othersData).map(name => ({
                        name: name,
                        email: othersData[name]
                    }));
                }

                console.log('Successfully parsed others:', othersList);
            } catch (parseError) {
                console.error('Error parsing others JSON:', parseError.message);
                console.error('Raw others data:', JSON.stringify(config.others));

                // Try to extract names manually if JSON parsing fails
                try {
                    const nameMatches = config.others.match(/"([^"]+)":/g);
                    if (nameMatches) {
                        othersList = nameMatches.map(match => ({
                            name: match.replace(/"/g, '').replace(':', ''),
                            email: ''
                        }));
                        console.log('Extracted others names manually:', othersList);
                    }
                } catch (extractError) {
                    console.error('Failed to extract others names manually');
                    // Fallback to comma-separated parsing
                    othersList = config.others.split(',').map(name => name.trim()).filter(name => name).map(name => ({
                        name: name,
                        email: ''
                    }));
                }
            }
        }

        res.json({
            success: true,
            data: {
                anchors: anchors,
                referredBy: referredByList,
                others: othersList,
                ultrasound_doctor: config.ultrasound_doctor || ''
            }
        });
    } catch (error) {
        console.error('Error getting system config:', error);
        res.status(500).json({ success: false, message: 'Failed to get system config' });
    }
});

// Save diet request data
app.post('/api/diet-request', async (req, res) => {
    try {
        const dietRequestData = req.body;
        console.log('Saving diet request:', dietRequestData);

        // Ensure Diet_Request_Data worksheet has correct headers
        await ensureDietRequestHeaders();

        // Generate unique ID
        const dietRequestId = `DR${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Prepare row data
        const rowData = [
            dietRequestId,
            dietRequestData.dateRequested,
            dietRequestData.iycNumber || '',
            dietRequestData.patientName,
            dietRequestData.email,
            dietRequestData.phoneNumber,
            dietRequestData.anchor,
            dietRequestData.others,
            dietRequestData.brunch,
            dietRequestData.lunch,
            dietRequestData.dinner,
            dietRequestData.oneTimeTakeaway,
            dietRequestData.duration,
            dietRequestData.startDate,
            dietRequestData.endDate,
            dietRequestData.remarks,
            dietRequestData.status,
            timestamp,
            timestamp
        ];

        // Append to Diet_Request_Data worksheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Diet_Request_Data!A:S',
            valueInputOption: 'RAW',
            resource: {
                values: [rowData]
            }
        });

        console.log('Diet request saved successfully:', response.data);

        res.json({
            success: true,
            message: 'Diet request saved successfully',
            dietRequestId: dietRequestId,
            data: response.data
        });

    } catch (error) {
        console.error('Error saving diet request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save diet request',
            error: error.message
        });
    }
});

// Get all diet requests
app.get('/api/diet-requests', async (req, res) => {
    try {
        console.log('Getting all diet requests');

        // Read from Diet_Request_Data worksheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Diet_Request_Data!A:S',
        });

        const rows = response.data.values || [];

        if (rows.length <= 1) {
            return res.json({
                success: true,
                dietRequests: []
            });
        }

        // Skip header row and format data
        const dietRequests = rows.slice(1).map((row, index) => ({
            id: row[0] || '',
            dateRequested: row[1] || '',
            iycNumber: row[2] || '',
            patientName: row[3] || '',
            email: row[4] || '',
            phoneNumber: row[5] || '',
            anchor: row[6] || '',
            others: row[7] || '',
            brunch: row[8] || '',
            lunch: row[9] || '',
            dinner: row[10] || '',
            oneTimeTakeaway: row[11] || '',
            duration: row[12] || '',
            startDate: row[13] || '',
            endDate: row[14] || '',
            remarks: row[15] || '',
            status: row[16] || '',
            created: row[17] || '',
            updated: row[18] || '',
            rowIndex: index + 2 // +2 because we skip header and arrays are 0-indexed
        })).filter(dietRequest => {
            // Only include rows with patient names
            return dietRequest.patientName;
        });

        res.json({
            success: true,
            dietRequests: dietRequests,
            count: dietRequests.length
        });

    } catch (error) {
        console.error('Error getting diet requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get diet requests',
            error: error.message
        });
    }
});

// Send diet request email
app.post('/api/diet-request/send-email', async (req, res) => {
    try {
        const { dietRequestId } = req.body;

        if (!dietRequestId) {
            return res.status(400).json({
                success: false,
                message: 'Diet request ID is required'
            });
        }

        console.log('Sending diet request email for ID:', dietRequestId);

        // Get diet request details
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Diet_Request_Data!A:S',
        });

        const rows = response.data.values || [];
        const dietRequestRow = rows.find(row => row[0] === dietRequestId);

        if (!dietRequestRow) {
            return res.status(404).json({
                success: false,
                message: 'Diet request not found'
            });
        }

        // Parse diet request details
        const dietRequestDetails = {
            id: dietRequestRow[0],
            dateRequested: dietRequestRow[1],
            iycNumber: dietRequestRow[2],
            patientName: dietRequestRow[3],
            email: dietRequestRow[4],
            phoneNumber: dietRequestRow[5],
            anchor: dietRequestRow[6],
            others: dietRequestRow[7],
            brunch: dietRequestRow[8],
            lunch: dietRequestRow[9],
            dinner: dietRequestRow[10],
            oneTimeTakeaway: dietRequestRow[11],
            duration: dietRequestRow[12],
            startDate: dietRequestRow[13],
            endDate: dietRequestRow[14],
            remarks: dietRequestRow[15],
            status: dietRequestRow[16]
        };

        // Get system configuration for email addresses
        const configResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'System Config!C1:C15',
        });

        const configValues = configResponse.data.values || [];

        // Get main email addresses from row 3 (index 3)
        let mainEmails = [];
        if (configValues[3] && configValues[3][0]) {
            mainEmails = configValues[3][0].split(',').map(email => email.trim()).filter(email => email);
        }

        // Get anchor emails from row 4 (index 4) - anchors JSON
        let anchorEmails = [];
        if (configValues[4] && configValues[4][0]) {
            try {
                const anchorsData = JSON.parse(configValues[4][0].replace(/\n/g, '').replace(/\r/g, '').trim());
                anchorEmails = Object.values(anchorsData).filter(email => email);
            } catch (error) {
                console.error('Error parsing anchors JSON for diet request emails:', error);
            }
        }

        // Get others emails from row 6 (index 6) - others JSON
        let othersEmails = [];
        if (configValues[6] && configValues[6][0]) {
            try {
                const othersData = JSON.parse(configValues[6][0].replace(/\n/g, '').replace(/\r/g, '').trim());
                othersEmails = Object.values(othersData).filter(email => email);
            } catch (error) {
                console.error('Error parsing others JSON for diet request emails:', error);
            }
        }

        // Main recipients - use main emails from system config
        const emailAddresses = mainEmails;

        // CC recipients - include anchor and others emails
        const ccEmails = [...anchorEmails, ...othersEmails];

        // Get patient email for CC
        let patientEmail = '';
        try {
            if (dietRequestDetails.iycNumber) {
                const patientResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Patient Database!A:H',
                });
                const patientRows = patientResponse.data.values || [];
                const patientRow = patientRows.find(row => row[1] && row[1].toString().toLowerCase() === dietRequestDetails.iycNumber.toLowerCase());
                if (patientRow && patientRow[2]) {
                    patientEmail = patientRow[2].trim();
                }
            }
        } catch (error) {
            console.error('Error fetching patient email:', error);
        }

        // Create email body table matching original format exactly
        let emailBody = '<table border="1" cellpadding="5" cellspacing="0">';

        // Build table rows - start with basic info
        const tableRows = [
            ['Name', dietRequestDetails.patientName || ''],
            ['Email', dietRequestDetails.email || ''],
            ['Phone No.', dietRequestDetails.phoneNumber || '']
        ];

        // Add meal fields only if they have content
        if (dietRequestDetails.brunch && dietRequestDetails.brunch.trim()) {
            tableRows.push(['Brunch', dietRequestDetails.brunch]);
        }
        if (dietRequestDetails.lunch && dietRequestDetails.lunch.trim()) {
            tableRows.push(['Lunch', dietRequestDetails.lunch]);
        }
        if (dietRequestDetails.dinner && dietRequestDetails.dinner.trim()) {
            tableRows.push(['Dinner', dietRequestDetails.dinner]);
        }

        // Add remaining fields
        if (dietRequestDetails.oneTimeTakeaway && dietRequestDetails.oneTimeTakeaway.trim()) {
            tableRows.push(['One time takeaway', dietRequestDetails.oneTimeTakeaway]);
        }

        tableRows.push(['Duration (in Days)', dietRequestDetails.duration || '']);
        tableRows.push(['Start Date', dietRequestDetails.startDate || '']);
        tableRows.push(['End Date', dietRequestDetails.endDate || '']);

        // Add each row to the table
        tableRows.forEach(row => {
            emailBody += '<tr>';
            row.forEach(cell => {
                const cellValue = cell || '';
                // Handle line breaks like in original code
                const cellLines = cellValue.toString().split('\\n');
                emailBody += '<td><span style="white-space:pre-wrap;">' + cellLines.join('<br>') + '</span></td>';
            });
            emailBody += '</tr>';
        });

        emailBody += '</table>';

        // Get signer name from anchor (the person sending the request)
        const signerName = dietRequestDetails.anchor || 'Clinic Team';

        // Create HTML email content in the original format
        const emailContent = `
        Namaskaram, Kindly take note of following diet request<br><br>${emailBody}<br><br><b>Guidelines for Patients:</b><br>Please bring your own container. Akshaya front office will not provide any container.<br><br>If you are no longer collecting the diet or wish to skip it for a day, please send us a quick email informing the same. This helps us reduce food wastage and unnecessary efforts for our sevadars.<br><br><b>Below mentioned are the food collection timings:</b><ul><li><b>Morning :</b> 8:30am to 11am</li><li><b>Afternoon :</b> 12:30pm to 1:30pm</li><li><b>Evening :</b> 6pm to 8pm</li></ul><br>Pranam,<br>${signerName}`;

        // Send email
        const emailResult = await sendDietRequestEmail(emailAddresses, emailContent, dietRequestDetails, patientEmail, ccEmails);

        if (emailResult.success) {
            res.json({
                success: true,
                message: 'Diet request email sent successfully',
                messageId: emailResult.messageId,
                emailAddresses: emailAddresses,
                ccEmails: ccEmails,
                emailsSent: emailAddresses.length + ccEmails.length
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send diet request email',
                error: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error in send diet request email endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send diet request email',
            error: error.message
        });
    }
});

// Delete diet requests
app.post('/api/diet-requests/delete', async (req, res) => {
    try {
        const { dietRequestIds } = req.body;

        console.log('Deleting diet requests:', dietRequestIds);

        if (!dietRequestIds || dietRequestIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No diet request IDs provided'
            });
        }

        // Get all diet requests to find row indices
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Diet_Request_Data!A:R',
        });

        const rows = response.data.values || [];
        const rowsToDelete = [];
        let deletedCount = 0;

        // Find rows to delete
        for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            const dietRequestId = row[0]; // ID is in column A

            if (dietRequestIds.includes(dietRequestId)) {
                rowsToDelete.push(i + 1); // Convert to 1-based row number
                deletedCount++;
            }
        }

        // Delete rows in reverse order to maintain indices
        const sortedRows = rowsToDelete.sort((a, b) => b - a);
        for (const rowIndex of sortedRows) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: await getSheetId('Diet_Request_Data'),
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex
                            }
                        }
                    }]
                }
            });
        }

        console.log(`Deleted ${deletedCount} diet requests`);
        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} diet request(s)`,
            deletedCount
        });

    } catch (error) {
        console.error('Error deleting diet requests:', error);
        res.status(500).json({ success: false, message: 'Failed to delete diet requests' });
    }
});

// Get authentication credentials from system config
app.get('/api/system-config/auth', async (req, res) => {
    try {
        console.log('Auth config requested...');
        const config = await getSystemConfig();

        console.log('Auth config retrieved:', {
            username: config.username ? 'present' : 'missing',
            password: config.password ? 'present' : 'missing'
        });

        if (!config.username || !config.password) {
            console.warn('Auth credentials missing from System Config');
            return res.status(404).json({
                success: false,
                message: 'Auth credentials not found in System Config'
            });
        }

        res.json({
            success: true,
            data: {
                username: config.username,
                password: config.password
            }
        });
    } catch (error) {
        console.error('Error getting auth config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get auth config: ' + error.message
        });
    }
});

// Debug endpoint to see raw system config data
app.get('/api/debug/system-config', async (req, res) => {
    try {
        const config = await getSystemConfig();
        res.json({
            success: true,
            debug: {
                username: `"${config.username}"`,
                password: `"${config.password}"`,
                anchors: `"${config.anchors}"`,
                referredBy: `"${config.referredBy}"`,
                others: `"${config.others}"`
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Helper function to ensure Patient Database worksheet has correct headers
async function ensurePatientDatabaseHeaders() {
    try {
        console.log('Checking Patient Database worksheet headers...');

        // Check if the worksheet exists and has correct headers for key columns
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!A1:I1'
        });

        const expectedHeaders = ['Name', 'IYC Number', 'Email', 'Personal Email', 'Phone Numbers', 'Current Department', 'Category', 'Age'];
        const existingHeaders = response.data.values ? response.data.values[0] : [];

        // Check if key headers match (A, B, C, E, F, G, H)
        const keyHeadersMatch = (
            existingHeaders[0] === 'Name' &&
            existingHeaders[1] === 'IYC Number' &&
            existingHeaders[2] === 'Email' &&
            existingHeaders[4] === 'Phone Numbers' &&
            existingHeaders[5] === 'Current Department' &&
            existingHeaders[6] === 'Category' &&
            existingHeaders[7] === 'Age'
        );

        if (!keyHeadersMatch) {
            console.log('Patient Database worksheet headers need updating...');
            console.log('Expected: Name, IYC Number, Email, [Personal Email], Phone Numbers, Current Department, Category, Age');
            console.log('Found:', existingHeaders);

            // Update the headers to include Age column
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Patient Database!A1:I1',
                valueInputOption: 'RAW',
                resource: {
                    values: [expectedHeaders.concat(['Emergency Contact'])] // Add Emergency Contact as column I
                }
            });

            console.log('Patient Database worksheet headers updated successfully');
        } else {
            console.log('Patient Database worksheet key headers are correct');
        }
    } catch (error) {
        if (error.code === 400 && error.message.includes('Unable to parse range')) {
            console.log('Patient Database worksheet does not exist, creating it...');

            try {
                // Create the worksheet
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'Patient Database'
                                }
                            }
                        }]
                    }
                });

                // Add headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Patient Database!A1:I1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [['Name', 'IYC Number', 'Email', 'Personal Email', 'Phone Numbers', 'Current Department', 'Category', 'Age', 'Emergency Contact']]
                    }
                });

                console.log('Patient Database worksheet created successfully');
            } catch (createError) {
                console.error('Error creating Patient Database worksheet:', createError);
                throw createError;
            }
        } else {
            console.error('Error checking Patient Database worksheet:', error);
            throw error;
        }
    }
}

// Get next available patient ID for non-poornanga patients
app.get('/api/next-patient-id', async (req, res) => {
    try {
        console.log('Generating next patient ID...');

        // Read from Patient Database worksheet to find the highest ID number
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!B:B', // IYC column
        });

        const rows = response.data.values || [];
        let maxIdNumber = 0;

        console.log(`Found ${rows.length} rows in Patient Database`);

        // Find the highest ID number from existing auto-generated IDs
        for (let i = 1; i < rows.length; i++) {
            const iycValue = rows[i][0];
            if (iycValue && iycValue.startsWith('ID')) {
                const idNumber = parseInt(iycValue.substring(2));
                console.log(`Found existing ID: ${iycValue}, number: ${idNumber}`);
                if (!isNaN(idNumber) && idNumber > maxIdNumber) {
                    maxIdNumber = idNumber;
                }
            }
        }

        // Generate next ID - if no existing IDs found, start from 1 (which becomes ID001)
        const nextIdNumber = maxIdNumber + 1;
        const nextId = `ID${nextIdNumber.toString().padStart(3, '0')}`;

        console.log(`Max existing ID number: ${maxIdNumber}, Next ID: ${nextId}`);

        console.log(`Generated next patient ID: ${nextId}`);

        res.json({
            success: true,
            nextId: nextId
        });

    } catch (error) {
        console.error('Error generating next patient ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate patient ID',
            error: error.message
        });
    }
});

// Register new patient in Patient Database sheet
app.post('/api/register-patient', async (req, res) => {
    try {
        const { name, email, phone, iyc, category, age, department, emergencyContact, patientType } = req.body;

        if (!name || !email || !phone || !patientType || !category || !age || !department) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, phone, patient type, category, age, and department are required'
            });
        }

        // Additional validation for Poornanga patients
        if (patientType === 'poornanga' && !iyc) {
            return res.status(400).json({
                success: false,
                message: 'IYC number is required for Poornanga patients'
            });
        }

        console.log(`Registering new patient: ${name}, Type: ${patientType}, Email: ${email}, Phone: ${phone}, Age: ${age}, Department: ${department}`);

        // Ensure Patient Database worksheet exists and has correct headers
        await ensurePatientDatabaseHeaders();

        // Check if patient already exists (by email or IYC if provided)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!A:H'
        });

        const rows = response.data.values || [];

        // Skip duplicate email/phone check for Samskriti category
        const isSamskriti = category === 'Samskriti';
        
        // Check for duplicate email or IYC
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!isSamskriti && row[2] && row[2].toLowerCase() === email.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: 'Patient with this email already exists'
                });
            }
            if (iyc && row[1] && row[1].toLowerCase() === iyc.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: 'Patient with this IYC number already exists'
                });
            }
        }

        // Handle patient ID and category based on patient type
        let patientId = iyc;
        let finalCategory = category;

        if (patientType === 'poornanga') {
            // For Poornanga: use provided IYC, set category to FTV
            patientId = iyc;
            finalCategory = 'FTV';
        } else if (patientType === 'non-poornanga') {
            // For Non-Poornanga: use provided auto-generated ID, keep user-selected category
            patientId = iyc; // This should be the auto-generated ID from frontend
            finalCategory = category || '';
        }

        const timestamp = new Date().toISOString();

        // Prepare row data: [Name, IYC, Email, Personal Email, Phone, Current Department, Category, Age]
        // Match the existing sheet structure: A=Name, B=IYC, C=Email, D=Personal Email, E=Phone, F=Current Department, G=Category, H=Age
        // Email placement logic: All emails go to Email column (C)
        const rowData = [
            name,                    // A: Name
            patientId,              // B: IYC Number
            email,                  // C: Email (for all patient types)
            '',                     // D: Personal Email (empty for all)
            phone,                  // E: Phone Numbers
            department,             // F: Current Department (user provided)
            finalCategory,          // G: Category
            age                     // H: Age
        ];

        // Add new patient to the sheet - save in main patient area (columns A-H)
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!A:H', // Save in main patient columns including Age
            valueInputOption: 'RAW',
            resource: {
                values: [rowData]
            }
        });

        console.log(`Patient registered successfully: ${name} (${patientId})`);

        res.json({
            success: true,
            message: 'Patient registered successfully',
            data: {
                id: patientId,
                name: name,
                email: email,
                phone: phone
            }
        });

    } catch (error) {
        console.error('Error registering patient:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register patient',
            error: error.message
        });
    }
});

// Update patient IYC and category in Patient Database sheet
app.post('/api/update-patient-iyc-category', async (req, res) => {
    try {
        const { patientRowIndex, currentIYC, newIYC, newCategory, updateReason, patientName, patientPhone } = req.body;

        if (!patientRowIndex || !newIYC || !newCategory) {
            return res.status(400).json({
                success: false,
                message: 'Patient row index, new IYC number, and new category are required'
            });
        }

        console.log(`Updating patient IYC and category - Row: ${patientRowIndex}, Current IYC: ${currentIYC}, New IYC: ${newIYC}, New Category: ${newCategory}`);

        // Ensure Patient Database worksheet exists and has correct headers
        await ensurePatientDatabaseHeaders();

        // Check if new IYC already exists (if it's different from current)
        if (newIYC !== currentIYC) {
            const checkResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Patient Database!B:B' // IYC column
            });

            const iycRows = checkResponse.data.values || [];
            for (let i = 1; i < iycRows.length; i++) { // Skip header row
                if (iycRows[i][0] && iycRows[i][0].toString().toLowerCase() === newIYC.toLowerCase()) {
                    return res.status(400).json({
                        success: false,
                        message: `IYC number ${newIYC} already exists for another patient`
                    });
                }
            }
        }

        // Update the specific row - update IYC (column B) and Category (column G)
        const updateRange = `Patient Database!B${patientRowIndex}:G${patientRowIndex}`;

        // Get current row data first
        const currentRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: updateRange
        });

        const currentRowData = currentRowResponse.data.values?.[0] || [];

        // Update only IYC (index 0 in B:G range) and Category (index 5 in B:G range)
        const updatedRowData = [...currentRowData];
        updatedRowData[0] = newIYC;     // B column (IYC)
        updatedRowData[5] = newCategory; // G column (Category)

        // Update the row
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: updateRange,
            valueInputOption: 'RAW',
            resource: {
                values: [updatedRowData]
            }
        });

        // Log the update for audit purposes
        console.log(`Patient updated successfully - Name: ${patientName}, Phone: ${patientPhone}, Old IYC: ${currentIYC}, New IYC: ${newIYC}, New Category: ${newCategory}, Reason: ${updateReason}`);

        res.json({
            success: true,
            message: 'Patient IYC and category updated successfully',
            data: {
                patientName: patientName,
                oldIYC: currentIYC,
                newIYC: newIYC,
                newCategory: newCategory,
                updateReason: updateReason
            }
        });

    } catch (error) {
        console.error('Error updating patient IYC and category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update patient information',
            error: error.message
        });
    }
});

// Update patient details in Patient Database sheet
app.post('/api/update-patient', async (req, res) => {
    try {
        const { iycNumber, name, email, phone } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone are required'
            });
        }

        console.log(`Updating patient details for IYC: ${iycNumber}, Name: ${name}, Email: ${email}, Phone: ${phone}`);

        // Ensure Patient Database worksheet exists and has correct headers
        await ensurePatientDatabaseHeaders();

        // Get all rows from Patient Database sheet (columns A, B, C, E for Name, IYC, Email, Phone)
        console.log('Reading Patient Database sheet...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patient Database!A:E'
        });

        const rows = response.data.values || [];
        console.log(`Found ${rows.length} rows in Patient Database sheet`);
        let patientRowIndex = -1;

        // Find the patient by IYC number (column B) or name (column A)
        for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            if ((iycNumber && row[1] === iycNumber) || (!iycNumber && row[0] === name)) {
                patientRowIndex = i + 1; // +1 because sheets are 1-indexed
                break;
            }
        }

        if (patientRowIndex === -1) {
            // Patient not found - return error instead of creating new record
            return res.status(404).json({
                success: false,
                message: 'Patient not found. Cannot update non-existing patient.'
            });
        } else {
            // Update existing patient - update individual columns: A (Name), B (IYC), C (Email), E (Phone)
            console.log(`Updating existing patient at row ${patientRowIndex}: ${name}`);

            // Update Name (Column A)
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Patient Database!A${patientRowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[name]]
                }
            });

            // Update IYC Number (Column B) - only if provided
            if (iycNumber) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `Patient Database!B${patientRowIndex}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [[iycNumber]]
                    }
                });
            }

            // Update Email (Column C) - only if provided in request
            if (email !== undefined) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `Patient Database!C${patientRowIndex}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [[email || '']]
                    }
                });
            }

            // Update Phone (Column E)
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Patient Database!E${patientRowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[phone]]
                }
            });

            console.log(`✅ Successfully updated patient at row ${patientRowIndex}: ${name}`);
        }

        res.json({
            success: true,
            message: 'Patient details updated successfully'
        });

    } catch (error) {
        console.error('Error updating patient details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update patient details: ' + error.message
        });
    }
});

// Test endpoint to manually update ultrasound headers
app.post('/api/test/update-ultrasound-headers', async (req, res) => {
    try {
        await ensureUltrasoundHeaders();
        res.json({
            success: true,
            message: 'Ultrasound headers updated successfully'
        });
    } catch (error) {
        console.error('Error updating ultrasound headers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ultrasound headers',
            error: error.message
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, async () => {
    const serverUrl = process.env.NODE_ENV === 'production'
        ? `https://your-app.onrender.com`
        : `http://localhost:${PORT}`;
    console.log(`🚀 Clinic Management Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Google Sheets integration active`);
    console.log(`📋 Spreadsheet ID: ${SPREADSHEET_ID}`);

    // Ensure Blood_Test_Data worksheet has correct headers
    await ensureBloodTestHeaders();

    // Ensure Hospital_Visit_Data worksheet has correct headers
    await ensureHospitalVisitHeaders();

    // Ensure Ultrasound_Data worksheet has correct headers
    await ensureUltrasoundHeaders();

    // Ensure Diet_Request_Data worksheet has correct headers
    await ensureDietRequestHeaders();

    // Ensure Patient Database worksheet has correct headers
    await ensurePatientDatabaseHeaders();

});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server gracefully...');
    process.exit(0);
});
