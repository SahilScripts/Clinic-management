// Configuration constants for the clinic management system
const CONFIG = {
    // Authentication - Use environment variables for security
    AUTH: {
        USERNAME: process.env.AUTH_USERNAME || 'admin',
        PASSWORD: process.env.AUTH_PASSWORD || 'password'
    },

    // Google Sheets Configuration
    GOOGLE_SHEETS: {
        SPREADSHEET_ID: '',
        
        // Patient Database for IYC lookup
        PATIENT_DATABASE: {
            WORKSHEET_NAME: 'Patient Database',
            COLUMNS: {
                NAME: 'A',
                IYC: 'B',
                PHONE: 'E',
                CATEGORY: 'G'
            }
        },

        // Blood Test Worksheet (Single Sheet Approach)
        BLOOD_TEST: {
            WORKSHEET_NAME: 'Blood_Test_Data',
            INSERT_AFTER_ROW: 2,
            COLUMNS: {
                ID: 'A',
                DATE: 'B',
                IYC: 'C',
                NAME: 'D',
                CATEGORY: 'E',
                PHONE: 'F',
                TEST_NAME: 'G',
                REFERRED_BY: 'H',
                STATUS: 'I',
                REMARKS: 'J',
                PAYMENT: 'K',
                CREATED: 'L',
                UPDATED: 'M'
            },
            STATUSES: {
                UPCOMING: 'Upcoming',
                PENDING: 'Pending',
                PENDING_REVIEW: 'Pending Review',
                COMPLETED: 'Completed',
                CANCELLED: 'Cancelled'
            }
        },

        // Ultrasound Worksheet (Single Sheet Approach)
        ULTRASOUND: {
            WORKSHEET_NAME: 'Ultrasound_Data',
            INSERT_AFTER_ROW: 2,
            COLUMNS: {
                ID: 'A',
                DATE: 'B',
                IYC: 'C',
                NAME: 'D',
                CATEGORY: 'E',
                PHONE: 'F',
                TEST_NAME: 'G',
                REFERRED_BY: 'H',
                STATUS: 'I',
                REMARKS: 'J',
                TIMING: 'K',
                CREATED: 'L',
                UPDATED: 'M',
                SCHEDULING_DOCTOR: 'N',
                PAYMENT: 'O'
            },
            STATUSES: {
                UPCOMING: 'Upcoming',
                PENDING: 'Pending',
                PENDING_REVIEW: 'Pending Review',
                COMPLETED: 'Completed',
                CANCELLED: 'Cancelled'
            }
        },

        // Hospital Visit Worksheet
        HOSPITAL_VISIT: {
            WORKSHEET_NAME: 'Hospital_Visit_Data',
            INSERT_AFTER_ROW: 2,
            COLUMNS: {
                ID: 'A',
                DATE_REQUESTED: 'B',
                IYC: 'C',
                NAME: 'D',
                PHONE: 'E',
                HOSPITAL: 'F',
                PURPOSE: 'G',
                DOCTOR: 'H',
                CREDIT_NOTE: 'I',
                BOOK_CAB: 'J',
                REMARKS: 'K',
                STATUS: 'L',
                CREATED: 'M',
                UPDATED: 'N',
                EMAIL_SENT: 'O'
            },
            STATUSES: {
                PENDING: 'Pending',
                CONFIRMED: 'Confirmed',
                POST_VISIT: 'Post Visit',
                COMPLETED: 'Completed',
                CANCELLED: 'Cancelled'
            }
        },

        // Hospital Directory
        HOSPITAL_DIRECTORY: {
            WORKSHEET_NAME: 'Hospital Directory',
            HOSPITAL_COLUMN: 'B'
        }
    },

    // Form validation rules
    VALIDATION: {
        REQUIRED_FIELDS: ['schedule', 'iycNumber', 'patientName', 'category', 'phoneNumber', 'testName', 'referredBy'],
        CONDITIONAL_REQUIRED: {
            'testDate': 'schedule === "Pending"'
        }
    },

    // Doctors list
    DOCTORS: ['Sahil', 'Ashok', 'Navneet'],

    // Date calculation for upcoming tests
    UPCOMING_TEST_DAYS: ['tuesday', 'friday'], // Days when tests are scheduled

    // API endpoints and settings
    API: {
        GOOGLE_SHEETS_BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets',
        SCOPES: ['https://www.googleapis.com/auth/spreadsheets']
    }
};

// Utility functions
const UTILS = {
    // Get next Tuesday or Friday (whichever is closer)
    getNextTestDate: function() {
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
    },

    // Format date for display
    formatDate: function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Validate form data
    validateForm: function(formData) {
        const errors = [];
        
        // Check required fields
        CONFIG.VALIDATION.REQUIRED_FIELDS.forEach(field => {
            if (!formData[field] || formData[field].trim() === '') {
                errors.push(`${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`);
            }
        });

        // Check conditional required fields
        Object.keys(CONFIG.VALIDATION.CONDITIONAL_REQUIRED).forEach(field => {
            const condition = CONFIG.VALIDATION.CONDITIONAL_REQUIRED[field];
            if (eval(condition.replace(/(\w+)/g, 'formData.$1')) && (!formData[field] || formData[field].trim() === '')) {
                errors.push(`${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required when ${condition}`);
            }
        });

        return errors;
    },

    // Show message to user
    showMessage: function(elementId, message, type = 'info') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = `form-message ${type}`;
            element.style.display = 'block';
            
            // Auto-hide success messages after 5 seconds
            if (type === 'success') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, 5000);
            }
        }
    },

    // Clear message
    clearMessage: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
            element.textContent = '';
            element.className = 'form-message';
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, UTILS };
}
