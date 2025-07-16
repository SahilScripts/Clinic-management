// Authentication module for the clinic management system
class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
    }

    // Initialize authentication
    init() {
        // Check if user is already logged in (from session storage)
        const savedAuth = sessionStorage.getItem('clinic_auth');
        if (savedAuth) {
            try {
                const authData = JSON.parse(savedAuth);
                if (authData.isAuthenticated && authData.timestamp) {
                    // Check if session is still valid (24 hours)
                    const now = new Date().getTime();
                    const sessionAge = now - authData.timestamp;
                    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                    if (sessionAge < maxAge) {
                        this.isAuthenticated = true;
                        this.currentUser = authData.user;
                        this.showMainApp();
                        return;
                    }
                }
            } catch (error) {
                console.error('Error parsing saved auth data:', error);
            }
        }

        // Show login page if not authenticated
        this.showLoginPage();
        this.setupLoginForm();
    }

    // Setup login form event listeners
    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorDiv = document.getElementById('loginError');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(usernameInput.value, passwordInput.value, errorDiv);
            });
        }

        // Clear error message when user starts typing
        [usernameInput, passwordInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    if (errorDiv) {
                        errorDiv.textContent = '';
                    }
                });
            }
        });

        // Focus on username field
        if (usernameInput) {
            usernameInput.focus();
        }
    }

    // Handle login attempt
    async handleLogin(username, password, errorDiv) {
        try {
            // Clear any previous error messages
            if (errorDiv) {
                errorDiv.textContent = '';
            }

            // Validate credentials
            if (await this.validateCredentials(username, password)) {
                // Set authentication state
                this.isAuthenticated = true;
                this.currentUser = {
                    username: username,
                    loginTime: new Date().toISOString()
                };

                // Save authentication state to session storage
                this.saveAuthState();

                // Initialize Google Sheets API
                const initialized = await googleSheetsAPI.initialize();
                if (!initialized) {
                    throw new Error('Failed to initialize Google Sheets API');
                }

                // Show main application
                this.showMainApp();

                // Show success message briefly
                this.showLoginSuccess();

            } else {
                // Show error message
                if (errorDiv) {
                    errorDiv.textContent = 'Invalid username or password';
                }
                
                // Clear password field
                const passwordInput = document.getElementById('password');
                if (passwordInput) {
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Login failed. Please try again.';
            }
        }
    }

    // Validate user credentials
    async validateCredentials(username, password) {
        try {
            console.log('Attempting to validate credentials...');

            // Try to get credentials from system config with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const systemConfigResponse = await fetch('/api/system-config/auth', {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (systemConfigResponse.ok) {
                const authData = await systemConfigResponse.json();
                if (authData.success && authData.data.username && authData.data.password) {
                    console.log('Using credentials from System Config worksheet');
                    return username === authData.data.username && password === authData.data.password;
                }
            }

            // Fallback to config file if system config fails
            console.warn('System Config authentication failed, using fallback credentials from config file');
            return username === CONFIG.AUTH.USERNAME && password === CONFIG.AUTH.PASSWORD;

        } catch (error) {
            console.error('Error validating credentials:', error);
            console.warn('Using fallback authentication from config file due to error');
            // Fallback to config file
            return username === CONFIG.AUTH.USERNAME && password === CONFIG.AUTH.PASSWORD;
        }
    }

    // Save authentication state to session storage
    saveAuthState() {
        const authData = {
            isAuthenticated: this.isAuthenticated,
            user: this.currentUser,
            timestamp: new Date().getTime()
        };
        
        sessionStorage.setItem('clinic_auth', JSON.stringify(authData));
    }

    // Clear authentication state
    clearAuthState() {
        this.isAuthenticated = false;
        this.currentUser = null;
        sessionStorage.removeItem('clinic_auth');
    }

    // Show login page
    showLoginPage() {
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');

        if (loginPage) {
            loginPage.style.display = 'flex';
        }
        if (mainApp) {
            mainApp.style.display = 'none';
        }
    }

    // Show main application
    showMainApp() {
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');

        if (loginPage) {
            loginPage.style.display = 'none';
        }
        if (mainApp) {
            mainApp.style.display = 'block';
        }

        // Initialize the main application
        if (typeof initializeApp === 'function') {
            initializeApp().catch(error => {
                console.error('Failed to initialize application:', error);
            });
        }
    }

    // Show login success message
    showLoginSuccess() {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'login-success';
        successDiv.textContent = 'Login successful! Loading application...';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 1rem 2rem;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: 500;
        `;

        document.body.appendChild(successDiv);

        // Remove the message after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    // Handle logout
    logout() {
        // Clear authentication state
        this.clearAuthState();

        // Show login page
        this.showLoginPage();

        // Reset form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.reset();
        }

        // Clear any error messages
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = '';
        }

        // Focus on username field
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }

        console.log('User logged out successfully');
    }

    // Check if user is authenticated
    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }

    // Setup logout functionality
    setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    this.logout();
                }
            });
        }
    }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    authManager.init();
    authManager.setupLogout();
});
