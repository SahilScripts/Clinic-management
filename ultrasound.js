// Ultrasound module functionality
class UltrasoundManager {
    constructor() {
        this.currentSection = 'add-ultrasound';
        this.formData = {};
        this.isFormValid = false;
        this.sectionData = {
            'upcoming-ultrasound': [],
            'pending-ultrasound': [],
            'pending-review-ultrasound': [],
            'completed-ultrasound': [],
            'cancelled-ultrasound': []
        };
        this.selectedUltrasounds = {
            'upcoming-ultrasound': new Set(),
            'pending-ultrasound': new Set(),
            'pending-review-ultrasound': new Set(),
            'completed-ultrasound': new Set(),
            'cancelled-ultrasound': new Set()
        };
        this.editingCell = null;
        this.patients = [];
        this.loadingData = false;
    }

    // Initialize the ultrasound module
    init() {
        console.log('🚀 Initializing ultrasound module...');
        console.log('🔗 googleSheetsAPI.isInitialized:', typeof googleSheetsAPI !== 'undefined' ? googleSheetsAPI.isInitialized : 'googleSheetsAPI not found');

        this.setupSidebarNavigation();
        this.setupAddUltrasoundForm();
        this.setupFormValidation();
        this.setupTableInteractions();
        this.setupBulkActions();
        this.setupRefreshButtons();
        this.setupSearchFunctionality();
        this.setDefaultValues();
        this.loadSystemConfig();
        this.loadPatientData();

        // Load data for current section if not add-ultrasound
        if (this.currentSection !== 'add-ultrasound') {
            console.log('🔄 Loading initial data for section:', this.currentSection);
            this.loadSectionData(this.currentSection);
        }

        console.log('✅ Ultrasound module initialization complete');
    }

