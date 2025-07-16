// Main application script
class ClinicApp {
    constructor() {
        this.currentModule = null;
        this.isInitialized = false;
    }

    // Initialize the application
    async init() {
        if (this.isInitialized) return;

        console.log('Initializing Clinic Management System...');

        // Initialize Google Sheets API first
        console.log('Initializing Google Sheets API...');
        const apiInitialized = await googleSheetsAPI.initialize();

        if (!apiInitialized) {
            console.error('Failed to initialize Google Sheets API');
            AppUtils.showNotification('Failed to connect to backend server. Some features may not work.', 'error', 10000);
        }

        // Setup navigation
        this.setupNavigation();

        // Initialize IYC uppercase conversion for all IYC fields
        this.initializeIYCUppercaseConversion();

        // Initialize modules
        this.initializeModules();

        // Set default module
        this.showModule('blood-test');

        this.isInitialized = true;
        console.log('Clinic Management System initialized successfully');
    }

    // Setup top navigation
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

        // Desktop navigation
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const module = item.getAttribute('data-module');
                this.showModule(module);
            });
        });

        // Mobile navigation
        mobileNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const module = item.getAttribute('data-module');
                this.showModule(module);
                this.closeMobileSidebar(); // Close sidebar after selection
            });
        });

        // Mobile sidebar controls
        this.setupMobileSidebar();
    }

    // Setup mobile sidebar functionality
    setupMobileSidebar() {
        const mobileNavToggle = document.getElementById('mobileNavToggle');
        const mobileSidebar = document.getElementById('mobileSidebar');
        const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
        const mobileSidebarClose = document.getElementById('mobileSidebarClose');

        // Open sidebar
        if (mobileNavToggle) {
            mobileNavToggle.addEventListener('click', () => {
                this.openMobileSidebar();
            });
        }

        // Close sidebar
        if (mobileSidebarClose) {
            mobileSidebarClose.addEventListener('click', () => {
                this.closeMobileSidebar();
            });
        }

        // Close sidebar when clicking overlay
        if (mobileSidebarOverlay) {
            mobileSidebarOverlay.addEventListener('click', () => {
                this.closeMobileSidebar();
            });
        }

        // Close sidebar on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileSidebar();
            }
        });
    }

    // Open mobile sidebar
    openMobileSidebar() {
        const mobileSidebar = document.getElementById('mobileSidebar');
        const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');

        if (mobileSidebar && mobileSidebarOverlay) {
            mobileSidebar.classList.add('active');
            mobileSidebarOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    // Close mobile sidebar
    closeMobileSidebar() {
        const mobileSidebar = document.getElementById('mobileSidebar');
        const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');

        if (mobileSidebar && mobileSidebarOverlay) {
            mobileSidebar.classList.remove('active');
            mobileSidebarOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    // Show specific module
    showModule(moduleName) {
        // Update navigation active state for desktop
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Update navigation active state for mobile
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNavItem = document.querySelector(`[data-module="${moduleName}"]`);
        const activeMobileNavItem = document.querySelector(`.mobile-nav-item[data-module="${moduleName}"]`);

        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        if (activeMobileNavItem) {
            activeMobileNavItem.classList.add('active');
        }

        // Hide all modules
        document.querySelectorAll('.module').forEach(module => {
            module.style.display = 'none';
        });

        // Show selected module
        const selectedModule = document.getElementById(`${moduleName}-module`);
        if (selectedModule) {
            selectedModule.style.display = 'block';
            this.currentModule = moduleName;
            
            // Initialize module-specific functionality
            this.initializeModuleSpecific(moduleName);
        }
    }

    // Initialize module-specific functionality
    initializeModuleSpecific(moduleName) {
        console.log('Switching to module:', moduleName);
        // Note: Modules are now initialized on startup, so this just handles module-specific switching logic
        switch (moduleName) {
            case 'blood-test':
                if (typeof bloodTestManager !== 'undefined') {
                    console.log('Blood test module already initialized');
                    // Any module-specific switching logic can go here
                } else {
                    console.error('bloodTestManager not found');
                }
                break;
            case 'ultrasound':
                if (typeof ultrasoundManager !== 'undefined') {
                    console.log('Ultrasound module already initialized');
                    // Any module-specific switching logic can go here
                } else {
                    console.error('ultrasoundManager not found');
                }
                break;
            case 'hospital-visit':
                if (typeof hospitalVisitManager !== 'undefined') {
                    console.log('Hospital visit module already initialized');
                    // Any module-specific switching logic can go here
                } else {
                    console.error('hospitalVisitManager not found');
                }
                break;
            case 'diet-request':
                if (typeof dietRequestManager !== 'undefined') {
                    console.log('Diet request module already initialized');
                    // Any module-specific switching logic can go here
                } else {
                    console.error('dietRequestManager not found');
                }
                break;
            case 'register-patient':
                if (typeof registerPatientManager !== 'undefined') {
                    console.log('Register patient module already initialized');
                    // Any module-specific switching logic can go here
                } else {
                    console.error('registerPatientManager not found');
                }
                break;

            case 'isolation':
                // Initialize isolation module when implemented
                console.log('Isolation module selected (not yet implemented)');
                break;
            case 'appointments':
                // Initialize appointments module when implemented
                console.log('Appointments module selected (not yet implemented)');
                break;
            default:
                console.warn(`Unknown module: ${moduleName}`);
        }
    }

    // Initialize all modules
    initializeModules() {
        // Initialize blood test module
        if (typeof bloodTestManager !== 'undefined') {
            console.log('Initializing blood test module on startup');
            bloodTestManager.init();
        }

        // Initialize ultrasound module
        if (typeof ultrasoundManager !== 'undefined') {
            console.log('Initializing ultrasound module on startup');
            ultrasoundManager.init();
        }

        // Initialize hospital visit module
        if (typeof hospitalVisitManager !== 'undefined') {
            console.log('Initializing hospital visit module on startup');
            hospitalVisitManager.init();
        }

        // Initialize diet request module
        if (typeof dietRequestManager !== 'undefined') {
            console.log('Initializing diet request module on startup');
            dietRequestManager.init();
        }

        // Initialize register patient module
        if (typeof registerPatientManager !== 'undefined') {
            console.log('Initializing register patient module on startup');
            registerPatientManager.init();
        }

        // Add other module initializations here as they are implemented
    }

    // Get current module
    getCurrentModule() {
        return this.currentModule;
    }

    // Check if app is initialized
    isAppInitialized() {
        return this.isInitialized;
    }

    // Initialize IYC uppercase conversion for all IYC fields
    initializeIYCUppercaseConversion() {
        console.log('Initializing IYC uppercase conversion...');

        // Function to convert input to uppercase
        const convertToUppercase = (input) => {
            const cursorPosition = input.selectionStart;
            const originalValue = input.value;
            const upperValue = originalValue.toUpperCase();

            if (originalValue !== upperValue) {
                input.value = upperValue;
                // Restore cursor position
                input.setSelectionRange(cursorPosition, cursorPosition);
            }
        };

        // Function to setup uppercase conversion for an input
        const setupUppercaseInput = (input) => {
            // Convert on input event (as user types)
            input.addEventListener('input', () => convertToUppercase(input));

            // Convert on paste event
            input.addEventListener('paste', () => {
                setTimeout(() => convertToUppercase(input), 0);
            });

            // Convert existing value if any
            if (input.value) {
                convertToUppercase(input);
            }
        };

        // Find all IYC input fields using multiple selectors
        const iycSelectors = [
            'input[id*="IYC" i]',
            'input[id*="iyc" i]',
            'input[name*="iyc" i]',
            'input[placeholder*="IYC" i]',
            '#patientIYC',
            '#iycNumber',
            '#ultrasoundIycNumber',
            '#visitIycNumber',
            '#dietIycNumber',
            '#newPatientIYC',
            '#searchPatientUpdate'
        ];

        // Apply to existing inputs
        iycSelectors.forEach(selector => {
            const inputs = document.querySelectorAll(selector);
            inputs.forEach(input => {
                console.log(`Setting up uppercase conversion for: ${input.id || input.name || selector}`);
                setupUppercaseInput(input);
            });
        });

        // Setup observer for dynamically added IYC inputs
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node itself is an IYC input
                        iycSelectors.forEach(selector => {
                            if (node.matches && node.matches(selector)) {
                                console.log(`Setting up uppercase conversion for dynamically added input: ${node.id || node.name}`);
                                setupUppercaseInput(node);
                            }
                        });

                        // Check for IYC inputs within the added node
                        iycSelectors.forEach(selector => {
                            const inputs = node.querySelectorAll ? node.querySelectorAll(selector) : [];
                            inputs.forEach(input => {
                                console.log(`Setting up uppercase conversion for nested input: ${input.id || input.name}`);
                                setupUppercaseInput(input);
                            });
                        });
                    }
                });
            });
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('IYC uppercase conversion initialized successfully');
    }
}

