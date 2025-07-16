// Blood Test module functionality
class BloodTestManager {
    constructor() {
        this.currentSection = 'add-test';
        this.formData = {};
        this.isFormValid = false;
        this.sectionData = {
            'upcoming-test': [],
            'pending-test': [],
            'pending-review': [],
            'completed': [],
            'cancelled-test': []
        };
        this.selectedTests = {
            'upcoming-test': new Set(),
            'pending-test': new Set(),
            'pending-review': new Set(),
            'completed': new Set(),
            'cancelled-test': new Set()
        };
        this.editingCell = null;
        this.patients = [];
        this.loadingData = false;
        this.isAutoFilling = false; // Flag to prevent name search during auto-fill
        this.priceList = [];
    }

    // Initialize the blood test module
    init() {
        this.setupSidebarNavigation();
        this.setupAddTestForm();
        this.setupFormValidation();
        this.setupTableInteractions();
        this.setupBulkActions();
        this.loadPatientData();
        this.setupRefreshButtons();
        this.setupSearchFunctionality();
        this.setDefaultValues();
        this.loadSystemConfig();

        // Load data for current section if not add-test
        if (this.currentSection !== 'add-test') {
            this.loadSectionData(this.currentSection);
        }
    }

    // Setup sidebar navigation
    setupSidebarNavigation() {
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        
        sidebarItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');
                this.switchSection(section);
            });
        });
    }

    // Switch between different sections
    switchSection(sectionName) {
        // Update sidebar active state
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content area
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');

        this.currentSection = sectionName;

        // Load data for the new section (except add-test)
        if (sectionName !== 'add-test') {
            this.loadSectionData(sectionName);
        }


    }

    // Setup add test form
    async setupAddTestForm() {
        const form = document.getElementById('addTestForm');
        const scheduleSelect = document.getElementById('schedule');
        const iycInput = document.getElementById('iycNumber');
        const resetBtn = document.getElementById('resetFormBtn');
        const testNameSelect = document.getElementById('testName');
        const testPriceInput = document.getElementById('testPrice');
        const testNameDropdown = document.getElementById('testNameSearchDropdown');

        // Fetch and store price list for autocomplete
        this.priceList = [];
        try {
            const response = await fetch('/api/blood-test-prices');
            const data = await response.json();
            if (data.success && Array.isArray(data.priceList)) {
                this.priceList = data.priceList;
            }
        } catch (err) {
            console.error('Failed to fetch blood test price list:', err);
        }

        // Initialize test tags functionality
        this.selectedTestTags = [];
        this.setupTestTagsInput();

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
        const nameInput = document.getElementById('bloodTestPatientName');
        if (nameInput) {
            let searchTimer;
            nameInput.addEventListener('input', () => {
                // Skip name search if we're currently auto-filling from IYC lookup
                if (this.isAutoFilling) {
                    return;
                }

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
        const categoryInput = document.getElementById('category');
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
        const updateDetailsBtn = document.getElementById('updateBloodTestDetailsBtn');
        if (updateDetailsBtn) {
            updateDetailsBtn.addEventListener('click', () => {
                this.updatePatientDetails();
            });
        }
    }

    // Setup test tags input functionality
    setupTestTagsInput() {
        const testNameInput = document.getElementById('testNameInput');
        const testTagsInput = document.getElementById('testTagsInput');
        const selectedTestTags = document.getElementById('selectedTestTags');
        const hiddenTestName = document.getElementById('testName');
        const testPriceInput = document.getElementById('testPrice');
        const testNameDropdown = document.getElementById('testNameSearchDropdown');

        if (!testNameInput || !testTagsInput || !selectedTestTags || !hiddenTestName) return;

        let estimationTimeout;

        // Handle input events
        testNameInput.addEventListener('input', () => {
            const value = testNameInput.value.trim().toLowerCase();
            if (!value) {
                testNameDropdown.style.display = 'none';
                return;
            }

            // Clear previous timeout
            if (estimationTimeout) {
                clearTimeout(estimationTimeout);
            }

            // Filter priceList for matches
            const matches = this.priceList.filter(item =>
                item.testName.toLowerCase().includes(value) ||
                (item.serviceCode && item.serviceCode.toLowerCase().includes(value))
            );

            if (matches.length === 0) {
                testNameDropdown.style.display = 'none';
            } else {
                // Build dropdown
                testNameDropdown.innerHTML = matches.map(item =>
                    `<div class="dropdown-item" data-name="${item.testName.replace(/"/g, '&quot;')}" data-price="${item.price}">
                        ${item.testName} <span style='color:#888;'>(${item.serviceCode})</span>
                    </div>`
                ).join('');
                testNameDropdown.style.display = 'block';
            }
        });

        // Handle Enter key to add test tag
        testNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const testName = testNameInput.value.trim();
                if (testName) {
                    this.addTestTag(testName);
                    testNameInput.value = '';
                    testNameDropdown.style.display = 'none';
                }
            }
        });

        // Handle dropdown item clicks
        testNameDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (item) {
                const testName = item.getAttribute('data-name');
                this.addTestTag(testName);
                testNameInput.value = '';
                testNameDropdown.style.display = 'none';
            }
        });

        // Handle clicking on the container to focus input
        testTagsInput.addEventListener('click', () => {
            testNameInput.focus();
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!testTagsInput.contains(e.target) && !testNameDropdown.contains(e.target)) {
                testNameDropdown.style.display = 'none';
            }
        });
    }

    // Add a test tag
    addTestTag(testName) {
        if (!testName || this.selectedTestTags.includes(testName)) return;

        this.selectedTestTags.push(testName);
        this.renderTestTags();
        this.updateHiddenTestNameField();
        this.estimateTestPrice(this.selectedTestTags.join(', '));
    }

    // Remove a test tag
    removeTestTag(testName) {
        this.selectedTestTags = this.selectedTestTags.filter(tag => tag !== testName);
        this.renderTestTags();
        this.updateHiddenTestNameField();

        if (this.selectedTestTags.length > 0) {
            this.estimateTestPrice(this.selectedTestTags.join(', '));
        } else {
            this.hideEstimatedPrice();
            const testPriceInput = document.getElementById('testPrice');
            if (testPriceInput) {
                testPriceInput.value = '';
            }
        }
    }

    // Render test tags in the UI
    renderTestTags() {
        const selectedTestTags = document.getElementById('selectedTestTags');
        if (!selectedTestTags) return;

        selectedTestTags.innerHTML = this.selectedTestTags.map(testName =>
            `<div class="test-tag">
                ${testName}
                <span class="remove-tag" onclick="bloodTestManager.removeTestTag('${testName.replace(/'/g, "\\'")}')">×</span>
            </div>`
        ).join('');
    }

    // Update hidden field for form submission
    updateHiddenTestNameField() {
        const hiddenTestName = document.getElementById('testName');
        if (hiddenTestName) {
            hiddenTestName.value = this.selectedTestTags.join(', ');
        }
        this.validateForm();
    }

    // Setup form validation
    setupFormValidation() {
        const form = document.getElementById('addTestForm');
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

    // Set default values
    setDefaultValues() {
        const scheduleSelect = document.getElementById('schedule');
        if (scheduleSelect) {
            scheduleSelect.value = 'Upcoming';
            this.handleScheduleChange();
        }
    }

    // Handle schedule change
    handleScheduleChange() {
        const scheduleSelect = document.getElementById('schedule');
        const dateInput = document.getElementById('testDate');
        const dateLabel = document.querySelector('label[for="testDate"] .conditional');

        if (!scheduleSelect || !dateInput) return;

        const schedule = scheduleSelect.value;

        if (schedule === 'Upcoming') {
            // Auto-fill with next test date
            dateInput.value = UTILS.getNextTestDate();
            dateInput.readOnly = true;
            dateInput.style.backgroundColor = '#f8f9fa';
            if (dateLabel) dateLabel.style.display = 'none';
        } else if (schedule === 'Pending') {
            // Allow manual date selection for pending tests
            dateInput.value = '';
            dateInput.readOnly = false;
            dateInput.style.backgroundColor = '';
            if (dateLabel) dateLabel.style.display = 'inline';
        } else if (schedule === 'Pending Review' || schedule === 'Completed') {
            // Use today's date for completed/review tests
            dateInput.value = new Date().toISOString().split('T')[0];
            dateInput.readOnly = true;
            dateInput.style.backgroundColor = '#f8f9fa';
            if (dateLabel) dateLabel.style.display = 'none';
        } else {
            // Clear date if no schedule selected
            dateInput.value = '';
            dateInput.readOnly = false;
            dateInput.style.backgroundColor = '';
            if (dateLabel) dateLabel.style.display = 'none';
        }

        this.validateForm();
    }

    // Handle IYC number lookup
    async handleIYCLookup(iycNumber) {
        console.log('Blood Test - handleIYCLookup called with:', iycNumber);
        console.log('Blood Test - googleSheetsAPI.isInitialized:', googleSheetsAPI.isInitialized);

        const loadingIndicator = document.getElementById('iycLoading');
        const nameInput = document.getElementById('bloodTestPatientName');
        const categoryInput = document.getElementById('category');
        const phoneInput = document.getElementById('phoneNumber');

        console.log('Blood Test - Form elements found:', {
            loadingIndicator: !!loadingIndicator,
            nameInput: !!nameInput,
            categoryInput: !!categoryInput,
            phoneInput: !!phoneInput
        });

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

            // Set auto-filling flag to prevent name search interference
            this.isAutoFilling = true;

            console.log('Blood Test - About to call googleSheetsAPI.lookupPatientByIYC');
            // Lookup patient data
            const result = await googleSheetsAPI.lookupPatientByIYC(iycNumber.trim());
            console.log('Blood Test - API result:', result);

            if (result.found) {
                console.log('Blood Test - Patient found, result data:', {
                    name: result.name,
                    category: result.category,
                    phone: result.phone
                });

                // Populate fields with found data but allow manual editing
                if (nameInput) {
                    console.log('Blood Test - Setting name field value to:', result.name);
                    console.log('Blood Test - Name input element:', nameInput);
                    nameInput.value = result.name;
                    nameInput.readOnly = false;
                    nameInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    nameInput.placeholder = 'Auto-filled from database (editable)';
                    console.log('Blood Test - Name field value after setting:', nameInput.value);
                } else {
                    console.error('Blood Test - Name input element not found!');
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
                console.log('Blood Test - Patient not found, clearing fields');
                // Clear fields and allow manual entry
                if (nameInput) {
                    console.log('Blood Test - Clearing name field');
                    nameInput.value = '';
                    nameInput.readOnly = false;
                    nameInput.style.backgroundColor = '';
                    nameInput.placeholder = 'Patient not found - enter manually';
                } else {
                    console.error('Blood Test - Name input element not found when clearing!');
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

            // Clear auto-filling flag
            this.isAutoFilling = false;

            this.validateForm();
        }
    }

    // Handle category change for payment auto-population
    handleCategoryChange(category) {
        const paymentSelect = document.getElementById('payment');

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



    // Validate form
    validateForm() {
        const form = document.getElementById('addTestForm');
        const saveBtn = document.getElementById('saveTestBtn');
        
        if (!form || !saveBtn) return;

        // Collect form data
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value.trim();
        }

        // Validate using utility function
        const errors = UTILS.validateForm(data);
        
        // Update form validity
        this.isFormValid = errors.length === 0;
        saveBtn.disabled = !this.isFormValid;

        // Store form data
        this.formData = data;

        return this.isFormValid;
    }

    // Handle form submission
    async handleFormSubmit() {
        if (!this.validateForm()) {
            UTILS.showMessage('formMessage', 'Please fill in all required fields', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveTestBtn');
        const originalText = saveBtn.innerHTML;

        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            // Clear any previous messages
            UTILS.clearMessage('formMessage');

            // Prepare data for saving
            const testData = {
                schedule: this.formData.schedule,
                testDate: this.formData.testDate,
                iycNumber: this.formData.iycNumber,
                patientName: this.formData.patientName,
                category: this.formData.category,
                phoneNumber: this.formData.phoneNumber,
                testName: this.formData.testName,
                testPrice: this.formData.testPrice,
                referredBy: this.formData.referredBy,
                payment: this.formData.payment
            };

            // Save to Google Sheets
            const result = await googleSheetsAPI.saveBloodTest(testData);

            if (result.success) {
                UTILS.showMessage('formMessage', 'Blood test saved successfully!', 'success');
                this.resetForm();
            } else {
                UTILS.showMessage('formMessage', result.message || 'Failed to save blood test', 'error');
            }

        } catch (error) {
            console.error('Error saving blood test:', error);
            UTILS.showMessage('formMessage', 'An error occurred while saving. Please try again.', 'error');
        } finally {
            // Restore button state
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    // Reset form
    resetForm() {
        const form = document.getElementById('addTestForm');
        const nameInput = document.getElementById('bloodTestPatientName');
        const categoryInput = document.getElementById('category');
        const phoneInput = document.getElementById('phoneNumber');
        const paymentInput = document.getElementById('payment');

        if (form) {
            form.reset();
        }

        // Reset field states
        [nameInput, categoryInput, phoneInput, paymentInput].forEach(input => {
            if (input) {
                input.readOnly = false;
                input.disabled = false;
                input.style.backgroundColor = '';
                input.placeholder = input.getAttribute('data-original-placeholder') || input.placeholder;
            }
        });

        // Clear messages
        UTILS.clearMessage('formMessage');

        // Clear test tags
        this.selectedTestTags = [];
        this.renderTestTags();
        this.updateHiddenTestNameField();

        // Clear test name input
        const testNameInput = document.getElementById('testNameInput');
        if (testNameInput) {
            testNameInput.value = '';
        }

        // Hide estimated price section and clear price field
        this.hideEstimatedPrice();

        // Set default values
        this.setDefaultValues();

        // Revalidate form
        this.validateForm();
    }

    // Setup table interactions
    setupTableInteractions() {
        // Setup checkbox interactions
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('test-checkbox') && e.target.closest('#blood-test-module')) {
                this.handleTestSelection(e.target);
            } else if (e.target.classList.contains('select-all-checkbox') && e.target.closest('#blood-test-module')) {
                this.handleSelectAll(e.target);
            }
        });
    }

    // Setup bulk actions
    setupBulkActions() {
        // Setup action button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn')) {
                this.toggleActionDropdown(e.target);
            } else if (e.target.classList.contains('dropdown-item')) {
                this.handleBulkAction(e.target);
            } else {
                // Close all dropdowns when clicking elsewhere
                this.closeAllDropdowns();
            }
        });
    }

    // Setup refresh buttons
    setupRefreshButtons() {
        const refreshButtons = [
            'refreshUpcomingBtn',
            'refreshPendingBtn',
            'refreshReviewBtn',
            'refreshCompletedBtn',
            'refreshCancelledBtn'
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
            'searchPendingTests',
            'searchUpcomingTests',
            'searchReviewTests',
            'searchCompletedTests',
            'searchCancelledTests'
        ];

        const clearButtons = [
            'clearSearchPendingTests',
            'clearSearchUpcomingTests',
            'clearSearchReviewTests',
            'clearSearchCompletedTests',
            'clearSearchCancelledTests'
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
            'refreshUpcomingBtn': 'upcoming-test',
            'refreshPendingBtn': 'pending-test',
            'refreshReviewBtn': 'pending-review',
            'refreshCompletedBtn': 'completed',
            'refreshCancelledBtn': 'cancelled-test'
        };
        return mapping[buttonId];
    }

    // Perform search functionality
    performSearch(inputId, query) {
        const sectionMapping = {
            'searchPendingTests': 'pending-test',
            'searchUpcomingTests': 'upcoming-test',
            'searchReviewTests': 'pending-review',
            'searchCompletedTests': 'completed',
            'searchCancelledTests': 'cancelled-test'
        };

        const section = sectionMapping[inputId];
        if (!section) return;

        // Get all tests for this section
        const allTests = this.sectionData[section] || [];

        if (query === '') {
            // Show all tests if search is empty
            this.renderFilteredTests(section, allTests);
        } else {
            // Filter tests based on search query
            const filteredTests = this.filterTests(allTests, query);
            this.renderFilteredTests(section, filteredTests);
        }
    }

    // Filter tests based on search query
    filterTests(tests, query) {
        const searchTerm = query.toLowerCase().trim();

        return tests.filter(test => {
            // Search in name
            const name = (test.name || '').toLowerCase();
            if (name.includes(searchTerm)) return true;

            // Search in IYC number
            const iycNumber = (test.iycNumber || '').toLowerCase();
            if (iycNumber.includes(searchTerm)) return true;

            // Search in test name/type
            const testName = (test.testName || '').toLowerCase();
            if (testName.includes(searchTerm)) return true;

            // Search in category
            const category = (test.category || '').toLowerCase();
            if (category.includes(searchTerm)) return true;

            // Search in phone number
            const phone = (test.phone || '').toLowerCase();
            if (phone.includes(searchTerm)) return true;

            return false;
        });
    }

    // Get column count for a section
    getColumnCount(sectionName) {
        // upcoming-test and pending-review have an extra Phone column
        return (sectionName === 'upcoming-test' || sectionName === 'pending-review') ? 6 : 5;
    }

    // Render filtered tests
    renderFilteredTests(sectionName, filteredTests) {
        const tableMapping = {
            'upcoming-test': 'upcomingTestsTable',
            'pending-test': 'pendingTestsTable',
            'pending-review': 'reviewTestsTable',
            'completed': 'completedTestsTable',
            'cancelled-test': 'cancelledTestsTable'
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

        if (filteredTests.length === 0) {
            const colspan = this.getColumnCount(sectionName);
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="${colspan}">No matching tests found</td>
                </tr>
            `;
            return;
        }

        // Render filtered test rows
        filteredTests.forEach(test => {
            const row = this.createTestRow(test, sectionName);
            tbody.appendChild(row);
        });

        // Update section controls for filtered results
        this.updateSectionControls(sectionName);

        console.log(`Rendered ${filteredTests.length} filtered tests for ${sectionName}`);
    }

    // Clear search for a specific section
    clearSearch(sectionName) {
        const searchInputMapping = {
            'pending-test': 'searchPendingTests',
            'upcoming-test': 'searchUpcomingTests',
            'pending-review': 'searchReviewTests',
            'completed': 'searchCompletedTests',
            'cancelled-test': 'searchCancelledTests'
        };

        const clearButtonMapping = {
            'pending-test': 'clearSearchPendingTests',
            'upcoming-test': 'clearSearchUpcomingTests',
            'pending-review': 'clearSearchReviewTests',
            'completed': 'clearSearchCompletedTests',
            'cancelled-test': 'clearSearchCancelledTests'
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

    // Load data for a specific section
    async loadSectionData(sectionName) {
        const statusMapping = {
            'upcoming-test': 'Upcoming',
            'pending-test': ['Pending', 'Later'], // Handle both "Pending" and "Later" for backward compatibility
            'pending-review': 'Pending Review',
            'completed': 'Completed',
            'cancelled-test': 'Cancelled'
        };

        const status = statusMapping[sectionName];
        if (!status) return;

        try {
            this.showSectionLoading(sectionName, true);

            // For pending-test section, we need to handle multiple status values
            if (sectionName === 'pending-test') {
                // Get all tests and filter client-side for multiple statuses
                const result = await googleSheetsAPI.getAllTests();
                console.log('All tests result:', result);
                if (result.success) {
                    const filteredTests = result.tests.filter(test =>
                        status.includes(test.status)
                    );
                    console.log(`Filtered tests for ${sectionName}:`, filteredTests);
                    this.sectionData[sectionName] = filteredTests;
                    this.renderSectionTable(sectionName);
                    this.updateSectionControls(sectionName);
                    // Clear search when data is refreshed
                    this.clearSearch(sectionName);
                } else {
                    this.showSectionMessage(sectionName, 'Failed to load data: ' + result.message, 'error');
                }
            } else {
                const result = await googleSheetsAPI.getTests(status);
                console.log(`Tests result for ${sectionName} (status: ${status}):`, result);
                if (result.success) {
                    this.sectionData[sectionName] = result.tests;
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

    // Render table for a section
    renderSectionTable(sectionName) {
        console.log(`Rendering table for ${sectionName}`, this.sectionData[sectionName]);

        const tableMapping = {
            'upcoming-test': 'upcomingTestsTable',
            'pending-test': 'pendingTestsTable',
            'pending-review': 'reviewTestsTable',
            'completed': 'completedTestsTable',
            'cancelled-test': 'cancelledTestsTable'
        };

        const tableId = tableMapping[sectionName];
        const table = document.getElementById(tableId);
        console.log(`Table element for ${tableId}:`, table);
        if (!table) {
            console.error(`Table not found: ${tableId}`);
            return;
        }

        const tbody = table.querySelector('tbody');
        const tests = this.sectionData[sectionName];

        // Clear existing rows
        tbody.innerHTML = '';

        if (tests.length === 0) {
            const colspan = this.getColumnCount(sectionName);
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="${colspan}">No ${sectionName.replace('-', ' ')} found</td>
                </tr>
            `;
            return;
        }

        // Render test rows
        tests.forEach(test => {
            const row = this.createTestRow(test, sectionName);
            tbody.appendChild(row);
        });

        console.log(`Rendered ${tests.length} rows for ${sectionName}`);
    }

    // Create a test row element
    createTestRow(test, sectionName) {
        const row = document.createElement('tr');
        row.setAttribute('data-test-id', test.id);
        row.setAttribute('data-row-index', test.rowIndex);

        // Truncate test name to 5 words for better table display
        console.log('Original test name:', test.testName);
        const truncatedTestName = this.truncateTestName(test.testName, 5);
        console.log('Truncated test name:', truncatedTestName);

        // Different column structures for different sections (following ultrasound pattern)
        if (sectionName === 'pending-test') {
            // Pending: Date, Name, Test Name, Actions
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="test-checkbox" data-test-id="${test.id}">
                </td>
                <td>${test.date}</td>
                <td>${test.name}</td>
                <td class="test-name-cell" data-full-text="${test.testName}">${truncatedTestName}</td>
                <td>
                    <button class="btn-icon" onclick="bloodTestManager.viewTestDetails('${test.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="bloodTestManager.editTestDetails('${test.id}')" title="Edit Test">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else if (sectionName === 'upcoming-test') {
            // Upcoming: Date, Name, Phone, Test Name, Actions
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="test-checkbox" data-test-id="${test.id}">
                </td>
                <td>${test.date}</td>
                <td>${test.name}</td>
                <td>${test.phone || ''}</td>
                <td class="test-name-cell" data-full-text="${test.testName}">${truncatedTestName}</td>
                <td>
                    <button class="btn-icon" onclick="bloodTestManager.viewTestDetails('${test.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="bloodTestManager.editTestDetails('${test.id}')" title="Edit Test">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else if (sectionName === 'cancelled-test') {
            // Cancelled tests: Date, Name, Test Name, Actions (same as other tables)
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="test-checkbox" data-test-id="${test.id}">
                </td>
                <td>${test.date}</td>
                <td>${test.name}</td>
                <td class="test-name-cell" data-full-text="${test.testName}">${truncatedTestName}</td>
                <td>
                    <button class="btn-icon" onclick="bloodTestManager.viewTestDetails('${test.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="bloodTestManager.editTestDetails('${test.id}')" title="Edit Test">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else if (sectionName === 'pending-review') {
            // Pending review: Date, Name, Phone, Test Name, Actions
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="test-checkbox" data-test-id="${test.id}">
                </td>
                <td>${test.date}</td>
                <td>${test.name}</td>
                <td>${test.phone || ''}</td>
                <td class="test-name-cell" data-full-text="${test.testName}">${truncatedTestName}</td>
                <td>
                    <button class="btn-icon" onclick="bloodTestManager.viewTestDetails('${test.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="bloodTestManager.editTestDetails('${test.id}')" title="Edit Test">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        } else {
            // Completed: Date, Name, Test Name, Actions
            row.innerHTML = `
                <td class="checkbox-col">
                    <input type="checkbox" class="test-checkbox" data-test-id="${test.id}">
                </td>
                <td>${test.date}</td>
                <td>${test.name}</td>
                <td class="test-name-cell" data-full-text="${test.testName}">${truncatedTestName}</td>
                <td>
                    <button class="btn-icon" onclick="bloodTestManager.viewTestDetails('${test.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="bloodTestManager.editTestDetails('${test.id}')" title="Edit Test">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
        }

        return row;
    }

    // Truncate test name to specified word count
    truncateTestName(testName, maxWords) {
        if (!testName) return '';

        const words = testName.trim().split(/\s+/);
        console.log(`Truncating "${testName}" - Word count: ${words.length}, Max: ${maxWords}`);

        if (words.length <= maxWords) {
            return testName;
        }

        const truncated = words.slice(0, maxWords).join(' ') + '...';
        console.log(`Truncated to: "${truncated}"`);
        return truncated;
    }



    // Find test by ID
    findTestById(testId) {
        const tests = this.sectionData[this.currentSection];
        return tests.find(test => test.id.toString() === testId.toString());
    }



    // Handle test selection
    handleTestSelection(checkbox) {
        const testId = checkbox.getAttribute('data-test-id');
        const section = this.currentSection;

        if (checkbox.checked) {
            this.selectedTests[section].add(testId);
        } else {
            this.selectedTests[section].delete(testId);
        }

        this.updateSectionControls(section);
        this.updateSelectAllState(section);
    }

    // Handle select all
    handleSelectAll(selectAllCheckbox) {
        const section = this.currentSection;
        const isChecked = selectAllCheckbox.checked;
        const testCheckboxes = document.querySelectorAll(`#${section}-section .test-checkbox`);

        testCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const testId = checkbox.getAttribute('data-test-id');

            if (isChecked) {
                this.selectedTests[section].add(testId);
            } else {
                this.selectedTests[section].delete(testId);
            }
        });

        this.updateSectionControls(section);
    }

    // Update select all state
    updateSelectAllState(sectionName) {
        const selectAllId = this.getSelectAllId(sectionName);
        const selectAllCheckbox = document.getElementById(selectAllId);

        if (selectAllCheckbox) {
            const testCheckboxes = document.querySelectorAll(`#${sectionName}-section .test-checkbox`);
            const checkedCount = document.querySelectorAll(`#${sectionName}-section .test-checkbox:checked`).length;

            selectAllCheckbox.checked = testCheckboxes.length > 0 && checkedCount === testCheckboxes.length;
            selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < testCheckboxes.length;
        }
    }

    // Get select all checkbox ID
    getSelectAllId(sectionName) {
        const mapping = {
            'pending-test': 'selectAllPendingTests',
            'upcoming-test': 'selectAllUpcomingTests',
            'pending-review': 'selectAllReviewTests',
            'completed': 'selectAllCompletedTests',
            'cancelled-test': 'selectAllCancelledTests'
        };
        return mapping[sectionName];
    }



    // Update section controls
    updateSectionControls(sectionName) {
        const selectedCount = this.selectedTests[sectionName].size;

        // Update action button state
        const actionBtnMapping = {
            'upcoming-test': 'upcomingActionBtn',
            'pending-test': 'pendingActionBtn',
            'pending-review': 'reviewActionBtn',
            'completed': 'completedActionBtn',
            'cancelled-test': 'cancelledActionBtn'
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
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }

    // Handle bulk action
    async handleBulkAction(actionItem) {
        const action = actionItem.getAttribute('data-action');
        const selectedTestIds = Array.from(this.selectedTests[this.currentSection]);

        if (selectedTestIds.length === 0) {
            this.showSectionMessage(this.currentSection, 'No tests selected', 'warning');
            return;
        }

        // Close dropdown
        this.closeAllDropdowns();

        // Special handling for moving pending tests to upcoming - show date change dialog
        if (action === 'upcoming' && this.currentSection === 'pending-test') {
            this.showDateChangeDialog(selectedTestIds);
            return;
        }

        // Special handling for changing date of upcoming tests - show date change dialog
        if (action === 'change-date' && this.currentSection === 'upcoming-test') {
            this.showDateChangeDialog(selectedTestIds, true); // true indicates this is for date change only
            return;
        }

        // Confirm action
        const actionText = actionItem.textContent.trim();
        if (!confirm(`Are you sure you want to ${actionText.toLowerCase()} ${selectedTestIds.length} test(s)?`)) {
            return;
        }

        try {
            this.showSectionLoading(this.currentSection, true);

            if (action === 'delete') {
                await this.deleteSelectedTests();
            } else {
                await this.moveSelectedTests(action);
            }

            // Clear selections
            this.selectedTests[this.currentSection].clear();

            // Reload data
            await this.loadSectionData(this.currentSection);

            this.showSectionMessage(this.currentSection, `Successfully ${actionText.toLowerCase()} ${selectedTestIds.length} test(s)`, 'success');

        } catch (error) {
            console.error('Error performing bulk action:', error);
            this.showSectionMessage(this.currentSection, 'Failed to perform action: ' + error.message, 'error');
        } finally {
            this.showSectionLoading(this.currentSection, false);
        }
    }

    // Move selected tests (now updates status instead of moving between sheets)
    async moveSelectedTests(action) {
        const selectedTestIds = Array.from(this.selectedTests[this.currentSection]);

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

        // Get row indices for selected tests
        const rowIndices = selectedTestIds.map(testId => {
            const test = this.findTestById(testId);
            return test ? test.rowIndex : null;
        }).filter(index => index !== null);

        // Update test status via API (much more efficient than moving between sheets)
        const result = await googleSheetsAPI.updateTestStatus(selectedTestIds, newStatus, rowIndices);

        if (!result.success) {
            throw new Error(result.message || 'Failed to update test status');
        }
    }

    // Delete selected tests
    async deleteSelectedTests() {
        const selectedTestIds = Array.from(this.selectedTests[this.currentSection]);

        // Get row indices for selected tests
        const rowIndices = selectedTestIds.map(testId => {
            const test = this.findTestById(testId);
            return test ? test.rowIndex : null;
        }).filter(index => index !== null);

        // Delete tests via API
        const result = await googleSheetsAPI.deleteTests(rowIndices);

        if (!result.success) {
            throw new Error(result.message || 'Failed to delete tests');
        }
    }

    // Show section loading state
    showSectionLoading(sectionName, isLoading) {
        const messageMapping = {
            'upcoming-test': 'upcomingMessage',
            'pending-test': 'pendingMessage',
            'pending-review': 'reviewMessage',
            'completed': 'completedMessage',
            'cancelled-test': 'cancelledMessage'
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
            'upcoming-test': 'upcomingMessage',
            'pending-test': 'pendingMessage',
            'pending-review': 'reviewMessage',
            'completed': 'completedMessage',
            'cancelled-test': 'cancelledMessage'
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

    // Load system configuration
    async loadSystemConfig() {
        try {
            console.log('Loading system configuration for blood test...');
            const result = await googleSheetsAPI.getSystemConfig();

            if (result.success) {
                console.log('System config loaded successfully');

                // Update referred by dropdown
                this.updateReferredByDropdown(result.data.referredBy);

                // Store config for later use
                this.systemConfig = result.data;
            } else {
                console.error('Failed to load system config:', result.message);
            }
        } catch (error) {
            console.error('Error loading system config:', error);
        }
    }

    // Update referred by dropdown with data from system config
    updateReferredByDropdown(referredByList) {
        const referredBySelect = document.getElementById('referredBy');
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
            iycNumber: document.getElementById('iycNumber')?.value || '',
            patientName: document.getElementById('bloodTestPatientName')?.value || '',
            email: document.getElementById('email')?.value || '',
            phoneNumber: document.getElementById('phoneNumber')?.value || ''
        };

        console.log('Blood Test - Form data for update modal:', formData);
        this.showUpdateDetailsModal(formData);
    }

    // Show update details modal
    showUpdateDetailsModal(formData) {
        // Create modal HTML with editable patient fields
        const modalHtml = `
            <div id="bloodTestUpdateDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Update Patient Details</h3>
                        <span class="modal-close" onclick="bloodTestManager.closeUpdateDetailsModal()">&times;</span>
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
                        <button type="button" class="btn-primary" onclick="bloodTestManager.savePatientDetails()">Save Changes</button>
                        <button type="button" class="btn-secondary" onclick="bloodTestManager.closeUpdateDetailsModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('bloodTestUpdateDetailsModal');
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
        const modal = document.getElementById('bloodTestUpdateDetailsModal');
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
            const iycNumber = document.querySelector('#bloodTestUpdateDetailsModal .readonly-field').value.trim();

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
                const nameInput = document.getElementById('bloodTestPatientName');
                const emailInput = document.getElementById('email');
                const phoneInput = document.getElementById('phoneNumber');

                if (nameInput) nameInput.value = name;
                if (emailInput) emailInput.value = email;
                if (phoneInput) phoneInput.value = phone;

                this.showMessage('formMessage', 'Patient details updated successfully!', 'success');
                this.closeUpdateDetailsModal();

                // Refresh the records table if we're on that section
                if (this.currentSection !== 'new-test') {
                    this.loadSectionData(this.currentSection);
                }
            } else {
                const errorMessage = result ? (result.message || 'Failed to update patient details') : 'No response from server';
                loadingOverlay.showError('Update failed', errorMessage);
                this.showMessage('formMessage', errorMessage, 'error');
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
            this.showMessage('formMessage', errorMessage, 'error');
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
        console.log(`Blood Test - Send Message clicked for section: ${sectionName}`);

        try {
            // Get selected tests from the current section
            const selectedTestIds = Array.from(this.selectedTests[sectionName]);
            const sectionData = this.sectionData[sectionName];

            if (selectedTestIds.length === 0) {
                this.showSectionMessage(sectionName, 'Please select at least one test to send messages', 'warning');
                return;
            }

            // Collect patient data for selected tests
            const selectedTests = selectedTestIds.map(testId => {
                return sectionData.find(test => test.id.toString() === testId.toString());
            }).filter(test => test !== undefined);

            console.log('Blood Test - Selected tests for messaging:', selectedTests);

            // Prepare message data structure for future WhatsApp API integration
            const messageData = {
                module: 'blood-test',
                section: sectionName,
                recipients: selectedTests.map(test => ({
                    name: test.name,
                    phone: test.phone,
                    iycNumber: test.iycNumber,
                    testName: test.testName,
                    date: test.date,
                    referredBy: test.referredBy
                })),
                messageTemplate: this.getMessageTemplate(sectionName),
                timestamp: new Date().toISOString()
            };

            console.log('Blood Test - Message data prepared:', messageData);

            // TODO: Replace this placeholder with actual WhatsApp API call
            // Example: await whatsappAPI.sendBulkMessages(messageData);

            // Placeholder success message
            this.showSectionMessage(
                sectionName,
                `Message sending prepared for ${selectedTests.length} patient(s). WhatsApp API integration pending.`,
                'info'
            );

            // Log for future development
            console.log('Blood Test - WhatsApp API integration point - messageData ready:', messageData);

        } catch (error) {
            console.error('Blood Test - Error in sendMessage:', error);
            this.showSectionMessage(sectionName, 'Error preparing message data: ' + error.message, 'error');
        }
    }

    // Get message template based on section (placeholder for future customization)
    getMessageTemplate(sectionName) {
        const templates = {
            'upcoming-test': {
                subject: 'Blood Test Reminder',
                body: 'Dear {name}, this is a reminder for your upcoming blood test ({testName}) scheduled for {date}. Please arrive 15 minutes early. Referred by: {referredBy}. IYC: {iycNumber}'
            },
            'pending-review': {
                subject: 'Blood Test Results Ready',
                body: 'Dear {name}, your blood test results ({testName}) are ready for review. Please contact us to schedule a consultation. Referred by: {referredBy}. IYC: {iycNumber}'
            }
        };

        return templates[sectionName] || {
            subject: 'Blood Test Update',
            body: 'Dear {name}, we have an update regarding your blood test ({testName}). Please contact us for more information. IYC: {iycNumber}'
        };
    }

    // Load patient data for name search
    async loadPatientData() {
        try {
            console.log('Blood Test - Loading patient data...');
            const result = await googleSheetsAPI.getAllPatients();

            if (result && result.success) {
                this.patients = result.patients || [];
                console.log('Blood Test - Patient data loaded successfully:', this.patients.length, 'patients');
            } else {
                console.error('Blood Test - Failed to load patient data');
                this.patients = [];
            }
        } catch (error) {
            console.error('Blood Test - Error loading patient data:', error);
            this.patients = [];
        }
    }

    // Select a package and populate the test name field
    selectPackage(packageName) {
        // Store the original test names before replacing them
        const originalTestNames = [...this.selectedTestTags];

        // Create the display name with original tests in parentheses
        let displayName = packageName;
        if (originalTestNames.length > 0) {
            displayName = `${packageName} (${originalTestNames.join(', ')})`;
        }

        // Clear existing tags and add the package as a single tag
        this.selectedTestTags = [displayName];
        this.renderTestTags();
        this.updateHiddenTestNameField();

        // Clear the input field
        const testNameInput = document.getElementById('testNameInput');
        if (testNameInput) {
            testNameInput.value = '';
        }

        // Trigger the estimation for the selected package (use original package name for estimation)
        this.estimateTestPrice(packageName);
    }

    // Estimate test price using Gemini AI
    async estimateTestPrice(testNames) {
        if (!testNames || testNames.trim().length < 3) {
            this.hideEstimatedPrice();
            return;
        }

        try {
            this.showEstimatedPriceLoading(true);

            console.log('Estimating price for:', testNames);

            const response = await fetch('/api/estimate-test-price', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ testNames: testNames.trim() })
            });

            const data = await response.json();

            if (data.success) {
                this.displayEstimatedPrice(data.estimation);
            } else {
                this.showEstimatedPriceError(data.message || 'Failed to estimate price');
            }

        } catch (error) {
            console.error('Error estimating test price:', error);
            this.showEstimatedPriceError('Failed to estimate price. Please try again.');
        } finally {
            this.showEstimatedPriceLoading(false);
        }
    }

    // Show/hide estimated price section
    showEstimatedPrice() {
        const section = document.getElementById('estimatedPriceSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    hideEstimatedPrice() {
        const section = document.getElementById('estimatedPriceSection');
        if (section) {
            section.style.display = 'none';
        }

        // Clear the price field when hiding estimated price
        const testPriceInput = document.getElementById('testPrice');
        if (testPriceInput) {
            testPriceInput.value = '';
        }
    }

    // Show/hide loading spinner
    showEstimatedPriceLoading(show) {
        const spinner = document.getElementById('priceLoadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }

        if (show) {
            this.showEstimatedPrice();
            const content = document.getElementById('estimatedPriceContent');
            if (content) {
                content.innerHTML = '';
            }
        }
    }

    // Display estimated price results
    displayEstimatedPrice(estimation) {
        this.showEstimatedPrice();

        const content = document.getElementById('estimatedPriceContent');
        if (!content) return;

        let html = '<div class="price-analysis">';

        // Test breakdown
        if (estimation.tests && estimation.tests.length > 0) {
            html += '<div class="test-breakdown">';
            html += '<h5>📋 Test Breakdown</h5>';

            estimation.tests.forEach(test => {
                const priceDisplay = test.price > 0 ? `₹${test.price}` : 'Price not found';
                const confidenceIcon = test.confidence >= 0.8 ? '✅' : test.confidence >= 0.5 ? '⚠️' : '❓';

                html += `
                    <div class="test-item">
                        <div class="test-name">${confidenceIcon} ${test.name}</div>
                        <div class="test-price">${priceDisplay}</div>
                    </div>
                `;
            });

            html += '</div>';
        }

        // Total price
        if (estimation.totalPrice > 0) {
            html += `
                <div class="total-price">
                    <h5>💰 Total Individual Price</h5>
                    <div class="total-amount">₹${estimation.totalPrice}</div>
                </div>
            `;
        }

        // Show package recommendations based on test overlap
        if (estimation.packageRecommendations && estimation.packageRecommendations.length > 0) {
            html += '<div class="package-recommendations">';
            html += '<h5>🎯 Recommended Packages</h5>';
            html += '<p style="font-size: 0.85rem; color: #666; margin-bottom: 1rem;">These packages contain most of your requested tests and may offer better value:</p>';

            estimation.packageRecommendations.forEach(pkg => {
                const savingsText = pkg.savings > 0 ?
                    `<span style="color: #28a745; font-weight: bold; margin-left: 10px;">💰 Save ₹${pkg.savings}</span>` :
                    '';

                html += `
                    <div class="package-item" style="cursor: pointer; border: 2px solid #28a745; padding: 12px; margin: 8px 0; border-radius: 8px; background: #f8fff8;" onclick="bloodTestManager.selectPackage('${pkg.packageName}')">
                        <div class="package-name" style="font-weight: bold; color: #007bff; font-size: 1.1rem;">${pkg.packageName}</div>
                        <div class="package-details" style="margin: 5px 0;">
                            <strong>Price: ₹${pkg.packagePrice}</strong> ${savingsText}
                        </div>
                        <div class="package-details" style="color: #28a745; font-weight: bold;">${pkg.note}</div>

                        <div class="test-breakdown" style="margin-top: 8px; font-size: 0.85rem;">
                            <div style="color: #28a745;">✅ <strong>Included (${pkg.matchedTests.length}):</strong> ${pkg.matchedTests.join(', ')}</div>
                            ${pkg.missingTests.length > 0 ? `<div style="color: #dc3545; margin-top: 3px;">❌ <strong>Missing (${pkg.missingTests.length}):</strong> ${pkg.missingTests.join(', ')}</div>` : ''}
                            ${pkg.additionalTests.length > 0 ? `<div style="color: #6c757d; margin-top: 3px;">➕ <strong>Bonus tests (${pkg.additionalTests.length}):</strong> ${pkg.additionalTests.slice(0, 5).join(', ')}${pkg.additionalTests.length > 5 ? '...' : ''}</div>` : ''}
                        </div>

                        <div class="package-details" style="font-size: 0.8rem; color: #007bff; margin-top: 8px; text-align: center; font-weight: bold;">🖱️ Click to select this package</div>
                    </div>
                `;
            });

            html += '</div>';
        }

        // Lowest price option
        if (estimation.lowestPriceOption) {
            const option = estimation.lowestPriceOption;
            html += `
                <div class="lowest-price-option">
                    <h5>🎯 Best Price Option</h5>
                    <div class="recommended-option">${option.description}</div>
                    <div class="total-amount">₹${option.price}</div>
                    ${option.savings ? `<div class="savings-info">You save ₹${option.savings}!</div>` : ''}
                </div>
            `;

            // Update the price input with the lowest price
            const testPriceInput = document.getElementById('testPrice');
            if (testPriceInput) {
                testPriceInput.value = option.price;
            }
        }

        // Reasoning
        if (estimation.reasoning) {
            html += `
                <div class="test-breakdown">
                    <h5>🤖 AI Analysis</h5>
                    <p style="color: #666; font-size: 0.9rem;">${estimation.reasoning}</p>
                </div>
            `;
        }

        html += '</div>';
        content.innerHTML = html;
    }

    // Show error message
    showEstimatedPriceError(message) {
        this.showEstimatedPrice();

        const content = document.getElementById('estimatedPriceContent');
        if (content) {
            content.innerHTML = `
                <div class="error-message">
                    <strong>❌ Error:</strong> ${message}
                </div>
            `;
        }
    }

    // Download upcoming tests as PDF
    async downloadUpcomingTestsPDF() {
        try {
            const downloadBtn = document.getElementById('downloadUpcomingTestsBtn');

            // Show loading state
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';

            // Get upcoming tests data
            const upcomingTests = this.sectionData['upcoming-test'] || [];

            if (upcomingTests.length === 0) {
                alert('No upcoming tests found to download.');
                return;
            }

            // Filter and prepare data for PDF with formatted test names
            const pdfData = upcomingTests.map(test => {
                // Format test name with proper line breaks for better wrapping
                let formattedTestName = test.testName || '';

                // Add line breaks for better formatting
                formattedTestName = formattedTestName
                    .replace(/;\s*/g, ';\n')  // Line break after semicolons
                    .replace(/,\s*(?=[A-Z])/g, ',\n')  // Line break after commas before capital letters
                    .replace(/\s*-\s*/g, '\n- ')  // Line break before dashes
                    .replace(/\(\s*([^)]+)\s*\)/g, '\n($1)')  // Put parentheses content on new line
                    .replace(/\n+/g, '\n')  // Remove multiple consecutive line breaks
                    .trim();

                return {
                    name: test.name || '',
                    testName: formattedTestName,
                    payment: test.payment || '',
                    ageGender: '', // Empty as requested
                    email: '', // Empty as requested
                    phone: '' // Empty as requested
                };
            });

            // Generate PDF
            this.generateTestsPDF(pdfData, 'Upcoming Blood Tests');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            // Restore button state
            const downloadBtn = document.getElementById('downloadUpcomingTestsBtn');
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download PDF';
            }
        }
    }

    // Generate PDF with test data in landscape orientation with minimal borders
    generateTestsPDF(testData, title) {
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

        // Define table columns
        const columns = [
            { header: 'Name', dataKey: 'name' },
            { header: 'Test', dataKey: 'testName' },
            { header: 'Age/Gender', dataKey: 'ageGender' },
            { header: 'Payment', dataKey: 'payment' },
            { header: 'Email', dataKey: 'email' },
            { header: 'Phone', dataKey: 'phone' }
        ];

        // Generate table using autoTable plugin with no borders and full width
        doc.autoTable({
            columns: columns,
            body: testData,
            startY: 35,
            styles: {
                fontSize: 9,
                cellPadding: 2,
                overflow: 'linebreak',
                halign: 'left',
                lineColor: [255, 255, 255], // White lines (invisible borders)
                lineWidth: 0 // No border lines
            },
            headStyles: {
                fillColor: [102, 126, 234], // Blue header
                textColor: 255,
                fontStyle: 'bold',
                lineColor: [255, 255, 255], // White lines for header
                lineWidth: 0 // No border lines for header
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245] // Light gray for alternate rows
            },
            columnStyles: {
                name: { cellWidth: 'auto' },
                testName: { cellWidth: 'auto' },
                ageGender: { cellWidth: 'auto' },
                payment: { cellWidth: 'auto' },
                email: { cellWidth: 'auto' },
                phone: { cellWidth: 'auto' }
            },
            margin: { top: 35, left: 10, right: 10, bottom: 5 }, // Match left spacing on both sides
            tableWidth: 'auto',
            theme: 'plain' // Remove all default styling and borders
        });

        // Save the PDF
        const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
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
        const dropdown = document.getElementById('bloodTestNameSearchDropdown');
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
        const dropdown = document.getElementById('bloodTestNameSearchDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    // Select patient from dropdown
    selectPatient(patient) {
        const iycInput = document.getElementById('iycNumber');
        const nameInput = document.getElementById('bloodTestPatientName');
        const categoryInput = document.getElementById('category');
        const phoneInput = document.getElementById('phoneNumber');

        if (iycInput) iycInput.value = patient.iycNumber;
        if (nameInput) {
            nameInput.value = patient.name;
            nameInput.style.backgroundColor = '#e8f5e8';
        }
        if (categoryInput) {
            categoryInput.value = patient.category || '';
            categoryInput.style.backgroundColor = '#e8f5e8';
        }
        if (phoneInput) {
            phoneInput.value = patient.phone || '';
            phoneInput.style.backgroundColor = '#e8f5e8';
        }

        this.hideNameDropdown();
        this.validateForm();
    }



    // View test details
    viewTestDetails(testId) {
        const test = this.findTestById(testId);
        if (test) {
            this.showTestDetailsModal(test);
        }
    }

    // Show test details modal
    showTestDetailsModal(test) {
        // Create modal HTML
        const modalHtml = `
            <div id="testDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Blood Test Details</h3>
                        <span class="modal-close" onclick="bloodTestManager.closeDetailsModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>Name:</label>
                                <span>${test.name}</span>
                            </div>
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <span>${test.iycNumber || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Phone:</label>
                                <span>${test.phone || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Category:</label>
                                <span>${test.category || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Test Name:</label>
                                <span>${test.testName || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Referred By:</label>
                                <span>${test.referredBy || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Date:</label>
                                <span>${test.date || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Status:</label>
                                <span>${test.status || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Payment:</label>
                                <span>${test.payment || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Remarks:</label>
                                <span>${test.remarks || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="bloodTestManager.closeDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('testDetailsModal');
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
        const modal = document.getElementById('testDetailsModal');
        if (modal) {
            modal.remove();
        }
    }

    // Edit test details
    editTestDetails(testId) {
        const test = this.findTestById(testId);
        if (test) {
            this.showEditTestModal(test);
        }
    }

    // Show edit test modal
    showEditTestModal(test) {
        // Create modal HTML with editable date and test fields
        const modalHtml = `
            <div id="editTestModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Blood Test</h3>
                        <span class="modal-close" onclick="bloodTestManager.closeEditTestModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <input type="text" class="readonly-field" value="${test.iycNumber || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Name:</label>
                                <input type="text" class="readonly-field" value="${test.name || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Category:</label>
                                <input type="text" class="readonly-field" value="${test.category || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Date: <span class="required">*</span></label>
                                <input type="date" id="editTestDate" value="${test.date || ''}" required>
                            </div>
                            <div class="detail-item">
                                <label>Test Name: <span class="required">*</span></label>
                                <textarea id="editTestName" rows="3" required>${test.testName || ''}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" onclick="bloodTestManager.saveEditedTest('${test.id}')">Save Changes</button>
                        <button type="button" class="btn-secondary" onclick="bloodTestManager.closeEditTestModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('editTestModal');
        modal.style.display = 'flex';

        // Add event listener for clicking outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEditTestModal();
            }
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeEditTestModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // Close edit test modal
    closeEditTestModal() {
        const modal = document.getElementById('editTestModal');
        if (modal) {
            modal.remove();
        }
    }

    // Save edited test
    async saveEditedTest(testId) {
        try {
            // Get form values from modal
            const date = document.getElementById('editTestDate').value.trim();
            const testName = document.getElementById('editTestName').value.trim();

            // Validate required fields
            if (!date || !testName) {
                alert('Please fill in all required fields (Date, Test Name)');
                return;
            }

            // Show loading overlay
            loadingOverlay.show('Updating test details...', 'Please wait while we save your changes');

            // Find the test to get its row index
            const test = this.findTestById(testId);
            if (!test) {
                throw new Error('Test not found');
            }

            // Prepare test data for update
            const testData = {
                id: testId,
                rowIndex: test.rowIndex,
                date: date,
                testName: testName
            };

            // Update test via API
            const result = await googleSheetsAPI.updateTestDetails(testData);

            if (result && result.success) {
                // Show success overlay
                loadingOverlay.showSuccess('Test details updated successfully!', 'Your changes have been saved');

                // Close the modal
                this.closeEditTestModal();

                // Reload the current section data to reflect changes
                await this.loadSectionData(this.currentSection);

            } else {
                throw new Error(result?.message || 'Failed to update test details');
            }

        } catch (error) {
            console.error('Error updating test details:', error);
            loadingOverlay.showError('Failed to update test details', error.message || 'Please try again');
        }
    }

    // Show date change dialog for moving pending tests to upcoming or changing date of upcoming tests
    showDateChangeDialog(selectedTestIds, isDateChangeOnly = false) {
        console.log('showDateChangeDialog called with:', selectedTestIds, 'isDateChangeOnly:', isDateChangeOnly);

        if (!selectedTestIds || selectedTestIds.length === 0) {
            this.showSectionMessage(this.currentSection, 'No tests selected', 'error');
            return;
        }

        const selectedTests = selectedTestIds.map(id => this.findTestById(id)).filter(t => t);
        console.log('Found tests:', selectedTests);

        if (selectedTests.length === 0) {
            this.showSectionMessage(this.currentSection, 'No valid tests selected', 'error');
            return;
        }

        // Store selected tests for later use
        this.schedulingTests = selectedTests;
        this.isDateChangeOnly = isDateChangeOnly; // Store the mode
        console.log('Stored scheduling tests:', this.schedulingTests, 'Mode:', isDateChangeOnly ? 'Date Change Only' : 'Move to Upcoming');

        // Create modal HTML with dynamic title and button text
        const modalTitle = isDateChangeOnly ? 'Change Test Date' : 'Move Tests to Upcoming';
        const buttonText = isDateChangeOnly ? 'Update Date' : 'Move to Upcoming';

        const modalHtml = `
            <div id="dateChangeModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${modalTitle}</h3>
                        <span class="modal-close" onclick="bloodTestManager.closeDateChangeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="selected-tests-info">
                            <h4>Selected Tests (${selectedTests.length}):</h4>
                            <div class="selected-tests-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Test Name</th>
                                            <th>Current Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${selectedTests.map(test => `
                                            <tr>
                                                <td>${test.name}</td>
                                                <td>${test.testName}</td>
                                                <td>${test.date}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="date-change-form">
                            <div class="form-group">
                                <label for="newTestDate">New Test Date:</label>
                                <input type="date" id="newTestDate" class="form-control" required>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="bloodTestManager.closeDateChangeModal()">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="bloodTestManager.confirmDateChange()">${buttonText}</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Set default date to next test date
        const newTestDateInput = document.getElementById('newTestDate');
        newTestDateInput.value = UTILS.getNextTestDate();

        // Show modal
        const modal = document.getElementById('dateChangeModal');
        modal.style.display = 'block';

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeDateChangeModal();
            }
        });
    }

    // Close date change modal
    closeDateChangeModal() {
        const modal = document.getElementById('dateChangeModal');
        if (modal) {
            modal.remove();
        }
        this.schedulingTests = null;
        this.isDateChangeOnly = false; // Reset the mode
    }

    // Confirm date change and move tests to upcoming
    async confirmDateChange() {
        const newDate = document.getElementById('newTestDate').value;

        if (!newDate) {
            alert('Please select a new test date');
            return;
        }

        console.log('confirmDateChange called with schedulingTests:', this.schedulingTests);

        // Backup: try to get selected tests from current selection if schedulingTests is null
        if (!this.schedulingTests || this.schedulingTests.length === 0) {
            console.log('Attempting to recover selected tests from current selection...');
            const selectedTestIds = Array.from(this.selectedTests[this.currentSection] || []);
            console.log('Selected test IDs:', selectedTestIds);

            if (selectedTestIds.length > 0) {
                this.schedulingTests = selectedTestIds.map(id => this.findTestById(id)).filter(t => t);
                console.log('Recovered scheduling tests:', this.schedulingTests);
            }
        }

        if (!this.schedulingTests || this.schedulingTests.length === 0) {
            console.error('No scheduling tests found after recovery attempt:', this.schedulingTests);
            alert('No tests selected for scheduling. Please try selecting tests again.');
            return;
        }

        try {
            // Show loading overlay instead of section loading
            if (typeof loadingOverlay !== 'undefined') {
                loadingOverlay.show('Moving tests to upcoming...', 'Please wait while we update the test status and date');
            } else {
                this.showSectionLoading(this.currentSection, true);
            }

            // Store the count before clearing
            const testCount = this.schedulingTests.length;

            // Update tests based on mode
            if (this.isDateChangeOnly) {
                // Just change the date, keep current status
                await this.changeTestDates(this.schedulingTests, newDate);
            } else {
                // Update tests with new date and status (move to upcoming)
                await this.moveTestsToUpcoming(this.schedulingTests, newDate);
            }

            // Show success with dynamic message
            const successTitle = this.isDateChangeOnly ? 'Date updated successfully!' : 'Tests moved successfully!';
            const successMessage = this.isDateChangeOnly ?
                `Date updated for ${testCount} test(s)` :
                `${testCount} test(s) have been moved to upcoming`;

            if (typeof loadingOverlay !== 'undefined') {
                loadingOverlay.showSuccess(successTitle, successMessage);
            }

            // Close modal
            this.closeDateChangeModal();

            // Clear selections
            this.selectedTests[this.currentSection].clear();

            // Reload data
            await this.loadSectionData(this.currentSection);

            const sectionMessage = this.isDateChangeOnly ?
                `Successfully updated date for ${testCount} test(s)` :
                `Successfully moved ${testCount} test(s) to upcoming`;
            this.showSectionMessage(this.currentSection, sectionMessage, 'success');

        } catch (error) {
            console.error('Error moving tests to upcoming:', error);

            if (typeof loadingOverlay !== 'undefined') {
                loadingOverlay.showError('Failed to move tests', error.message || 'Please try again');
            } else {
                alert('Failed to move tests to upcoming: ' + error.message);
            }
        } finally {
            if (typeof loadingOverlay === 'undefined') {
                this.showSectionLoading(this.currentSection, false);
            }
        }
    }

    // Move tests to upcoming with new date
    async moveTestsToUpcoming(tests, newDate) {
        console.log('moveTestsToUpcoming called with:', { tests, newDate });

        if (!tests || tests.length === 0) {
            throw new Error('No tests provided for update');
        }

        // Validate test data
        const validTests = tests.filter(test => test && test.id && test.rowIndex);
        if (validTests.length === 0) {
            throw new Error('No valid tests found for update');
        }

        console.log('Valid tests for update:', validTests);

        const testIds = validTests.map(test => test.id);
        const rowIndices = validTests.map(test => test.rowIndex);

        console.log('Calling API with:', { testIds, newDate, rowIndices });

        // Update test status and date via API
        const result = await googleSheetsAPI.updateTestStatusAndDate(testIds, 'Upcoming', newDate, rowIndices);

        console.log('API result:', result);

        if (!result || !result.success) {
            throw new Error(result?.message || 'Failed to update test status and date');
        }

        return result;
    }

    // Change test dates only (without changing status)
    async changeTestDates(tests, newDate) {
        console.log('changeTestDates called with:', { tests, newDate });

        if (!tests || tests.length === 0) {
            throw new Error('No tests provided for date update');
        }

        // Validate test data
        const validTests = tests.filter(test => test && test.id && test.rowIndex);
        if (validTests.length === 0) {
            throw new Error('No valid tests found for date update');
        }

        console.log('Valid tests for date update:', validTests);

        const testIds = validTests.map(test => test.id);
        const rowIndices = validTests.map(test => test.rowIndex);

        console.log('Calling API with:', { testIds, newDate, rowIndices });

        // Update test dates only via API
        const result = await googleSheetsAPI.updateTestDates(testIds, newDate, rowIndices);

        console.log('API result:', result);

        if (!result || !result.success) {
            throw new Error(result?.message || 'Failed to update test dates');
        }

        return result;
    }
}

// Create global blood test manager instance
const bloodTestManager = new BloodTestManager();

// Test function for debugging
window.testBloodTestAPI = async function() {
    console.log('Testing Blood Test API...');
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

// Debug function to test name field directly
window.debugBloodTestNameField = function() {
    const nameInput = document.getElementById('bloodTestPatientName');
    console.log('Name input element:', nameInput);
    console.log('Current value:', nameInput ? nameInput.value : 'Element not found');

    if (nameInput) {
        console.log('Setting test value...');
        nameInput.value = 'Test Name';
        console.log('Value after setting:', nameInput.value);
        nameInput.style.backgroundColor = '#e8f5e8';

        setTimeout(() => {
            console.log('Value after 1 second:', nameInput.value);
        }, 1000);
    }
};

// Debug function to test IYC lookup
window.debugBloodTestIYCLookup = async function(iycNumber = 'TEST001') {
    console.log('=== DEBUG: Testing Blood Test IYC lookup ===');
    console.log('IYC Number:', iycNumber);
    console.log('bloodTestManager:', bloodTestManager);
    console.log('googleSheetsAPI.isInitialized:', googleSheetsAPI.isInitialized);

    try {
        await bloodTestManager.handleIYCLookup(iycNumber);

// Debug function to test date change dialog
window.debugDateChangeDialog = function(isDateChangeOnly = false) {
    console.log('=== DEBUG: Testing Date Change Dialog ===');
    console.log('Mode:', isDateChangeOnly ? 'Date Change Only' : 'Move to Upcoming');

    // Create fake test data
    const fakeTests = [
        {
            id: 'TEST001',
            name: 'Test Patient 1',
            testName: 'Blood Test 1',
            date: '2025-07-04',
            rowIndex: 2
        },
        {
            id: 'TEST002',
            name: 'Test Patient 2',
            testName: 'Blood Test 2',
            date: '2025-07-05',
            rowIndex: 3
        }
    ];

    console.log('Fake tests:', fakeTests);

    // Set up the manager state
    bloodTestManager.currentSection = isDateChangeOnly ? 'upcoming-test' : 'pending-test';
    bloodTestManager.schedulingTests = fakeTests;

    // Show the dialog
    bloodTestManager.showDateChangeDialog(['TEST001', 'TEST002'], isDateChangeOnly);
};

// Debug function to test upcoming test date change
window.debugUpcomingDateChange = function() {
    debugDateChangeDialog(true);
};
        console.log('=== DEBUG: IYC lookup completed ===');
    } catch (error) {
        console.error('=== DEBUG: IYC lookup failed ===', error);
    }
};