    // Setup sidebar navigation
    setupSidebarNavigation() {
        const sidebarItems = document.querySelectorAll('#ultrasound-module .sidebar-item');
        
        sidebarItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');
                this.switchSection(section);
            });
        });
    }

    // Switch between sections
    switchSection(sectionName) {
        // Update sidebar active state
        document.querySelectorAll('#ultrasound-module .sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`#ultrasound-module .sidebar-item[data-section="${sectionName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Hide all sections
        document.querySelectorAll('#ultrasound-module .section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const selectedSection = document.getElementById(`${sectionName}-section`);
        if (selectedSection) {
            selectedSection.classList.add('active');
            this.currentSection = sectionName;

            console.log(`Switched to ultrasound section: ${sectionName}`);

            // Load data for the section if it's not the add form
            if (sectionName !== 'add-ultrasound') {
                console.log(`Loading data for ultrasound section: ${sectionName}`);
                this.loadSectionData(sectionName);
            }
        }
    }

    // Setup add ultrasound form
    setupAddUltrasoundForm() {
        const form = document.getElementById('addUltrasoundForm');
        const scheduleSelect = document.getElementById('ultrasoundSchedule');
        const dateInput = document.getElementById('ultrasoundDate');
        const iycInput = document.getElementById('ultrasoundIycNumber');
        const resetBtn = document.getElementById('resetUltrasoundFormBtn');

        // Handle schedule change
        if (scheduleSelect) {
            scheduleSelect.addEventListener('change', () => {
                this.handleScheduleChange();
            });
        }

        // Handle IYC number input with debouncing
        if (iycInput) {
            let debounceTimer;
            iycInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.handleIYCLookup(iycInput.value);
                }, 500); // 500ms delay
            });
        }

        // Handle name input for search
        const nameInput = document.getElementById('ultrasoundPatientName');
        if (nameInput) {
            let searchTimer;
            nameInput.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    this.handleNameSearch(nameInput.value);
                }, 300); // 300ms delay
            });

            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!nameInput.contains(e.target)) {
                    this.hideNameDropdown();
                }
            });
        }

        // Handle category change for payment auto-population
        const categoryInput = document.getElementById('ultrasoundCategory');
        if (categoryInput) {
            categoryInput.addEventListener('change', () => {
                this.handleCategoryChange(categoryInput.value);
            });
        }

        // Handle form submission
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        // Handle reset button
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetForm();
            });
        }

        // Handle update details button
        const updateDetailsBtn = document.getElementById('updateUltrasoundDetailsBtn');
        if (updateDetailsBtn) {
            updateDetailsBtn.addEventListener('click', () => {
                this.updatePatientDetails();
            });
        }
    }

    // Setup form validation
    setupFormValidation() {
        const form = document.getElementById('addUltrasoundForm');
        if (!form) return;

        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateForm();
            });
            input.addEventListener('change', () => {
                this.validateForm();
            });
        });
    }

    // Handle schedule change - key difference from blood test
    handleScheduleChange() {
        const scheduleSelect = document.getElementById('ultrasoundSchedule');
        const dateInput = document.getElementById('ultrasoundDate');
        
        if (!scheduleSelect || !dateInput) return;

        const selectedSchedule = scheduleSelect.value;
        
        // For ultrasound: date is always optional, no auto-filling
        // This is different from blood test where upcoming tests get auto-filled dates
        dateInput.value = '';
        
        this.validateForm();
    }

    // Handle IYC lookup
    async handleIYCLookup(iycNumber) {
        const nameInput = document.getElementById('ultrasoundPatientName');
        const categoryInput = document.getElementById('ultrasoundCategory');
        const phoneInput = document.getElementById('ultrasoundPhoneNumber');
        const loadingIndicator = document.getElementById('ultrasoundIycLoading');

        if (!iycNumber || iycNumber.trim() === '') {
            // Clear fields if IYC is empty
            if (nameInput) nameInput.value = '';
            if (categoryInput) categoryInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            this.validateForm();
            return;
        }

        try {
            // Show loading indicator
            if (loadingIndicator) loadingIndicator.style.display = 'block';

            console.log('Ultrasound - About to call googleSheetsAPI.lookupPatientByIYC');
            // Lookup patient data
            const result = await googleSheetsAPI.lookupPatientByIYC(iycNumber.trim());
            console.log('Ultrasound - API result:', result);

            if (result.found) {
                // Populate fields with found data but allow manual editing
                if (nameInput) {
                    nameInput.value = result.name;
                    nameInput.readOnly = false;
                    nameInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    nameInput.placeholder = 'Auto-filled from database (editable)';
                }
                if (categoryInput) {
                    categoryInput.value = result.category;
                    categoryInput.readOnly = false;
                    categoryInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    categoryInput.placeholder = 'Auto-filled from database (editable)';

                    // Auto-populate payment based on category
                    this.handleCategoryChange(result.category);
                }
                if (phoneInput) {
                    phoneInput.value = result.phone;
                    phoneInput.readOnly = false;
                    phoneInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    phoneInput.placeholder = 'Auto-filled from database (editable)';
                }
            } else {
                // Clear fields and allow manual entry
                if (nameInput) {
                    nameInput.value = '';
                    nameInput.readOnly = false;
                    nameInput.style.backgroundColor = '';
                    nameInput.placeholder = 'Patient not found - enter manually';
                }
                if (categoryInput) {
                    categoryInput.value = '';
                    categoryInput.readOnly = false;
                    categoryInput.style.backgroundColor = '';
                    categoryInput.placeholder = 'Enter category manually';
                }
                if (phoneInput) {
                    phoneInput.value = '';
                    phoneInput.readOnly = false;
                    phoneInput.style.backgroundColor = '';
                    phoneInput.placeholder = 'Enter phone number manually';
                }
            }

        } catch (error) {
            console.error('Error looking up patient:', error);

            // Allow manual entry on error
            if (nameInput) {
                nameInput.readOnly = false;
                nameInput.style.backgroundColor = '';
                nameInput.placeholder = 'Lookup failed - enter manually';
            }
            if (categoryInput) {
                categoryInput.readOnly = false;
                categoryInput.style.backgroundColor = '';
                categoryInput.placeholder = 'Enter category manually';
            }
            if (phoneInput) {
                phoneInput.readOnly = false;
                phoneInput.style.backgroundColor = '';
                phoneInput.placeholder = 'Enter phone number manually';
            }
        } finally {
            // Hide loading indicator
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            this.validateForm();
        }
    }

    // Validate form - modified for ultrasound (date is optional)
    validateForm() {
        const form = document.getElementById('addUltrasoundForm');
        const saveBtn = document.getElementById('saveUltrasoundBtn');

        if (!form || !saveBtn) return;

        const schedule = document.getElementById('ultrasoundSchedule').value;
        const iycNumber = document.getElementById('ultrasoundIycNumber').value.trim();
        const patientName = document.getElementById('ultrasoundPatientName').value.trim();
        const category = document.getElementById('ultrasoundCategory').value.trim();
        const phoneNumber = document.getElementById('ultrasoundPhoneNumber').value.trim();
        const testName = document.getElementById('ultrasoundTestName').value.trim();
        const referredBy = document.getElementById('ultrasoundReferredBy').value;
        const payment = document.getElementById('ultrasoundPayment').value;

        // Date is optional for ultrasound - this is the key difference
        const isValid = schedule && iycNumber && patientName && category && phoneNumber && testName && referredBy && payment;

        this.isFormValid = isValid;
        saveBtn.disabled = !isValid;

        // Update visual feedback
        if (isValid) {
            saveBtn.classList.remove('disabled');
        } else {
            saveBtn.classList.add('disabled');
        }
    }

    // Handle category change for payment auto-population
    handleCategoryChange(category) {
        const paymentSelect = document.getElementById('ultrasoundPayment');

        if (!paymentSelect) return;

        // Categories that should use Credit: FTV, BR, Samaskriti (case-insensitive)
        const creditCategories = ['FTV', 'BR', 'SAMSKRITI'];
        const categoryUpper = category ? category.toUpperCase() : '';

        if (creditCategories.includes(categoryUpper)) {
            paymentSelect.value = 'Credit';
        } else if (category && category.trim() !== '') {
            // For all other non-empty categories, set to Cash
            paymentSelect.value = 'Cash';
        } else {
            // If category is empty, clear payment selection
            paymentSelect.value = '';
        }

        // Trigger validation after payment change
        this.validateForm();
    }

    // Handle form submission
    async handleFormSubmit() {
        if (!this.isFormValid) {
            UTILS.showMessage('ultrasoundFormMessage', 'Please fill in all required fields', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveUltrasoundBtn');
        const originalText = saveBtn.innerHTML;

        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            // Collect form data
            const ultrasoundData = {
                schedule: document.getElementById('ultrasoundSchedule').value,
                testDate: document.getElementById('ultrasoundDate').value || '', // Optional
                iycNumber: document.getElementById('ultrasoundIycNumber').value.trim(),
                patientName: document.getElementById('ultrasoundPatientName').value.trim(),
                category: document.getElementById('ultrasoundCategory').value.trim(),
                phoneNumber: document.getElementById('ultrasoundPhoneNumber').value.trim(),
                testName: document.getElementById('ultrasoundTestName').value.trim(),
                referredBy: document.getElementById('ultrasoundReferredBy').value,
                payment: document.getElementById('ultrasoundPayment').value
            };

            console.log('Submitting ultrasound data:', ultrasoundData);

            // Save to Google Sheets
            const result = await googleSheetsAPI.saveUltrasound(ultrasoundData);

            if (result.success) {
                UTILS.showMessage('ultrasoundFormMessage', 'Ultrasound saved successfully!', 'success');
                this.resetForm();
            } else {
                UTILS.showMessage('ultrasoundFormMessage', result.message || 'Failed to save ultrasound', 'error');
            }

        } catch (error) {
            console.error('Error saving ultrasound:', error);
            UTILS.showMessage('ultrasoundFormMessage', 'An error occurred while saving. Please try again.', 'error');
        } finally {
            // Restore button state
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    // Set default values - key difference: default to "Pending" instead of "Upcoming"
    setDefaultValues() {
        const scheduleSelect = document.getElementById('ultrasoundSchedule');
        
        if (scheduleSelect) {
            // Set default to "Pending" instead of "Upcoming"
            scheduleSelect.value = 'Pending';
            this.handleScheduleChange();
        }
    }

    // Reset form
    resetForm() {
        const form = document.getElementById('addUltrasoundForm');
        const nameInput = document.getElementById('ultrasoundPatientName');
        const categoryInput = document.getElementById('ultrasoundCategory');
        const phoneInput = document.getElementById('ultrasoundPhoneNumber');

        if (form) {
            form.reset();
        }

        // Reset field states
        [nameInput, categoryInput, phoneInput].forEach(input => {
            if (input) {
                input.readOnly = false;
                input.style.backgroundColor = '';
                input.placeholder = input.getAttribute('data-original-placeholder') || input.placeholder;
            }
        });

        // Clear messages
        UTILS.clearMessage('ultrasoundFormMessage');

        // Set default values
        this.setDefaultValues();

        // Revalidate form
        this.validateForm();
    }

    // Setup table interactions
    setupTableInteractions() {
        // Handle checkbox selection
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('ultrasound-checkbox') && e.target.closest('#ultrasound-module')) {
                this.handleUltrasoundSelection(e.target);
            } else if (e.target.classList.contains('select-all-checkbox') && e.target.closest('#ultrasound-module')) {
                this.handleSelectAll(e.target);
            }
        });



        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.action-dropdown')) {
                this.closeAllDropdowns();
            }
        });
    }

    // Setup bulk actions
    setupBulkActions() {
        // Setup action button click handlers
        const actionButtons = [
            'upcomingUltrasoundActionBtn',
            'pendingUltrasoundActionBtn',
            'reviewUltrasoundActionBtn',
            'completedUltrasoundActionBtn',
            'cancelledUltrasoundActionBtn'
        ];

        actionButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleActionDropdown(button);
                });
            }
        });

        // Setup dropdown action handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('dropdown-item') && e.target.closest('#ultrasound-module')) {
                this.handleBulkAction(e.target);
            }
        });
    }

    // Setup refresh buttons
    setupRefreshButtons() {
        const refreshButtons = [
            'refreshUpcomingUltrasoundBtn',
            'refreshPendingUltrasoundBtn',
            'refreshReviewUltrasoundBtn',
            'refreshCompletedUltrasoundBtn',
            'refreshCancelledUltrasoundBtn'
        ];

        refreshButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    const section = this.getSectionFromButtonId(buttonId);
                    this.loadSectionData(section);
                });
            }
        });
    }

    // Setup search functionality
    setupSearchFunctionality() {
        const searchInputs = [
            'searchPendingUltrasound',
            'searchUpcomingUltrasound',
            'searchReviewUltrasound',
            'searchCompletedUltrasound',
            'searchCancelledUltrasound'
        ];

        const clearButtons = [
            'clearSearchPendingUltrasound',
            'clearSearchUpcomingUltrasound',
            'clearSearchReviewUltrasound',
            'clearSearchCompletedUltrasound',
            'clearSearchCancelledUltrasound'
        ];

        // Setup search input event listeners
        searchInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            const clearBtn = document.getElementById(inputId.replace('search', 'clearSearch'));

            if (input) {
                let searchTimer;
                input.addEventListener('input', (e) => {
                    const query = e.target.value.trim();

                    // Show/hide clear button
                    if (clearBtn) {
                        if (query.length > 0) {
                            clearBtn.classList.add('visible');
                        } else {
                            clearBtn.classList.remove('visible');
                        }
                    }

                    // Debounce search
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => {
                        this.performSearch(inputId, query);
                    }, 300);
                });
            }
        });

        // Setup clear button event listeners
        clearButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    const inputId = buttonId.replace('clearSearch', 'search');
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.value = '';
                        button.classList.remove('visible');
                        this.performSearch(inputId, '');
                    }
                });
            }
        });
    }

    // Get section name from button ID
    getSectionFromButtonId(buttonId) {
        const mapping = {
            'refreshUpcomingUltrasoundBtn': 'upcoming-ultrasound',
            'refreshPendingUltrasoundBtn': 'pending-ultrasound',
            'refreshReviewUltrasoundBtn': 'pending-review-ultrasound',
            'refreshCompletedUltrasoundBtn': 'completed-ultrasound',
            'refreshCancelledUltrasoundBtn': 'cancelled-ultrasound'
        };
        return mapping[buttonId];
    }

    // Perform search functionality
    performSearch(inputId, query) {
        const sectionMapping = {
            'searchPendingUltrasound': 'pending-ultrasound',
            'searchUpcomingUltrasound': 'upcoming-ultrasound',
            'searchReviewUltrasound': 'pending-review-ultrasound',
            'searchCompletedUltrasound': 'completed-ultrasound',
            'searchCancelledUltrasound': 'cancelled-ultrasound'
        };

        const section = sectionMapping[inputId];
        if (!section) return;

        // Get all ultrasounds for this section
        const allUltrasounds = this.sectionData[section] || [];

        if (query === '') {
            // Show all ultrasounds if search is empty
            this.renderFilteredUltrasounds(section, allUltrasounds);
        } else {
            // Filter ultrasounds based on search query
            const filteredUltrasounds = this.filterUltrasounds(allUltrasounds, query);
            this.renderFilteredUltrasounds(section, filteredUltrasounds);
        }
    }

    // Filter ultrasounds based on search query
    filterUltrasounds(ultrasounds, query) {
        const searchTerm = query.toLowerCase().trim();

        return ultrasounds.filter(ultrasound => {
            // Search in name
            const name = (ultrasound.name || '').toLowerCase();
            if (name.includes(searchTerm)) return true;

            // Search in IYC number
            const iycNumber = (ultrasound.iycNumber || '').toLowerCase();
            if (iycNumber.includes(searchTerm)) return true;

            // Search in test name/type
            const testName = (ultrasound.testName || '').toLowerCase();
            if (testName.includes(searchTerm)) return true;

            // Search in category
            const category = (ultrasound.category || '').toLowerCase();
            if (category.includes(searchTerm)) return true;

            // Search in phone number
            const phone = (ultrasound.phoneNumber || '').toLowerCase();
            if (phone.includes(searchTerm)) return true;

            return false;
        });
    }

    // Render filtered ultrasounds
    renderFilteredUltrasounds(sectionName, filteredUltrasounds) {
        const tableMapping = {
            'upcoming-ultrasound': 'upcomingUltrasoundsTable',
            'pending-ultrasound': 'pendingUltrasoundsTable',
            'pending-review-ultrasound': 'reviewUltrasoundsTable',
            'completed-ultrasound': 'completedUltrasoundsTable',
            'cancelled-ultrasound': 'cancelledUltrasoundsTable'
        };

        const tableId = tableMapping[sectionName];
        const table = document.getElementById(tableId);

        if (!table) {
            console.error(`Table not found: ${tableId}`);
            return;
        }

        const tbody = table.querySelector('tbody');

        // Clear existing rows
        tbody.innerHTML = '';

        if (filteredUltrasounds.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">No matching ultrasounds found</td>
                </tr>
            `;
            return;
        }

        // Render filtered ultrasound rows
        filteredUltrasounds.forEach(ultrasound => {
            const row = this.createUltrasoundRow(ultrasound);
            tbody.appendChild(row);
        });

        // Update section controls for filtered results
        this.updateSectionControls(sectionName);

        console.log(`Rendered ${filteredUltrasounds.length} filtered ultrasounds for ${sectionName}`);
    }

    // Clear search for a specific section
    clearSearch(sectionName) {
        const searchInputMapping = {
            'pending-ultrasound': 'searchPendingUltrasound',
            'upcoming-ultrasound': 'searchUpcomingUltrasound',
            'pending-review-ultrasound': 'searchReviewUltrasound',
            'completed-ultrasound': 'searchCompletedUltrasound',
            'cancelled-ultrasound': 'searchCancelledUltrasound'
        };

        const clearButtonMapping = {
            'pending-ultrasound': 'clearSearchPendingUltrasound',
            'upcoming-ultrasound': 'clearSearchUpcomingUltrasound',
            'pending-review-ultrasound': 'clearSearchReviewUltrasound',
            'completed-ultrasound': 'clearSearchCompletedUltrasound',
            'cancelled-ultrasound': 'clearSearchCancelledUltrasound'
        };

        const searchInputId = searchInputMapping[sectionName];
        const clearButtonId = clearButtonMapping[sectionName];

        if (searchInputId) {
            const searchInput = document.getElementById(searchInputId);
            if (searchInput) {
                searchInput.value = '';
            }
        }

        if (clearButtonId) {
            const clearButton = document.getElementById(clearButtonId);
            if (clearButton) {
                clearButton.classList.remove('visible');
            }
        }
    }

    // Load section data
    async loadSectionData(sectionName) {
        console.log(`🔄 Loading data for ultrasound section: ${sectionName}`);
        console.log(`🔄 googleSheetsAPI.isInitialized: ${googleSheetsAPI.isInitialized}`);

        this.showSectionLoading(sectionName, true);

        try {
            // Map section names to status values
            const statusMapping = {
                'upcoming-ultrasound': 'Upcoming',
                'pending-ultrasound': 'Pending',
                'pending-review-ultrasound': 'Pending Review',
                'completed-ultrasound': 'Completed',
                'cancelled-ultrasound': 'Cancelled'
            };

            const status = statusMapping[sectionName];

            if (!status) {
                console.error(`Unknown section: ${sectionName}`);
                this.showSectionMessage(sectionName, 'Unknown section', 'error');
            } else {
                const result = await googleSheetsAPI.getUltrasounds(status);
                console.log(`Ultrasounds result for ${sectionName} (status: ${status}):`, result);
                if (result.success) {
                    this.sectionData[sectionName] = result.ultrasounds;
                    this.renderSectionTable(sectionName);
                    this.updateSectionControls(sectionName);
                // Clear search when data is refreshed
                this.clearSearch(sectionName);
                } else {
                    this.showSectionMessage(sectionName, 'Failed to load data: ' + result.message, 'error');
                }
            }
        } catch (error) {
            console.error(`Error loading ${sectionName} data:`, error);
            this.showSectionMessage(sectionName, 'Failed to load data. Please try again.', 'error');
        } finally {
            this.showSectionLoading(sectionName, false);
        }
    }

    // Show section loading state
    showSectionLoading(sectionName, isLoading) {
        const messageMapping = {
            'upcoming-ultrasound': 'upcomingUltrasoundMessage',
            'pending-ultrasound': 'pendingUltrasoundMessage',
            'pending-review-ultrasound': 'reviewUltrasoundMessage',
            'completed-ultrasound': 'completedUltrasoundMessage',
            'cancelled-ultrasound': 'cancelledUltrasoundMessage'
        };

        const messageElement = document.getElementById(messageMapping[sectionName]);
        if (messageElement) {
            if (isLoading) {
                messageElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                messageElement.className = 'section-message loading';
                messageElement.style.display = 'block';
            } else {
                messageElement.style.display = 'none';
            }
        }
    }

    // Show section message
    showSectionMessage(sectionName, message, type = 'info') {
        const messageMapping = {
            'upcoming-ultrasound': 'upcomingUltrasoundMessage',
            'pending-ultrasound': 'pendingUltrasoundMessage',
            'pending-review-ultrasound': 'reviewUltrasoundMessage',
            'completed-ultrasound': 'completedUltrasoundMessage',
            'cancelled-ultrasound': 'cancelledUltrasoundMessage'
        };

        const messageElement = document.getElementById(messageMapping[sectionName]);
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `section-message ${type}`;
            messageElement.style.display = 'block';

            // Auto-hide success messages
            if (type === 'success') {
                setTimeout(() => {
                    messageElement.style.display = 'none';
                }, 5000);
            }
        }
    }

    // Render section table
    renderSectionTable(sectionName) {
        console.log(`Rendering table for ${sectionName}`, this.sectionData[sectionName]);

        const tableMapping = {
            'upcoming-ultrasound': 'upcomingUltrasoundsTable',
            'pending-ultrasound': 'pendingUltrasoundsTable',
            'pending-review-ultrasound': 'reviewUltrasoundsTable',
            'completed-ultrasound': 'completedUltrasoundsTable',
            'cancelled-ultrasound': 'cancelledUltrasoundsTable'
        };

        const tableId = tableMapping[sectionName];
        const table = document.getElementById(tableId);
        console.log(`Table element for ${tableId}:`, table);
        if (!table) {
            console.error(`Table not found: ${tableId}`);
            return;
        }

        const tbody = table.querySelector('tbody');
        const ultrasounds = this.sectionData[sectionName];

        // Clear existing rows
        tbody.innerHTML = '';

        if (ultrasounds.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">No ${sectionName.replace('-', ' ')} found</td>
                </tr>
            `;
            return;
        }

        // Render ultrasound rows
        ultrasounds.forEach(ultrasound => {
            const row = this.createUltrasoundRow(ultrasound);
            tbody.appendChild(row);
        });

        console.log(`Rendered ${ultrasounds.length} rows for ${sectionName}`);
    }

    // Create an ultrasound row element
    createUltrasoundRow(ultrasound) {
        const row = document.createElement('tr');
        row.setAttribute('data-ultrasound-id', ultrasound.id);
        row.setAttribute('data-row-index', ultrasound.rowIndex);

        // Different column structures for different sections
        if (this.currentSection === 'pending-ultrasound') {
            // Pending ultrasounds: Category, Name, Ultrasound Type, Details
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="ultrasound-checkbox" data-ultrasound-id="${ultrasound.id}">
                </td>
                <td>${ultrasound.category || ''}</td>
                <td>${ultrasound.name}</td>
                <td>${ultrasound.testName}</td>
                <td>
                    <button class="btn-icon" onclick="ultrasoundManager.viewUltrasoundDetails('${ultrasound.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="ultrasoundManager.editUltrasoundDetails('${ultrasound.id}')" title="Edit Ultrasound">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else if (this.currentSection === 'pending-review-ultrasound') {
            // Pending review ultrasounds: Date, Name, Phone, Ultrasound Type, Details
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="ultrasound-checkbox" data-ultrasound-id="${ultrasound.id}">
                </td>
                <td>${ultrasound.date || ''}</td>
                <td>${ultrasound.name}</td>
                <td>${ultrasound.phone || ''}</td>
                <td>${ultrasound.testName}</td>
                <td>
                    <button class="btn-icon" onclick="ultrasoundManager.viewUltrasoundDetails('${ultrasound.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="ultrasoundManager.editUltrasoundDetails('${ultrasound.id}')" title="Edit Ultrasound">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else if (this.currentSection === 'completed-ultrasound' || this.currentSection === 'cancelled-ultrasound') {
            // Completed and cancelled ultrasounds: Date, Name, Ultrasound Type, Details
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="ultrasound-checkbox" data-ultrasound-id="${ultrasound.id}">
                </td>
                <td>${ultrasound.date || ''}</td>
                <td>${ultrasound.name}</td>
                <td>${ultrasound.testName}</td>
                <td>
                    <button class="btn-icon" onclick="ultrasoundManager.viewUltrasoundDetails('${ultrasound.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="ultrasoundManager.editUltrasoundDetails('${ultrasound.id}')" title="Edit Ultrasound">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else if (this.currentSection === 'upcoming-ultrasound') {
            // Upcoming ultrasounds: Timing, Name, Phone, Ultrasound Type, Details
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="ultrasound-checkbox" data-ultrasound-id="${ultrasound.id}">
                </td>
                <td>${ultrasound.timing || ''}</td>
                <td>${ultrasound.name}</td>
                <td>${ultrasound.phone || ''}</td>
                <td>${ultrasound.testName}</td>
                <td>
                    <button class="btn-icon" onclick="ultrasoundManager.viewUltrasoundDetails('${ultrasound.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="ultrasoundManager.editUltrasoundDetails('${ultrasound.id}')" title="Edit Ultrasound">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else {
            // Other sections: Timing, Name, Ultrasound Type, Details
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="ultrasound-checkbox" data-ultrasound-id="${ultrasound.id}">
                </td>
                <td>${ultrasound.timing || ''}</td>
                <td>${ultrasound.name}</td>
                <td>${ultrasound.testName}</td>
                <td>
                    <button class="btn-icon" onclick="ultrasoundManager.viewUltrasoundDetails('${ultrasound.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="ultrasoundManager.editUltrasoundDetails('${ultrasound.id}')" title="Edit Ultrasound">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        }

        return row;
    }

    // Update section controls
    updateSectionControls(sectionName) {
        const selectedCount = this.selectedUltrasounds[sectionName].size;

        // Update action button state
        const actionBtnMapping = {
            'upcoming-ultrasound': 'upcomingUltrasoundActionBtn',
            'pending-ultrasound': 'pendingUltrasoundActionBtn',
            'pending-review-ultrasound': 'reviewUltrasoundActionBtn',
            'completed-ultrasound': 'completedUltrasoundActionBtn',
            'cancelled-ultrasound': 'cancelledUltrasoundActionBtn'
        };

        const actionBtn = document.getElementById(actionBtnMapping[sectionName]);
        if (actionBtn) {
            actionBtn.disabled = selectedCount === 0;
            actionBtn.textContent = selectedCount > 0 ?
                `Actions (${selectedCount})` : 'Actions';
        }

        // Update select all checkbox state
        this.updateSelectAllState(sectionName);
    }



    // Find ultrasound by ID
    findUltrasoundById(ultrasoundId) {
        const ultrasounds = this.sectionData[this.currentSection];
        return ultrasounds.find(ultrasound => ultrasound.id.toString() === ultrasoundId.toString());
    }

    // Handle ultrasound selection
    handleUltrasoundSelection(checkbox) {
        const ultrasoundId = checkbox.getAttribute('data-ultrasound-id');
        const section = this.currentSection;

        if (checkbox.checked) {
            this.selectedUltrasounds[section].add(ultrasoundId);
        } else {
            this.selectedUltrasounds[section].delete(ultrasoundId);
        }

        this.updateSectionControls(section);
        this.updateSelectAllState(section);
    }

    // Handle select all
    handleSelectAll(selectAllCheckbox) {
        const section = this.currentSection;
        const isChecked = selectAllCheckbox.checked;
        const ultrasoundCheckboxes = document.querySelectorAll(`#${section}-section .ultrasound-checkbox`);

        ultrasoundCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const ultrasoundId = checkbox.getAttribute('data-ultrasound-id');

            if (isChecked) {
                this.selectedUltrasounds[section].add(ultrasoundId);
            } else {
                this.selectedUltrasounds[section].delete(ultrasoundId);
            }
        });

        this.updateSectionControls(section);
    }

    // Update select all state
    updateSelectAllState(sectionName) {
        const selectAllId = this.getSelectAllId(sectionName);
        const selectAllCheckbox = document.getElementById(selectAllId);

        if (selectAllCheckbox) {
            const ultrasoundCheckboxes = document.querySelectorAll(`#${sectionName}-section .ultrasound-checkbox`);
            const checkedCount = document.querySelectorAll(`#${sectionName}-section .ultrasound-checkbox:checked`).length;

            selectAllCheckbox.checked = ultrasoundCheckboxes.length > 0 && checkedCount === ultrasoundCheckboxes.length;
            selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < ultrasoundCheckboxes.length;
        }
    }

    // Get select all checkbox ID
    getSelectAllId(sectionName) {
        const mapping = {
            'pending-ultrasound': 'selectAllPendingUltrasound',
            'upcoming-ultrasound': 'selectAllUpcomingUltrasound',
            'pending-review-ultrasound': 'selectAllReviewUltrasound',
            'completed-ultrasound': 'selectAllCompletedUltrasound',
            'cancelled-ultrasound': 'selectAllCancelledUltrasound'
        };
        return mapping[sectionName];
    }



    // Toggle action dropdown
    toggleActionDropdown(button) {
        const dropdown = button.nextElementSibling;
        const isOpen = dropdown.style.display === 'block';

        // Close all dropdowns first
        this.closeAllDropdowns();

        // Toggle current dropdown
        if (!isOpen) {
            dropdown.style.display = 'block';
        }
    }

    // Close all dropdowns
    closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('#ultrasound-module .dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }

    // Handle bulk action
    async handleBulkAction(actionItem) {
        const action = actionItem.getAttribute('data-action');
        const selectedUltrasoundIds = Array.from(this.selectedUltrasounds[this.currentSection]);

        if (selectedUltrasoundIds.length === 0) {
            this.showSectionMessage(this.currentSection, 'No ultrasounds selected', 'warning');
            return;
        }

        // Close dropdown
        this.closeAllDropdowns();

        // Special handling for moving pending ultrasounds to upcoming - show scheduling dialog
        if (action === 'upcoming' && this.currentSection === 'pending-ultrasound') {
            this.showSchedulingDialog(selectedUltrasoundIds);
            return;
        }

        // Confirm action for other actions
        const actionText = actionItem.textContent.trim();
        if (!confirm(`Are you sure you want to ${actionText.toLowerCase()} ${selectedUltrasoundIds.length} ultrasound(s)?`)) {
            return;
        }

        try {
            this.showSectionLoading(this.currentSection, true);

            if (action === 'delete') {
                await this.deleteSelectedUltrasounds();
            } else {
                await this.moveSelectedUltrasounds(action);
            }

            // Clear selections
            this.selectedUltrasounds[this.currentSection].clear();

            // Reload data
            await this.loadSectionData(this.currentSection);

            this.showSectionMessage(this.currentSection, `Successfully ${actionText.toLowerCase()} ${selectedUltrasoundIds.length} ultrasound(s)`, 'success');

        } catch (error) {
            console.error('Error performing bulk action:', error);
            this.showSectionMessage(this.currentSection, 'Failed to perform action: ' + error.message, 'error');
        } finally {
            this.showSectionLoading(this.currentSection, false);
        }
    }

    // Move selected ultrasounds (updates status)
    async moveSelectedUltrasounds(action) {
        const selectedUltrasoundIds = Array.from(this.selectedUltrasounds[this.currentSection]);

        // Determine new status
        const statusMapping = {
            'test-done': 'Pending Review',
            'postpone': 'Pending',
            'cancelled': 'Cancelled',
            'upcoming': 'Upcoming',
            'completed': 'Completed'
        };

        const newStatus = statusMapping[action];
        if (!newStatus) {
            throw new Error('Invalid action: ' + action);
        }

        // Get row indices for selected ultrasounds
        const rowIndices = selectedUltrasoundIds.map(ultrasoundId => {
            const ultrasound = this.findUltrasoundById(ultrasoundId);
            return ultrasound ? ultrasound.rowIndex : null;
        }).filter(index => index !== null);

        // Update ultrasound status via API
        const result = await googleSheetsAPI.updateUltrasoundStatus(selectedUltrasoundIds, newStatus, rowIndices);

        if (!result.success) {
            throw new Error(result.message || 'Failed to update ultrasound status');
        }
    }

    // Delete selected ultrasounds
    async deleteSelectedUltrasounds() {
        const selectedUltrasoundIds = Array.from(this.selectedUltrasounds[this.currentSection]);

        // Get row indices for selected ultrasounds
        const rowIndices = selectedUltrasoundIds.map(ultrasoundId => {
            const ultrasound = this.findUltrasoundById(ultrasoundId);
            return ultrasound ? ultrasound.rowIndex : null;
        }).filter(index => index !== null);

        // Delete ultrasounds via API
        const result = await googleSheetsAPI.deleteUltrasounds(rowIndices);

        if (!result.success) {
            throw new Error(result.message || 'Failed to delete ultrasounds');
        }
    }

    // Show scheduling dialog for moving pending ultrasounds to upcoming
    showSchedulingDialog(selectedUltrasoundIds) {
        const selectedUltrasounds = selectedUltrasoundIds.map(id => this.findUltrasoundById(id)).filter(u => u);

        if (selectedUltrasounds.length === 0) {
            this.showSectionMessage(this.currentSection, 'No valid ultrasounds selected', 'error');
            return;
        }

        // Create modal HTML
        const modalHtml = `
            <style>
                .time-input-group {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .time-input-group select {
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .time-input-group span {
                    font-weight: bold;
                    font-size: 16px;
                }
            </style>
            <div id="ultrasoundSchedulingModal" class="modal" style="display: flex;">
                <div class="modal-content" style="max-width: 800px; width: 90%;">
                    <div class="modal-header">
                        <h3>Schedule Ultrasound Appointments</h3>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="scheduling-info">
                            <h4>Selected Ultrasounds:</h4>
                            <div class="selected-ultrasounds-table">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>IYC</th>
                                            <th>Test Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${selectedUltrasounds.map(ultrasound => `
                                            <tr>
                                                <td>${ultrasound.name}</td>
                                                <td>${ultrasound.iycNumber}</td>
                                                <td>${ultrasound.testName}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="scheduling-form">
                            <h4>Scheduling Details:</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="schedulingDate">Date <span class="required">*</span></label>
                                    <input type="date" id="schedulingDate" required>
                                </div>
                                <div class="form-group">
                                    <label for="startTiming">Start Time <span class="required">*</span></label>
                                    <div class="time-input-group">
                                        <select id="startHour" required>
                                            <option value="">Hour</option>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3">3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                            <option value="6">6</option>
                                            <option value="7">7</option>
                                            <option value="8">8</option>
                                            <option value="9">9</option>
                                            <option value="10">10</option>
                                            <option value="11">11</option>
                                            <option value="12">12</option>
                                        </select>
                                        <span>:</span>
                                        <select id="startMinute" required>
                                            <option value="">Min</option>
                                            <option value="00">00</option>
                                            <option value="15">15</option>
                                            <option value="30">30</option>
                                            <option value="45">45</option>
                                        </select>
                                        <select id="startPeriod" required>
                                            <option value="">AM/PM</option>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="testDuration">Test Duration (minutes) <span class="required">*</span></label>
                                    <input type="number" id="testDuration" min="1" max="300" value="30" required>
                                </div>
                                <div class="form-group">
                                    <label for="ultrasoundDoctor">Doctor <span class="required">*</span></label>
                                    <select id="ultrasoundDoctor" required>
                                        <option value="">Select Doctor</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="ultrasoundManager.closeSchedulingModal()">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="ultrasoundManager.confirmScheduling()">Schedule Appointments</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = document.getElementById('ultrasoundSchedulingModal');
        modal.style.display = 'flex';

        // Load doctor options from system config
        // Add a small delay to ensure the modal is fully rendered
        setTimeout(() => {
            this.loadDoctorOptions();
        }, 100);

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('schedulingDate').value = today;

        // Set default time to 9:00 AM
        document.getElementById('startHour').value = '9';
        document.getElementById('startMinute').value = '00';
        document.getElementById('startPeriod').value = 'AM';

        // Store selected ultrasounds for later use
        this.schedulingUltrasounds = selectedUltrasounds;

        // Add event listeners
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSchedulingModal();
            }
        });

        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            this.closeSchedulingModal();
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeSchedulingModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // Load system configuration
    async loadSystemConfig() {
        try {
            console.log('🔧 Loading system configuration for ultrasound...');
            const result = await googleSheetsAPI.getSystemConfig();

            console.log('🔧 System config API result:', result);

            if (result.success) {
                console.log('✅ System config loaded successfully');
                console.log('🔧 Raw result.data:', result.data);

                // Update referred by dropdown
                this.updateReferredByDropdown(result.data.referredBy);

                // Store config for later use
                this.systemConfig = result.data;
                console.log('🔧 Stored system config in this.systemConfig:', this.systemConfig);
                console.log('🔧 ultrasound_doctor field:', this.systemConfig.ultrasound_doctor);
                console.log('🔧 referredBy field:', this.systemConfig.referredBy);
            } else {
                console.error('❌ Failed to load system config:', result.message);
            }
        } catch (error) {
            console.error('❌ Error loading system config:', error);
        }
    }

    // Update referred by dropdown with data from system config
    updateReferredByDropdown(referredByList) {
        const referredBySelect = document.getElementById('ultrasoundReferredBy');
        if (!referredBySelect || !Array.isArray(referredByList)) return;

        // Clear existing options except the first one
        while (referredBySelect.children.length > 1) {
            referredBySelect.removeChild(referredBySelect.lastChild);
        }

        // Add new options from system config
        referredByList.forEach(doctor => {
            const option = document.createElement('option');
            option.value = doctor;
            option.textContent = doctor;
            referredBySelect.appendChild(option);
        });

        console.log(`Updated referred by dropdown with ${referredByList.length} options`);
    }

    // Update patient details from form
    updatePatientDetails() {
        // Get current form data
        const formData = {
            iycNumber: document.getElementById('ultrasoundIycNumber')?.value || '',
            patientName: document.getElementById('ultrasoundPatientName')?.value || '',
            email: document.getElementById('ultrasoundEmail')?.value || '',
            phoneNumber: document.getElementById('ultrasoundPhoneNumber')?.value || ''
        };

        console.log('Ultrasound - Form data for update modal:', formData);
        this.showUpdateDetailsModal(formData);
    }

    // Show update details modal
    showUpdateDetailsModal(formData) {
        // Create modal HTML with editable patient fields
        const modalHtml = `
            <div id="ultrasoundUpdateDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Update Patient Details</h3>
                        <span class="modal-close" onclick="ultrasoundManager.closeUpdateDetailsModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <input type="text" class="readonly-field" value="${formData.iycNumber || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Name: <span class="required">*</span></label>
                                <input type="text" id="updatePatientName" value="${formData.patientName || ''}" required>
                            </div>
                            <div class="detail-item">
                                <label>Email:</label>
                                <input type="email" id="updatePatientEmail" value="${formData.email || ''}">
                            </div>
                            <div class="detail-item">
                                <label>Phone: <span class="required">*</span></label>
                                <input type="tel" id="updatePatientPhone" value="${formData.phoneNumber || ''}" required>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" onclick="ultrasoundManager.savePatientDetails()">Save Changes</button>
                        <button type="button" class="btn-secondary" onclick="ultrasoundManager.closeUpdateDetailsModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('ultrasoundUpdateDetailsModal');
        modal.style.display = 'flex';

        // Add event listener for clicking outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeUpdateDetailsModal();
            }
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeUpdateDetailsModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // Close update details modal
    closeUpdateDetailsModal() {
        const modal = document.getElementById('ultrasoundUpdateDetailsModal');
        if (modal) {
            modal.remove();
        }
    }

    // Save patient details
    async savePatientDetails() {
        try {
            // Get form values from modal
            const name = document.getElementById('updatePatientName').value.trim();
            const email = document.getElementById('updatePatientEmail').value.trim();
            const phone = document.getElementById('updatePatientPhone').value.trim();
            const iycNumber = document.querySelector('#ultrasoundUpdateDetailsModal .readonly-field').value.trim();

            // Validate required fields
            if (!name || !phone) {
                alert('Please fill in all required fields (Name, Phone)');
                return;
            }

            // Validate email format if email is provided
            if (email && email.trim() !== '') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    alert('Please enter a valid email address');
                    return;
                }
            }

            // Show loading overlay
            loadingOverlay.show('Updating patient details...', 'Please wait while we save your changes to the database');

            // Prepare patient data for update
            const patientData = {
                iycNumber: iycNumber,
                name: name,
                phone: phone
            };

            // Only include email if it's provided
            if (email && email.trim() !== '') {
                patientData.email = email;
            }

            // Update patient in database
            const result = await googleSheetsAPI.updatePatientDetails(patientData);

            if (result && result.success) {
                // Show success overlay
                loadingOverlay.showSuccess('Patient details updated successfully!', 'Your changes have been saved to the database');

                // Update the form fields with the new values
                const nameInput = document.getElementById('ultrasoundPatientName');
                const emailInput = document.getElementById('ultrasoundEmail');
                const phoneInput = document.getElementById('ultrasoundPhoneNumber');

                if (nameInput) nameInput.value = name;
                if (emailInput) emailInput.value = email;
                if (phoneInput) phoneInput.value = phone;

                this.showMessage('ultrasoundFormMessage', 'Patient details updated successfully!', 'success');
                this.closeUpdateDetailsModal();

                // Refresh the records table if we're on that section
                if (this.currentSection !== 'new-ultrasound') {
                    this.loadSectionData(this.currentSection);
                }
            } else {
                const errorMessage = result ? (result.message || 'Failed to update patient details') : 'No response from server';
                loadingOverlay.showError('Update failed', errorMessage);
                this.showMessage('ultrasoundFormMessage', errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error updating patient details:', error);
            let errorMessage = 'An error occurred while updating patient details';

            // Provide more specific error messages
            if (error.message && error.message.includes('Doctype')) {
                errorMessage = 'Server error: Please make sure the backend server is running and accessible';
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }

            loadingOverlay.showError('Update failed', errorMessage);
            this.showMessage('ultrasoundFormMessage', errorMessage, 'error');
        }
    }

    // Show message
    showMessage(elementId, message, type) {
        const messageElement = document.getElementById(elementId);
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `form-message ${type}`;

            if (message) {
                setTimeout(() => {
                    messageElement.textContent = '';
                    messageElement.className = 'form-message';
                }, 5000);
            }
        }
    }

    // Send Message functionality (placeholder for WhatsApp API integration)
    async sendMessage(sectionName) {
        console.log(`Ultrasound - Send Message clicked for section: ${sectionName}`);

        try {
            // Get selected ultrasounds from the current section
            const selectedUltrasoundIds = Array.from(this.selectedUltrasounds[sectionName]);
            const sectionData = this.sectionData[sectionName];

            if (selectedUltrasoundIds.length === 0) {
                this.showSectionMessage(sectionName, 'Please select at least one ultrasound to send messages', 'warning');
                return;
            }

            // Collect patient data for selected ultrasounds
            const selectedUltrasounds = selectedUltrasoundIds.map(ultrasoundId => {
                return sectionData.find(ultrasound => ultrasound.id.toString() === ultrasoundId.toString());
            }).filter(ultrasound => ultrasound !== undefined);

            console.log('Ultrasound - Selected ultrasounds for messaging:', selectedUltrasounds);

            // Prepare message data structure for future WhatsApp API integration
            const messageData = {
                module: 'ultrasound',
                section: sectionName,
                recipients: selectedUltrasounds.map(ultrasound => ({
                    name: ultrasound.name,
                    phone: ultrasound.phone,
                    iycNumber: ultrasound.iycNumber,
                    testName: ultrasound.testName,
                    date: ultrasound.date,
                    referredBy: ultrasound.referredBy
                })),
                messageTemplate: this.getMessageTemplate(sectionName),
                timestamp: new Date().toISOString()
            };

            console.log('Ultrasound - Message data prepared:', messageData);

            // TODO: Replace this placeholder with actual WhatsApp API call
            // Example: await whatsappAPI.sendBulkMessages(messageData);

            // Placeholder success message
            this.showSectionMessage(
                sectionName,
                `Message sending prepared for ${selectedUltrasounds.length} patient(s). WhatsApp API integration pending.`,
                'info'
            );

            // Log for future development
            console.log('Ultrasound - WhatsApp API integration point - messageData ready:', messageData);

        } catch (error) {
            console.error('Ultrasound - Error in sendMessage:', error);
            this.showSectionMessage(sectionName, 'Error preparing message data: ' + error.message, 'error');
        }
    }

    // Get message template based on section (placeholder for future customization)
    getMessageTemplate(sectionName) {
        const templates = {
            'upcoming-ultrasound': {
                subject: 'Ultrasound Appointment Reminder',
                body: 'Dear {name}, this is a reminder for your upcoming ultrasound ({testName}) scheduled for {date}. Please arrive 15 minutes early. Referred by: {referredBy}. IYC: {iycNumber}'
            },
            'pending-review-ultrasound': {
                subject: 'Ultrasound Results Ready',
                body: 'Dear {name}, your ultrasound results ({testName}) are ready for review. Please contact us to schedule a consultation. Referred by: {referredBy}. IYC: {iycNumber}'
            }
        };

        return templates[sectionName] || {
            subject: 'Ultrasound Update',
            body: 'Dear {name}, we have an update regarding your ultrasound ({testName}). Please contact us for more information. IYC: {iycNumber}'
        };
    }

    // Download upcoming ultrasounds as PDF
    async downloadUpcomingUltrasoundsPDF() {
        try {
            const downloadBtn = document.getElementById('downloadUpcomingUltrasoundBtn');

            // Show loading state
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';

            // Get upcoming ultrasounds data
            const upcomingUltrasounds = this.sectionData['upcoming-ultrasound'] || [];

            if (upcomingUltrasounds.length === 0) {
                alert('No upcoming ultrasounds found to download.');
                return;
            }

            // Filter and prepare data for PDF with formatted test names
            const pdfData = upcomingUltrasounds.map(ultrasound => {
                // Format test name with proper line breaks
                let formattedTestName = ultrasound.testName || '';

                // Add line breaks for better formatting
                formattedTestName = formattedTestName
                    .replace(/;\s*/g, ';\n')  // Line break after semicolons
                    .replace(/,\s*(?=[A-Z])/g, ',\n')  // Line break after commas before capital letters
                    .replace(/\s*-\s*/g, '\n- ')  // Line break before dashes
                    .replace(/\(\s*([^)]+)\s*\)/g, '\n($1)')  // Put parentheses content on new line
                    .replace(/\n+/g, '\n')  // Remove multiple consecutive line breaks
                    .trim();

                return {
                    name: ultrasound.name || '',
                    testName: formattedTestName,
                    timing: ultrasound.timing || '',
                    payment: ultrasound.payment || ''
                };
            });

            // Generate PDF
            this.generateUltrasoundsPDF(pdfData, 'Upcoming Ultrasounds');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            // Restore button state
            const downloadBtn = document.getElementById('downloadUpcomingUltrasoundBtn');
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download PDF';
            }
        }
    }

    // Generate PDF with ultrasound data in landscape orientation with minimal borders
    generateUltrasoundsPDF(ultrasoundData, title) {
        // Initialize jsPDF in landscape orientation
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // Set to landscape orientation

        // Set title
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(title, 10, 15); // Reduced top margin

        // Add date
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const currentDate = new Date().toLocaleDateString('en-IN');
        doc.text(`Generated on: ${currentDate}`, 10, 25); // Reduced margin

        // Define table columns for ultrasounds (removed Age/Gender, Email, Phone)
        const columns = [
            { header: 'Name', dataKey: 'name' },
            { header: 'Ultrasound Type', dataKey: 'testName' },
            { header: 'Timing', dataKey: 'timing' },
            { header: 'Payment', dataKey: 'payment' }
        ];

        // Generate table using autoTable plugin with equal column widths and text wrapping
        doc.autoTable({
            columns: columns,
            body: ultrasoundData,
            startY: 35,
            styles: {
                fontSize: 8, // Reduced font size to fit more content
                cellPadding: 1.5,
                overflow: 'linebreak', // Enable text wrapping for all cells
                halign: 'left',
                lineColor: [255, 255, 255], // White lines (invisible borders)
                lineWidth: 0 // No border lines
            },
            headStyles: {
                fillColor: [102, 126, 234], // Blue header
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 8,
                lineColor: [255, 255, 255], // White lines for header
                lineWidth: 0 // No border lines for header
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245] // Light gray for alternate rows
            },
            columnStyles: {
                name: {
                    cellWidth: 60, // Optimized for A4 landscape
                    overflow: 'linebreak'
                },
                testName: {
                    cellWidth: 120, // Adequate space for wrapped test names on A4
                    overflow: 'linebreak' // Ensure test names wrap properly
                },
                timing: {
                    cellWidth: 50, // Optimized for A4 landscape
                    overflow: 'linebreak'
                },
                payment: {
                    cellWidth: 40, // Optimized for A4 landscape
                    overflow: 'linebreak'
                }
            },
            margin: { top: 35, left: 10, right: 10, bottom: 5 }, // Standard A4 margins
            tableWidth: 'wrap', // Use wrap to ensure all columns fit on A4
            theme: 'plain' // Remove all default styling and borders
        });

        // Save the PDF
        const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    }

    // View ultrasound details
    viewUltrasoundDetails(ultrasoundId) {
        const ultrasound = this.findUltrasoundById(ultrasoundId);
        if (ultrasound) {
            this.showUltrasoundDetailsModal(ultrasound);
        }
    }

    // Show ultrasound details modal
    showUltrasoundDetailsModal(ultrasound) {
        // Create modal HTML
        const modalHtml = `
            <div id="ultrasoundDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Ultrasound Details</h3>
                        <span class="modal-close" onclick="ultrasoundManager.closeDetailsModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>Name:</label>
                                <span>${ultrasound.name}</span>
                            </div>
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <span>${ultrasound.iycNumber || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Phone:</label>
                                <span>${ultrasound.phone || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Category:</label>
                                <span>${ultrasound.category || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Date:</label>
                                <span>${ultrasound.date || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Timing:</label>
                                <span>${ultrasound.timing || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Ultrasound Type:</label>
                                <span>${ultrasound.testName || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Referred By:</label>
                                <span>${ultrasound.referredBy || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Payment:</label>
                                <span>${ultrasound.payment || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Scheduling Doctor:</label>
                                <span>${ultrasound.schedulingDoctor || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Status:</label>
                                <span>${ultrasound.status || 'N/A'}</span>
                            </div>
                            <div class="detail-item full-width">
                                <label>Remarks:</label>
                                <span>${ultrasound.remarks || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="ultrasoundManager.closeDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('ultrasoundDetailsModal');
        modal.style.display = 'flex';

        // Add event listener for clicking outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeDetailsModal();
            }
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeDetailsModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // Close details modal
    closeDetailsModal() {
        const modal = document.getElementById('ultrasoundDetailsModal');
        if (modal) {
            modal.remove();
        }
    }

    // Edit ultrasound details
    editUltrasoundDetails(ultrasoundId) {
        const ultrasound = this.findUltrasoundById(ultrasoundId);
        if (ultrasound) {
            this.showEditUltrasoundModal(ultrasound);
        }
    }

    // Show edit ultrasound modal
    showEditUltrasoundModal(ultrasound) {
        // Create modal HTML with editable test type, timing and date fields
        const modalHtml = `
            <div id="editUltrasoundModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Ultrasound</h3>
                        <span class="modal-close" onclick="ultrasoundManager.closeEditUltrasoundModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <input type="text" class="readonly-field" value="${ultrasound.iycNumber || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Name:</label>
                                <input type="text" class="readonly-field" value="${ultrasound.name || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Category:</label>
                                <input type="text" class="readonly-field" value="${ultrasound.category || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Test Type: <span class="required">*</span></label>
                                <input type="text" id="editUltrasoundTestType" value="${ultrasound.testName || ''}" required>
                            </div>
                            <div class="detail-item">
                                <label>Date:</label>
                                <input type="date" id="editUltrasoundDate" value="${ultrasound.date || ''}">
                            </div>
                            <div class="detail-item">
                                <label>Timing:</label>
                                <input type="text" id="editUltrasoundTiming" value="${ultrasound.timing || ''}" placeholder="e.g., 10:00 AM - 10:30 AM">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" onclick="ultrasoundManager.saveEditedUltrasound('${ultrasound.id}')">Save Changes</button>
                        <button type="button" class="btn-secondary" onclick="ultrasoundManager.closeEditUltrasoundModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('editUltrasoundModal');
        modal.style.display = 'flex';

        // Add event listener for clicking outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEditUltrasoundModal();
            }
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeEditUltrasoundModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // Close edit ultrasound modal
    closeEditUltrasoundModal() {
        const modal = document.getElementById('editUltrasoundModal');
        if (modal) {
            modal.remove();
        }
    }

    // Save edited ultrasound
    async saveEditedUltrasound(ultrasoundId) {
        try {
            // Get form values from modal
            const testType = document.getElementById('editUltrasoundTestType').value.trim();
            const date = document.getElementById('editUltrasoundDate').value.trim();
            const timing = document.getElementById('editUltrasoundTiming').value.trim();

            // Validate required fields
            if (!testType) {
                alert('Please fill in the required field (Test Type)');
                return;
            }

            // Show loading overlay
            loadingOverlay.show('Updating ultrasound details...', 'Please wait while we save your changes');

            // Find the ultrasound to get its row index
            const ultrasound = this.findUltrasoundById(ultrasoundId);
            if (!ultrasound) {
                throw new Error('Ultrasound not found');
            }

            // Prepare ultrasound data for update
            const ultrasoundData = {
                id: ultrasoundId,
                rowIndex: ultrasound.rowIndex,
                testName: testType,
                date: date,
                timing: timing
            };

            // Update ultrasound via API
            const result = await googleSheetsAPI.updateUltrasoundDetails(ultrasoundData);

            if (result && result.success) {
                // Show success overlay
                loadingOverlay.showSuccess('Ultrasound details updated successfully!', 'Your changes have been saved');

                // Close the modal
                this.closeEditUltrasoundModal();

                // Reload the current section data to reflect changes
                await this.loadSectionData(this.currentSection);

            } else {
                throw new Error(result?.message || 'Failed to update ultrasound details');
            }

        } catch (error) {
            console.error('Error updating ultrasound details:', error);
            loadingOverlay.showError('Failed to update ultrasound details', error.message || 'Please try again');
        }
    }

    // Load doctor options for scheduling dialog
    loadDoctorOptions() {
        console.log('=== loadDoctorOptions called ===');
        const doctorSelect = document.getElementById('ultrasoundDoctor');
        if (!doctorSelect) {
            console.error('Doctor select element not found - ID: ultrasoundDoctor');
            // Let's check if the modal exists
            const modal = document.getElementById('ultrasoundSchedulingModal');
            console.log('Modal exists:', !!modal);
            if (modal) {
                console.log('Modal HTML:', modal.innerHTML.substring(0, 500));
            }
            return;
        }

        console.log('Doctor select element found:', doctorSelect);

        // Clear existing options except the first one
        doctorSelect.innerHTML = '<option value="">Select Doctor</option>';

        console.log('=== System Config Debug ===');
        console.log('Full systemConfig object:', this.systemConfig);
        console.log('systemConfig keys:', this.systemConfig ? Object.keys(this.systemConfig) : 'null');

        if (this.systemConfig) {
            console.log('ultrasound_doctor value:', this.systemConfig.ultrasound_doctor);
            console.log('ultrasound_doctor type:', typeof this.systemConfig.ultrasound_doctor);
            console.log('referredBy value:', this.systemConfig.referredBy);
            console.log('referredBy type:', typeof this.systemConfig.referredBy);
        }

        let doctorsList = [];

        // Try multiple sources for doctor list
        if (this.systemConfig) {
            // First try ultrasound_doctor field
            if (this.systemConfig.ultrasound_doctor && this.systemConfig.ultrasound_doctor.trim()) {
                console.log('✓ Using ultrasound_doctor from system config:', this.systemConfig.ultrasound_doctor);
                try {
                    doctorsList = JSON.parse(this.systemConfig.ultrasound_doctor);
                    if (!Array.isArray(doctorsList)) {
                        doctorsList = this.systemConfig.ultrasound_doctor.split(',').map(d => d.trim()).filter(d => d);
                    }
                    console.log('✓ Parsed ultrasound_doctor as:', doctorsList);
                } catch (e) {
                    console.log('JSON parse failed, using comma split');
                    doctorsList = this.systemConfig.ultrasound_doctor.split(',').map(d => d.trim()).filter(d => d);
                    console.log('✓ Split ultrasound_doctor as:', doctorsList);
                }
            }
            // Fallback to referredBy field
            else if (this.systemConfig.referredBy) {
                console.log('→ Falling back to referredBy from system config:', this.systemConfig.referredBy);
                if (Array.isArray(this.systemConfig.referredBy)) {
                    doctorsList = [...this.systemConfig.referredBy];
                    console.log('✓ Used referredBy array:', doctorsList);
                } else if (typeof this.systemConfig.referredBy === 'string') {
                    try {
                        const parsed = JSON.parse(this.systemConfig.referredBy);
                        doctorsList = Array.isArray(parsed) ? parsed : this.systemConfig.referredBy.split(',').map(d => d.trim()).filter(d => d);
                        console.log('✓ Parsed referredBy as:', doctorsList);
                    } catch (e) {
                        doctorsList = this.systemConfig.referredBy.split(',').map(d => d.trim()).filter(d => d);
                        console.log('✓ Split referredBy as:', doctorsList);
                    }
                }
            } else {
                console.log('→ No ultrasound_doctor or referredBy found in system config');
            }
        } else {
            console.log('→ No system config available');
        }

        // Final fallback to CONFIG.DOCTORS
        if (!doctorsList || doctorsList.length === 0) {
            console.log('→ Using CONFIG.DOCTORS fallback:', CONFIG.DOCTORS);
            doctorsList = CONFIG.DOCTORS || ['Sahil', 'Ashok', 'Navneet'];
        }

        console.log('=== Final doctors list ===', doctorsList);

        // Add doctor options
        if (Array.isArray(doctorsList) && doctorsList.length > 0) {
            doctorsList.forEach((doctor, index) => {
                if (doctor && typeof doctor === 'string' && doctor.trim()) {
                    const option = document.createElement('option');
                    option.value = doctor.trim();
                    option.textContent = doctor.trim();
                    doctorSelect.appendChild(option);
                    console.log(`Added option ${index + 1}: "${doctor.trim()}"`);
                }
            });
            console.log(`✓ Successfully added ${doctorsList.length} doctor options to dropdown`);
            console.log('Final dropdown HTML:', doctorSelect.innerHTML);
        } else {
            // Emergency fallback - add some default doctors
            console.warn('⚠ No doctors found, adding emergency default doctors');
            const defaultDoctors = ['Sahil', 'Ashok', 'Navneet'];
            defaultDoctors.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor;
                option.textContent = doctor;
                doctorSelect.appendChild(option);
                console.log(`Added emergency option: "${doctor}"`);
            });
        }

        console.log('=== loadDoctorOptions completed ===');
    }

    // Close scheduling modal
    closeSchedulingModal() {
        const modal = document.getElementById('ultrasoundSchedulingModal');
        if (modal) {
            modal.remove();
        }
        this.schedulingUltrasounds = null;
    }

    // Confirm scheduling and move ultrasounds to upcoming
    async confirmScheduling() {
        const date = document.getElementById('schedulingDate').value;
        const hour = document.getElementById('startHour').value;
        const minute = document.getElementById('startMinute').value;
        const period = document.getElementById('startPeriod').value;
        const duration = parseInt(document.getElementById('testDuration').value);
        const doctor = document.getElementById('ultrasoundDoctor').value;

        // Validate inputs
        if (!date || !hour || !minute || !period || !duration || !doctor) {
            alert('Please fill in all required fields');
            return;
        }

        // Convert to 24-hour format for internal processing
        let hour24 = parseInt(hour);
        if (period === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (period === 'AM' && hour24 === 12) {
            hour24 = 0;
        }

        // Create time string in HH:MM format for processing
        const startTime = `${hour24.toString().padStart(2, '0')}:${minute}`;

        if (duration < 1 || duration > 300) {
            alert('Test duration must be between 1 and 300 minutes');
            return;
        }

        try {
            // Calculate timing for each ultrasound
            const scheduledUltrasounds = this.calculateUltrasoundTimings(startTime, duration);

            // Update ultrasounds with scheduling information
            await this.scheduleUltrasounds(scheduledUltrasounds, date, doctor);

            // Close modal
            this.closeSchedulingModal();

            // Clear selections
            this.selectedUltrasounds[this.currentSection].clear();

            // Reload data
            await this.loadSectionData(this.currentSection);

            this.showSectionMessage(this.currentSection, `Successfully scheduled ${scheduledUltrasounds.length} ultrasound(s)`, 'success');

        } catch (error) {
            console.error('Error scheduling ultrasounds:', error);
            alert('Failed to schedule ultrasounds: ' + error.message);
        }
    }

    // Calculate timing for each ultrasound based on start time and duration
    calculateUltrasoundTimings(startTime, duration) {
        const scheduledUltrasounds = [];
        let currentTime = this.parseTime(startTime);

        this.schedulingUltrasounds.forEach((ultrasound) => {
            const timing = this.formatTime(currentTime);
            scheduledUltrasounds.push({
                ...ultrasound,
                timing: timing
            });

            // Add duration for next appointment
            currentTime = this.addMinutes(currentTime, duration);
        });

        return scheduledUltrasounds;
    }

    // Parse time string to minutes (expects HH:MM in 24-hour format)
    parseTime(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Add minutes to time
    addMinutes(timeInMinutes, minutesToAdd) {
        return timeInMinutes + minutesToAdd;
    }

    // Format time from minutes to HH:MM AM/PM
    formatTime(timeInMinutes) {
        const hours = Math.floor(timeInMinutes / 60);
        const minutes = timeInMinutes % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);

        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    // Schedule ultrasounds with timing information
    async scheduleUltrasounds(scheduledUltrasounds, date, doctor) {
        // Update each ultrasound with new status, date, doctor, and timing
        for (const ultrasound of scheduledUltrasounds) {
            const ultrasoundData = {
                date: date,
                iycNumber: ultrasound.iycNumber,
                name: ultrasound.name,
                category: ultrasound.category,
                phone: ultrasound.phone,
                testName: ultrasound.testName,
                referredBy: ultrasound.referredBy, // Keep original referred by
                schedulingDoctor: doctor, // Use selected doctor for scheduling
                status: 'Upcoming',
                remarks: ultrasound.remarks,
                timing: ultrasound.timing // Add timing information
            };

            const result = await googleSheetsAPI.updateUltrasound(ultrasound.rowIndex, ultrasoundData);
            if (!result.success) {
                throw new Error(`Failed to update ultrasound for ${ultrasound.name}: ${result.message}`);
            }
        }
    }

    // Load patient data for name search
    async loadPatientData() {
        try {
            console.log('Ultrasound - Loading patient data...');
            const result = await googleSheetsAPI.getAllPatients();

            if (result && result.success) {
                this.patients = result.patients || [];
                console.log('Ultrasound - Patient data loaded successfully:', this.patients.length, 'patients');
            } else {
                console.error('Ultrasound - Failed to load patient data');
                this.patients = [];
            }
        } catch (error) {
            console.error('Ultrasound - Error loading patient data:', error);
            this.patients = [];
        }
    }

    // Handle name search
    handleNameSearch(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '' || searchTerm.length < 2) {
            this.hideNameDropdown();
            return;
        }

        const filteredPatients = this.patients.filter(patient =>
            patient.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredPatients.length > 0) {
            this.showNameDropdown(filteredPatients);
        } else {
            this.hideNameDropdown();
        }
    }

    // Show name search dropdown
    showNameDropdown(patients) {
        const dropdown = document.getElementById('ultrasoundNameSearchDropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '';

        patients.slice(0, 10).forEach(patient => { // Limit to 10 results
            const item = document.createElement('div');
            item.className = 'search-dropdown-item';
            item.textContent = `${patient.name} (${patient.iycNumber})`;
            item.addEventListener('click', () => {
                this.selectPatient(patient);
            });
            dropdown.appendChild(item);
        });

        dropdown.style.display = 'block';
    }

    // Hide name search dropdown
    hideNameDropdown() {
        const dropdown = document.getElementById('ultrasoundNameSearchDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    // Select patient from dropdown
    selectPatient(patient) {
        const iycInput = document.getElementById('ultrasoundIycNumber');
        const nameInput = document.getElementById('ultrasoundPatientName');
        const categoryInput = document.getElementById('ultrasoundCategory');
        const phoneInput = document.getElementById('ultrasoundPhoneNumber');

        if (iycInput) iycInput.value = patient.iycNumber;
        if (nameInput) {
            nameInput.value = patient.name;
            nameInput.style.backgroundColor = '#e8f5e8';
        }
        if (categoryInput) {
            categoryInput.value = patient.category || '';
            categoryInput.style.backgroundColor = '#e8f5e8';

            // Auto-populate payment based on category
            this.handleCategoryChange(patient.category || '');
        }
        if (phoneInput) {
            phoneInput.value = patient.phone || '';
            phoneInput.style.backgroundColor = '#e8f5e8';
        }

        this.hideNameDropdown();
        this.validateForm();
    }
}

// Create global ultrasound manager instance
const ultrasoundManager = new UltrasoundManager();

// Test function for debugging
window.testUltrasoundAPI = async function() {
    console.log('Testing Ultrasound API...');
    console.log('googleSheetsAPI.isInitialized:', googleSheetsAPI.isInitialized);

    try {
        const result = await googleSheetsAPI.lookupPatientByIYC('TEST001');
        console.log('API test result:', result);
        return result;
    } catch (error) {
        console.error('API test error:', error);
        return error;
    }
};

// Test function for system config
window.testUltrasoundSystemConfig = async function() {
    console.log('Testing Ultrasound System Config...');
    try {
        const result = await googleSheetsAPI.getSystemConfig();
        console.log('System config result:', result);
        if (ultrasoundManager.systemConfig) {
            console.log('Current stored system config:', ultrasoundManager.systemConfig);
        }
        return result;
    } catch (error) {
        console.error('System config test error:', error);
        return error;
    }
};

// Test function for doctor options
window.testDoctorOptions = function() {
    console.log('Testing Doctor Options...');
    console.log('Current system config:', ultrasoundManager.systemConfig);
    ultrasoundManager.loadDoctorOptions();
};

// Test function for select-all functionality
window.testSelectAll = function() {
    console.log('🧪 Testing select-all functionality...');
    console.log('Current section:', ultrasoundManager.currentSection);
    console.log('Selected ultrasounds:', ultrasoundManager.selectedUltrasounds);

    // Test each select-all checkbox
    const checkboxes = [
        'selectAllPendingUltrasound',
        'selectAllUpcomingUltrasound',
        'selectAllReviewUltrasound',
        'selectAllCompletedUltrasound',
        'selectAllCancelledUltrasound'
    ];

    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        console.log(`Checkbox ${id}:`, checkbox ? 'found' : 'not found');
    });
};

// Force reload system config and test doctor options
window.forceReloadSystemConfig = async function() {
    console.log('🔄 Force reloading system config...');
    await ultrasoundManager.loadSystemConfig();
    console.log('🔄 Testing doctor options after reload...');
    ultrasoundManager.loadDoctorOptions();
};

// Test scheduling dialog
window.testSchedulingDialog = function() {
    console.log('🧪 Testing scheduling dialog...');
    // Create a fake selected ultrasound for testing
    const fakeUltrasound = {
        id: 'TEST001',
        name: 'Test Patient',
        iycNumber: 'IYC001',
        testName: 'Test Ultrasound',
        rowIndex: 1
    };
    ultrasoundManager.schedulingUltrasounds = [fakeUltrasound];
    ultrasoundManager.showSchedulingDialog(['TEST001']);
};

// Test function for ultrasound data loading
window.testUltrasoundDataLoading = async function() {
    console.log('🧪 Testing Ultrasound Data Loading...');

    try {
        // Test pending ultrasounds
        console.log('📋 Testing Pending Ultrasounds...');
        const pendingResult = await googleSheetsAPI.getUltrasounds('Pending');
        console.log('Pending ultrasounds result:', pendingResult);

        // Test upcoming ultrasounds
        console.log('📅 Testing Upcoming Ultrasounds...');
        const upcomingResult = await googleSheetsAPI.getUltrasounds('Upcoming');
        console.log('Upcoming ultrasounds result:', upcomingResult);

        // Test manual section loading
        console.log('🔄 Testing Manual Section Loading...');
        if (typeof ultrasoundManager !== 'undefined') {
            await ultrasoundManager.loadSectionData('pending-ultrasound');
            console.log('Manual pending section load completed');

            await ultrasoundManager.loadSectionData('upcoming-ultrasound');
            console.log('Manual upcoming section load completed');
        }

        return {
            pending: pendingResult,
            upcoming: upcomingResult
        };
    } catch (error) {
        console.error('❌ Ultrasound data loading test error:', error);
        return error;
    }
};
