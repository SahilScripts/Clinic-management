// Google Sheets API integration via backend server
class GoogleSheetsAPI {
    constructor() {
        // Dynamically determine the base URL based on the current environment
        this.baseURL = this.getBaseURL();
        this.isInitialized = false;
    }

    // Get the appropriate base URL for API calls
    getBaseURL() {
        // If we're in development (localhost), use the development server
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:10000/api';
        }

        // For production (Render or any other deployment), use relative path
        // This will automatically use the same domain and port as the frontend
        return '/api';
    }

    // Initialize the Google Sheets API connection
    async initialize() {
        try {
            // Test connection to backend server
            const response = await fetch(`${this.baseURL}/test`);
            const data = await response.json();

            if (response.ok) {
                this.isInitialized = true;
                console.log('Google Sheets API initialized successfully:', data.message);
                return true;
            } else {
                throw new Error('Backend server not responding');
            }
        } catch (error) {
            console.error('Failed to initialize Google Sheets API:', error);
            console.error('Make sure the backend server is running and accessible');
            return false;
        }
    }

    // Read data from a specific range in the spreadsheet
    async readRange(worksheetName, range) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            // Demo mode - return sample data
            console.log(`Demo: Reading from ${worksheetName}!${range}`);

            // Return sample patient data for demo
            if (worksheetName === 'Patient Database') {
                return [
                    ['John Doe', 'IYC001', '', '', '9876543210'],
                    ['Jane Smith', 'IYC002', '', '', '9876543211'],
                    ['Bob Johnson', 'IYC003', '', '', '9876543212']
                ];
            }

            return [];
        } catch (error) {
            console.error('Error reading from Google Sheets:', error);
            throw error;
        }
    }

    // Append data to a worksheet
    async appendData(worksheetName, values, insertAfterRow = null) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            // Demo mode - simulate successful append
            console.log(`Demo: Appending to ${worksheetName}`, values);
            console.log(`Insert after row: ${insertAfterRow}`);

            // Simulate API response
            return {
                spreadsheetId: CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID,
                tableRange: `${worksheetName}!A${insertAfterRow || 'end'}:G${insertAfterRow || 'end'}`,
                updates: {
                    spreadsheetId: CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID,
                    updatedRows: 1,
                    updatedColumns: values.length,
                    updatedCells: values.length
                }
            };
        } catch (error) {
            console.error('Error appending to Google Sheets:', error);
            throw error;
        }
    }

    // Get sheet ID by name
    async getSheetId(worksheetName) {
        try {
            // Demo mode - return mock sheet ID
            console.log(`Demo: Getting sheet ID for ${worksheetName}`);
            return 0; // Default sheet ID
        } catch (error) {
            console.error('Error getting sheet ID:', error);
            throw error;
        }
    }

    // Lookup patient data by IYC number
    async lookupPatientByIYC(iycNumber) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/patient/${encodeURIComponent(iycNumber)}`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.error || 'Failed to lookup patient');
            }
        } catch (error) {
            console.error('Error looking up patient:', error);
            throw error;
        }
    }

    // Save blood test data
    async saveBloodTest(testData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/blood-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData)
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to save blood test');
            }
        } catch (error) {
            console.error('Error saving blood test:', error);
            return {
                success: false,
                message: 'Failed to save blood test: ' + error.message,
                error: error
            };
        }
    }

    // Get tests by status
    async getTests(status) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/tests/${encodeURIComponent(status)}`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get tests');
            }
        } catch (error) {
            console.error('Error getting tests:', error);
            throw error;
        }
    }

    // Get all tests (for client-side filtering)
    async getAllTests() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/tests/all`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get all tests');
            }
        } catch (error) {
            console.error('Error getting all tests:', error);
            throw error;
        }
    }

    // Update test status (much more efficient than moving between sheets)
    async updateTestStatus(testIds, newStatus, rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    testIds,
                    newStatus,
                    rowIndices
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update test status');
            }
        } catch (error) {
            console.error('Error updating test status:', error);
            throw error;
        }
    }

    // Update test status and date (for moving pending tests to upcoming with date change)
    async updateTestStatusAndDate(testIds, newStatus, newDate, rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/update-status-and-date`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    testIds,
                    newStatus,
                    newDate,
                    rowIndices
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update test status and date');
            }
        } catch (error) {
            console.error('Error updating test status and date:', error);
            throw error;
        }
    }

    // Update test dates only (without changing status)
    async updateTestDates(testIds, newDate, rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            console.log('=== CALLING UPDATE DATES API ===');
            console.log('URL:', `${this.baseURL}/update-dates`);
            console.log('Payload:', { testIds, newDate, rowIndices });

            const response = await fetch(`${this.baseURL}/update-dates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    testIds,
                    newDate,
                    rowIndices
                })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            const responseText = await response.text();
            console.log('Raw response text:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text that failed to parse:', responseText);
                throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
            }

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update test dates');
            }
        } catch (error) {
            console.error('Error updating test dates:', error);
            throw error;
        }
    }

    // Update test data
    async updateTest(rowIndex, testData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/test/${rowIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData)
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update test');
            }
        } catch (error) {
            console.error('Error updating test:', error);
            throw error;
        }
    }

    // Update test details (wrapper for updateTest with specific fields)
    async updateTestDetails(testData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            // Extract the row index and prepare the data for the existing updateTest method
            const { rowIndex, date, testName } = testData;

            // Prepare the test data object for the existing API
            const updateData = {
                date: date,
                testName: testName
            };

            // Use the existing updateTest method
            return await this.updateTest(rowIndex, updateData);
        } catch (error) {
            console.error('Error updating test details:', error);
            return {
                success: false,
                message: 'Failed to update test details: ' + error.message
            };
        }
    }

    // Delete tests
    async deleteTests(rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/tests`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rowIndices
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to delete tests');
            }
        } catch (error) {
            console.error('Error deleting tests:', error);
            throw error;
        }
    }

    // Get hospitals from Hospital Directory
    async getHospitals() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/hospitals`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get hospitals');
            }
        } catch (error) {
            console.error('Error getting hospitals:', error);
            return {
                success: false,
                message: 'Failed to get hospitals: ' + error.message,
                hospitals: []
            };
        }
    }

    // Get all patients for search functionality
    async getAllPatients() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/patients`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get patients');
            }
        } catch (error) {
            console.error('Error getting patients:', error);
            return {
                success: false,
                message: 'Failed to get patients: ' + error.message,
                patients: []
            };
        }
    }

    // Save hospital visit data
    async saveHospitalVisit(visitData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/hospital-visit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(visitData)
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to save hospital visit');
            }
        } catch (error) {
            console.error('Error saving hospital visit:', error);
            return {
                success: false,
                message: 'Failed to save hospital visit: ' + error.message,
                error: error
            };
        }
    }

    // Get hospital visits by status
    async getHospitalVisits(status) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/hospital-visits/${encodeURIComponent(status)}`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get hospital visits');
            }
        } catch (error) {
            console.error('Error getting hospital visits:', error);
            return {
                success: false,
                message: 'Failed to get hospital visits: ' + error.message,
                visits: []
            };
        }
    }

    // Update hospital visit status
    async updateHospitalVisitStatus(visitIds, newStatus, rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/hospital-visit-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    visitIds,
                    newStatus,
                    rowIndices
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update hospital visit status');
            }
        } catch (error) {
            console.error('Error updating hospital visit status:', error);
            return {
                success: false,
                message: 'Failed to update hospital visit status: ' + error.message
            };
        }
    }

    // Save ultrasound data
    async saveUltrasound(ultrasoundData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/ultrasound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ultrasoundData)
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to save ultrasound');
            }
        } catch (error) {
            console.error('Error saving ultrasound:', error);
            return {
                success: false,
                message: 'Failed to save ultrasound: ' + error.message,
                error: error
            };
        }
    }

    // Get ultrasounds by status
    async getUltrasounds(status) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/ultrasounds/${encodeURIComponent(status)}`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get ultrasounds');
            }
        } catch (error) {
            console.error('Error getting ultrasounds:', error);
            throw error;
        }
    }

    // Get all ultrasounds (for client-side filtering)
    async getAllUltrasounds() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/ultrasounds/all`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get all ultrasounds');
            }
        } catch (error) {
            console.error('Error getting all ultrasounds:', error);
            throw error;
        }
    }

    // Update ultrasound status (much more efficient than moving between sheets)
    async updateUltrasoundStatus(ultrasoundIds, newStatus, rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/ultrasound-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ultrasoundIds,
                    newStatus,
                    rowIndices
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update ultrasound status');
            }
        } catch (error) {
            console.error('Error updating ultrasound status:', error);
            throw error;
        }
    }

    // Update ultrasound data
    async updateUltrasound(rowIndex, ultrasoundData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/ultrasound/${rowIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ultrasoundData)
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update ultrasound');
            }
        } catch (error) {
            console.error('Error updating ultrasound:', error);
            throw error;
        }
    }

    // Update ultrasound details (wrapper for updateUltrasound with specific fields)
    async updateUltrasoundDetails(ultrasoundData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            // Extract the row index and prepare the data for the existing updateUltrasound method
            const { rowIndex, testName, date, timing } = ultrasoundData;

            // Prepare the ultrasound data object for the existing API
            const updateData = {
                testName: testName,
                date: date,
                timing: timing
            };

            // Use the existing updateUltrasound method
            return await this.updateUltrasound(rowIndex, updateData);
        } catch (error) {
            console.error('Error updating ultrasound details:', error);
            return {
                success: false,
                message: 'Failed to update ultrasound details: ' + error.message
            };
        }
    }

    // Delete ultrasounds
    async deleteUltrasounds(rowIndices) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/ultrasounds`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rowIndices
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to delete ultrasounds');
            }
        } catch (error) {
            console.error('Error deleting ultrasounds:', error);
            throw error;
        }
    }

    // Update appointment date for a hospital visit
    async updateAppointmentDate(visitId, appointmentDate) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/update-appointment-date`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    visitId,
                    appointmentDate
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update appointment date');
            }
        } catch (error) {
            console.error('Error updating appointment date:', error);
            return {
                success: false,
                message: 'Failed to update appointment date: ' + error.message
            };
        }
    }

    // Update hospital visit submission status
    async updateHospitalVisitSubmission(visitId, field, value) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/hospital-visit-submission`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    visitId,
                    field,
                    value
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update submission status');
            }
        } catch (error) {
            console.error('Error updating submission status:', error);
            return {
                success: false,
                message: 'Failed to update submission status: ' + error.message
            };
        }
    }
    // Save diet request
    async saveDietRequest(dietRequestData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/diet-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dietRequestData)
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to save diet request');
            }
        } catch (error) {
            console.error('Error saving diet request:', error);
            return {
                success: false,
                message: 'Failed to save diet request: ' + error.message
            };
        }
    }

    // Get all diet requests
    async getDietRequests() {
        console.log('🔍 getDietRequests called');
        console.log('🔧 API initialized:', this.isInitialized);
        console.log('🌐 Base URL:', this.baseURL);

        if (!this.isInitialized) {
            console.error('❌ Google Sheets API not initialized');
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const url = `${this.baseURL}/diet-requests`;
            console.log('📡 Fetching from URL:', url);

            const response = await fetch(url);
            console.log('📊 Response status:', response.status);
            console.log('📊 Response ok:', response.ok);

            const data = await response.json();
            console.log('📄 Response data:', data);

            if (response.ok) {
                console.log('✅ API call successful');
                console.log('📝 Diet requests count:', data.dietRequests ? data.dietRequests.length : 0);
                return data;
            } else {
                console.error('❌ API call failed with status:', response.status);
                throw new Error(data.message || 'Failed to get diet requests');
            }
        } catch (error) {
            console.error('💥 Exception in getDietRequests:', error);
            return {
                success: false,
                message: 'Failed to get diet requests: ' + error.message,
                dietRequests: []
            };
        }
    }

    // Delete diet requests
    async deleteDietRequests(dietRequestIds) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/diet-requests/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dietRequestIds })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to delete diet requests');
            }
        } catch (error) {
            console.error('Error deleting diet requests:', error);
            return {
                success: false,
                message: 'Failed to delete diet requests: ' + error.message
            };
        }
    }
    // Send diet request email
    async sendDietRequestEmail(dietRequestId) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/diet-request/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dietRequestId })
            });

            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to send diet request email');
            }
        } catch (error) {
            console.error('Error sending diet request email:', error);
            return {
                success: false,
                message: 'Failed to send diet request email: ' + error.message
            };
        }
    }







    // Get all patients for name search
    async getAllPatients() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/patients`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get patients');
            }
        } catch (error) {
            console.error('Error getting patients:', error);
            return {
                success: false,
                message: 'Failed to get patients: ' + error.message,
                patients: []
            };
        }
    }
    // Get system configuration
    async getSystemConfig() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            const response = await fetch(`${this.baseURL}/system-config`);
            const data = await response.json();

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to get system config');
            }
        } catch (error) {
            console.error('Error getting system config:', error);
            return {
                success: false,
                message: 'Failed to get system config: ' + error.message
            };
        }
    }

    // Update patient details in patient_database sheet
    async updatePatientDetails(patientData) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets API not initialized');
        }

        try {
            console.log('Sending patient update request:', patientData);
            console.log('Request URL:', `${this.baseURL}/update-patient`);

            const response = await fetch(`${this.baseURL}/update-patient`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(patientData)
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('Non-JSON response received:', textResponse);
                throw new Error('Server returned non-JSON response. Please check if the server is running properly.');
            }

            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok) {
                return data;
            } else {
                throw new Error(data.message || 'Failed to update patient details');
            }
        } catch (error) {
            console.error('Error updating patient details:', error);
            return {
                success: false,
                message: 'Failed to update patient details: ' + error.message
            };
        }
    }
}

// Create global instance
const googleSheetsAPI = new GoogleSheetsAPI();