// Create global app instance
const clinicApp = new ClinicApp();

// Global function to initialize app (called from auth.js)
async function initializeApp() {
    await clinicApp.init();
}

// Utility functions for the application
const AppUtils = {
    // Show loading overlay
    showLoading: function(message = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>${message}</p>
                </div>
            `;
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                color: white;
                font-size: 1.2rem;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    },

    // Hide loading overlay
    hideLoading: function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },

    // Show notification
    showNotification: function(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            border-radius: 5px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = '#27ae60';
                break;
            case 'error':
                notification.style.background = '#e74c3c';
                break;
            case 'warning':
                notification.style.background = '#f39c12';
                break;
            default:
                notification.style.background = '#3498db';
        }

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    },

    // Confirm dialog
    confirm: function(message, callback) {
        if (confirm(message)) {
            callback();
        }
    },

    // Format currency
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    },

    // Format phone number
    formatPhoneNumber: function(phone) {
        // Remove all non-digits
        const cleaned = phone.replace(/\D/g, '');
        
        // Format as Indian phone number
        if (cleaned.length === 10) {
            return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
        }
        return phone;
    },

    // Validate email
    isValidEmail: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validate phone number
    isValidPhone: function(phone) {
        const phoneRegex = /^[6-9]\d{9}$/;
        return phoneRegex.test(phone.replace(/\D/g, ''));
    }
};

// Handle global errors
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    AppUtils.showNotification('An unexpected error occurred. Please refresh the page.', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    AppUtils.showNotification('A network error occurred. Please check your connection.', 'error');
});

// Initialize app when DOM is loaded (if authenticated)
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, waiting for authentication...');
});

// Global Loading Overlay Manager
class LoadingOverlay {
    constructor() {
        this.overlay = null;
        this.messageElement = null;
        this.submessageElement = null;
        this.spinnerElement = null;
    }

    // Initialize overlay elements
    init() {
        this.overlay = document.getElementById('globalLoadingOverlay');
        this.messageElement = document.getElementById('loadingMessage');
        this.submessageElement = document.getElementById('loadingSubmessage');
        this.spinnerElement = this.overlay?.querySelector('.loading-spinner i');
    }

    // Show loading overlay
    show(message = 'Updating database...', submessage = 'Please wait while we save your changes') {
        if (!this.overlay) this.init();

        if (this.messageElement) this.messageElement.textContent = message;
        if (this.submessageElement) this.submessageElement.textContent = submessage;

        // Reset classes
        this.overlay.className = 'loading-overlay';

        // Show spinner
        if (this.spinnerElement) {
            this.spinnerElement.className = 'fas fa-spinner fa-spin';
        }

        this.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Show success state
    showSuccess(message = 'Changes saved successfully!', submessage = 'Your updates have been saved to the database', autoHide = true) {
        if (!this.overlay) this.init();

        if (this.messageElement) this.messageElement.textContent = message;
        if (this.submessageElement) this.submessageElement.textContent = submessage;

        // Add success class
        this.overlay.className = 'loading-overlay success';

        // Change to checkmark icon
        if (this.spinnerElement) {
            this.spinnerElement.className = 'fas fa-check-circle';
        }

        this.overlay.style.display = 'flex';

        if (autoHide) {
            setTimeout(() => this.hide(), 2000); // Auto-hide after 2 seconds
        }
    }

    // Show error state
    showError(message = 'Update failed', submessage = 'There was an error saving your changes. Please try again.', autoHide = true) {
        if (!this.overlay) this.init();

        if (this.messageElement) this.messageElement.textContent = message;
        if (this.submessageElement) this.submessageElement.textContent = submessage;

        // Add error class
        this.overlay.className = 'loading-overlay error';

        // Change to error icon
        if (this.spinnerElement) {
            this.spinnerElement.className = 'fas fa-times-circle';
        }

        this.overlay.style.display = 'flex';

        if (autoHide) {
            setTimeout(() => this.hide(), 3000); // Auto-hide after 3 seconds
        }
    }

    // Hide overlay
    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    // Update message while loading
    updateMessage(message, submessage = null) {
        if (this.messageElement) this.messageElement.textContent = message;
        if (submessage && this.submessageElement) this.submessageElement.textContent = submessage;
    }
}

// Create global loading overlay instance
const loadingOverlay = new LoadingOverlay();

// Export for debugging
window.ClinicApp = {
    app: clinicApp,
    auth: authManager,
    bloodTest: bloodTestManager,
    ultrasound: ultrasoundManager,
    hospitalVisit: hospitalVisitManager,
    dietRequest: dietRequestManager,
    registerPatient: registerPatientManager,
    sheets: googleSheetsAPI,
    utils: AppUtils,
    config: CONFIG,
    loading: loadingOverlay
};

// Also export utilities directly to window for easier access
window.AppUtils = AppUtils;
window.loadingOverlay = loadingOverlay;
