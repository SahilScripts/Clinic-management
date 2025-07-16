// Diet Request Module - Clean Implementation
console.log('Loading diet-request.js...');

class DietRequestManager {
    constructor() {
        this.currentSection = 'new-request';
        this.formData = {};
        this.isFormValid = false;
        this.sectionData = {
            'records': []
        };
        this.selectedRecords = {
            'records': new Set()
        };
        this.systemConfig = null;
        this.patients = [];
        this.loadingData = false;
    }

    // Initialize the diet request module
    init() {
        console.log('Diet Request - Initializing module...');

        // Ensure DOM is ready before setting up event listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
            });
        } else {
            this.setupEventListeners();
        }

        // Load data that doesn't require DOM elements
        this.loadSystemConfig();
        this.loadPatientData();

        console.log('Diet Request - Module initialized successfully');
    }

    // Setup all event listeners and DOM-dependent functionality
    setupEventListeners() {
        console.log('Diet Request - Setting up event listeners...');

        this.setupSidebarNavigation();
        this.setupNewRequestForm();
        this.setupFormValidation();
        this.setupTableInteractions();
        this.setupBulkActions();
        this.setupRefreshButtons();
        this.setupSearchFunctionality();
        this.setDefaultStartDate();

        // Load data for current section if not new-request
        if (this.currentSection !== 'new-request') {
            this.loadSectionData(this.currentSection);
        }

        console.log('Diet Request - Event listeners setup completed');
    }

    // Setup sidebar navigation
    setupSidebarNavigation() {
        const sidebarItems = document.querySelectorAll('#diet-request-module .sidebar-item');

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
        const sidebarItems = document.querySelectorAll('#diet-request-module .sidebar-item');
        sidebarItems.forEach(item => {
            item.classList.remove('active');
        });

        const activeItem = document.querySelector(`#diet-request-module .sidebar-item[data-section="${sectionName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Hide all sections
        const sections = document.querySelectorAll('#diet-request-module .section');
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(`diet-${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update current section
        this.currentSection = sectionName;

        // Load section data if needed
        if (sectionName !== 'new-request') {
            this.loadSectionData(sectionName);
        }
    }

    // Setup new request form
    setupNewRequestForm() {
        console.log('Diet Request - Setting up new request form');

        const form = document.getElementById('dietRequestForm');
        const iycInput = document.getElementById('dietIycNumber');
        const nameInput = document.getElementById('dietPatientName');
        const resetBtn = document.getElementById('resetDietFormBtn');
        const durationInput = document.getElementById('dietDuration');
        const startDateInput = document.getElementById('dietStartDate');

        // Handle IYC number input with debouncing
        if (iycInput) {
            console.log('Diet Request - Adding event listener to IYC input');
            let debounceTimer;
            iycInput.addEventListener('input', () => {
                console.log('Diet Request - IYC input event triggered, value:', iycInput.value);
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.handleIYCLookup(iycInput.value);
                }, 500);
            });
        } else {
            console.error('Diet Request - IYC input element not found!');
        }

        // Handle name input for search
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

        // Handle duration change to calculate end date
        if (durationInput) {
            durationInput.addEventListener('input', () => {
                this.calculateEndDate();
            });
        }

        // Handle start date change to calculate end date
        if (startDateInput) {
            startDateInput.addEventListener('change', () => {
                this.calculateEndDate();
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
        const updateDetailsBtn = document.getElementById('updatePatientDetailsBtn');
        if (updateDetailsBtn) {
            updateDetailsBtn.addEventListener('click', () => {
                this.updatePatientDetails();
            });
        }
    }

    // Setup form validation
    setupFormValidation() {
        const form = document.getElementById('dietRequestForm');
        if (!form) return;

        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateForm();
            });
            input.addEventListener('change', () => {
                this.validateForm();
            });
        });
    }

    // Setup table interactions
    setupTableInteractions() {
        const dietRequestModule = document.getElementById('diet-request-module');
        if (!dietRequestModule) return;

        // Handle record selection
        dietRequestModule.addEventListener('change', (e) => {
            if (!e.target.closest('#diet-request-module')) return;
            e.stopPropagation();

            if (e.target.classList.contains('diet-record-checkbox')) {
                this.handleRecordSelection(e.target);
            } else if (e.target.classList.contains('select-all-checkbox') && e.target.id === 'selectAllDietRecordsHeader') {
                this.handleSelectAll(e.target);
            }
        });
    }

    // Setup bulk actions
    setupBulkActions() {
        const dietRequestModule = document.getElementById('diet-request-module');
        if (!dietRequestModule) return;

        dietRequestModule.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;

            const actionBtn = e.target.classList.contains('action-btn') ? e.target : e.target.closest('.action-btn');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleActionDropdown(actionBtn);
            } else if (e.target.classList.contains('dropdown-item')) {
                this.handleBulkAction(e.target);
            } else {
                this.closeAllDropdowns();
            }
        });
    }

    // Setup refresh buttons
    setupRefreshButtons() {
        const refreshBtn = document.getElementById('refreshDietRecordsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // Ensure we're refreshing the records section
                if (this.currentSection === 'records') {
                    this.loadSectionData('records');
                }
            });
        }
    }

    // Setup search functionality
    setupSearchFunctionality() {
        const searchInput = document.getElementById('searchDietRecords');
        const clearBtn = document.getElementById('clearSearchDietRecords');

        if (searchInput) {
            let searchTimer;
            searchInput.addEventListener('input', (e) => {
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
                    this.performSearch(query);
                }, 300);
            });
        }

        // Setup clear button event listener
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    clearBtn.classList.remove('visible');
                    this.performSearch('');
                }
            });
        }
    }

    // Perform search functionality
    performSearch(query) {
        // Get all records for the records section
        const allRecords = this.sectionData['records'] || [];

        if (query === '') {
            // Show all records if search is empty
            this.renderFilteredRecords(allRecords);
        } else {
            // Filter records based on search query
            const filteredRecords = this.filterRecords(allRecords, query);
            this.renderFilteredRecords(filteredRecords);
        }
    }

    // Filter records based on search query
    filterRecords(records, query) {
        const searchTerm = query.toLowerCase().trim();

        return records.filter(record => {
            // Search in name
            const name = (record.name || '').toLowerCase();
            if (name.includes(searchTerm)) return true;

            // Search in IYC number
            const iycNumber = (record.iycNumber || '').toLowerCase();
            if (iycNumber.includes(searchTerm)) return true;

            // Search in status
            const status = (record.status || '').toLowerCase();
            if (status.includes(searchTerm)) return true;

            // Search in duration
            const duration = (record.duration || '').toString().toLowerCase();
            if (duration.includes(searchTerm)) return true;

            return false;
        });
    }

    // Render filtered records
    renderFilteredRecords(filteredRecords) {
        const table = document.getElementById('dietRecordsTable');

        if (!table) {
            console.error('Diet records table not found');
            return;
        }

        const tbody = table.querySelector('tbody');

        // Clear existing rows
        tbody.innerHTML = '';

        if (filteredRecords.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="8">No matching records found</td>
                </tr>
            `;
            return;
        }

        // Render filtered record rows
        filteredRecords.forEach(record => {
            const row = this.createRecordRow(record);
            tbody.appendChild(row);
        });

        // Update section controls for filtered results
        this.updateSectionControls('records');

        console.log(`Rendered ${filteredRecords.length} filtered records`);
    }

    // Clear search
    clearSearch() {
        const searchInput = document.getElementById('searchDietRecords');
        const clearButton = document.getElementById('clearSearchDietRecords');

        if (searchInput) {
            searchInput.value = '';
        }

        if (clearButton) {
            clearButton.classList.remove('visible');
        }
    }

    // Load system configuration
    async loadSystemConfig() {
        try {
            console.log('Diet Request - Loading system configuration...');
            const result = await googleSheetsAPI.getSystemConfig();
            console.log('Diet Request - System config API result:', result);

            if (result && result.success) {
                this.systemConfig = result.data;
                console.log('Diet Request - System config data stored:', this.systemConfig);
                this.setupAnchorDropdown();
                this.setupMultiSelectDropdown();
                console.log('Diet Request - System configuration loaded successfully');
            } else {
                console.error('Diet Request - Failed to load system configuration:', result);
            }
        } catch (error) {
            console.error('Diet Request - Error loading system configuration:', error);
        }
    }

    // Set default start date to today
    setDefaultStartDate() {
        const startDateInput = document.getElementById('dietStartDate');
        const dateRequestedInput = document.getElementById('dietDateRequested');

        if (startDateInput) {
            const today = new Date().toISOString().split('T')[0];
            startDateInput.value = today;
            this.calculateEndDate();
        }

        if (dateRequestedInput) {
            const today = new Date().toISOString().split('T')[0];
            dateRequestedInput.value = today;
        }
    }

    // Calculate end date based on duration
    calculateEndDate() {
        const startDateInput = document.getElementById('dietStartDate');
        const durationInput = document.getElementById('dietDuration');
        const endDateInput = document.getElementById('dietEndDate');

        if (startDateInput && durationInput && endDateInput) {
            const startDate = new Date(startDateInput.value);
            const duration = parseInt(durationInput.value);

            if (!isNaN(duration) && duration > 0) {
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + duration - 1);
                endDateInput.value = endDate.toISOString().split('T')[0];
            } else {
                endDateInput.value = '';
            }
        }
    }

    // Setup anchor dropdown with data from C5
    setupAnchorDropdown() {
        if (!this.systemConfig || !this.systemConfig.anchors) return;

        const anchorSelect = document.getElementById('dietAnchor');
        if (!anchorSelect) return;

        // Clear existing options except the first placeholder
        anchorSelect.innerHTML = '<option value="">Select Anchor</option>';

        // Populate with anchor names from C5
        this.systemConfig.anchors.forEach(anchor => {
            const option = document.createElement('option');
            option.value = anchor.name;
            option.textContent = anchor.name;
            anchorSelect.appendChild(option);
        });

        console.log('Diet Request - Anchor dropdown populated with', this.systemConfig.anchors.length, 'options');
    }

    // Setup multi-select dropdown for "Others" field
    setupMultiSelectDropdown() {
        console.log('Diet Request - setupMultiSelectDropdown called');
        console.log('Diet Request - systemConfig:', this.systemConfig);
        console.log('Diet Request - systemConfig.others:', this.systemConfig?.others);

        if (!this.systemConfig || !this.systemConfig.others) {
            console.log('Diet Request - No system config or others data available');
            return;
        }

        const dropdown = document.getElementById('dietOthersDropdown');
        const input = document.getElementById('dietOthersInput');
        const options = document.getElementById('dietOthersOptions');
        const optionsList = options?.querySelector('.options-list');
        const searchInput = document.getElementById('dietOthersSearch');

        console.log('Diet Request - DOM elements found:', {
            dropdown: !!dropdown,
            input: !!input,
            options: !!options,
            optionsList: !!optionsList,
            searchInput: !!searchInput
        });

        if (!dropdown || !input || !options || !optionsList) {
            console.log('Diet Request - Missing required DOM elements for others dropdown');
            return;
        }

        // Populate options with names from C7
        optionsList.innerHTML = '';
        this.systemConfig.others.forEach(other => {
            // Handle both string array and object array formats
            const name = typeof other === 'string' ? other : other.name;
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option-item';
            optionDiv.innerHTML = `
                <input type="checkbox" id="diet_${name}" value="${name}">
                <label for="diet_${name}">${name}</label>
            `;
            optionsList.appendChild(optionDiv);
        });

        console.log('Diet Request - Others dropdown populated with', this.systemConfig.others.length, 'options');

        // Handle dropdown toggle
        input.addEventListener('click', () => {
            options.style.display = options.style.display === 'block' ? 'none' : 'block';
        });

        // Handle option selection
        optionsList.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.updateSelectedOptions();
            }
        });

        // Handle search
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterOptions(e.target.value);
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                options.style.display = 'none';
            }
        });
    }

    // Update selected options display
    updateSelectedOptions() {
        const optionsList = document.querySelector('#dietOthersOptions .options-list');
        const input = document.getElementById('dietOthersInput');
        const hiddenInput = document.getElementById('dietOthers');

        if (!optionsList || !input || !hiddenInput) return;

        const selectedOptions = [];
        const checkboxes = optionsList.querySelectorAll('input[type="checkbox"]:checked');

        checkboxes.forEach(checkbox => {
            selectedOptions.push(checkbox.value);
        });

        // Update display
        const placeholder = input.querySelector('.placeholder');
        if (selectedOptions.length > 0) {
            placeholder.textContent = selectedOptions.join(', ');
            placeholder.style.color = '#333';
        } else {
            placeholder.textContent = 'Select Others...';
            placeholder.style.color = '#999';
        }

        // Update hidden input
        hiddenInput.value = selectedOptions.join(', ');

        // Trigger validation
        this.validateForm();
    }

    // Filter options based on search
    filterOptions(searchTerm) {
        const optionsList = document.querySelector('#dietOthersOptions .options-list');
        if (!optionsList) return;

        const options = optionsList.querySelectorAll('.option-item');
        const term = searchTerm.toLowerCase();

        options.forEach(option => {
            const label = option.querySelector('label').textContent.toLowerCase();
            option.style.display = label.includes(term) ? 'block' : 'none';
        });
    }

    // Handle IYC number lookup
    async handleIYCLookup(iycNumber) {
        console.log('Diet Request - handleIYCLookup called with:', iycNumber);
        console.log('Diet Request - googleSheetsAPI.isInitialized:', googleSheetsAPI.isInitialized);

        const loadingIndicator = document.getElementById('dietIycLoading');
        const nameInput = document.getElementById('dietPatientName');
        const emailInput = document.getElementById('dietEmail');
        const phoneInput = document.getElementById('dietPhoneNumber');

        console.log('Diet Request - Form elements found:', {
            loadingIndicator: !!loadingIndicator,
            nameInput: !!nameInput,
            emailInput: !!emailInput,
            phoneInput: !!phoneInput
        });

        if (!iycNumber || iycNumber.trim() === '') {
            // Clear fields if IYC is empty
            if (nameInput) nameInput.value = '';
            if (emailInput) emailInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            this.validateForm();
            return;
        }

        try {
            // Show loading indicator
            if (loadingIndicator) loadingIndicator.style.display = 'block';

            console.log('Diet Request - About to call googleSheetsAPI.lookupPatientByIYC');
            // Lookup patient data
            const result = await googleSheetsAPI.lookupPatientByIYC(iycNumber.trim());
            console.log('Diet Request - API result:', result);

            if (result.found) {
                // Populate fields with found data
                if (nameInput) {
                    nameInput.value = result.name;
                    nameInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    nameInput.placeholder = 'Auto-filled from database (editable)';
                }
                if (emailInput) {
                    emailInput.value = result.email || '';
                    emailInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    emailInput.placeholder = 'Auto-filled from database (editable)';
                }
                if (phoneInput) {
                    phoneInput.value = result.phone || '';
                    phoneInput.style.backgroundColor = '#e8f5e8'; // Light green to indicate auto-filled
                    phoneInput.placeholder = 'Auto-filled from database (editable)';
                }
            } else {
                // Clear fields if not found
                if (nameInput) {
                    nameInput.value = '';
                    nameInput.style.backgroundColor = '';
                    nameInput.placeholder = 'Patient not found - enter manually';
                }
                if (emailInput) {
                    emailInput.value = '';
                    emailInput.style.backgroundColor = '';
                    emailInput.placeholder = 'Enter email manually';
                }
                if (phoneInput) {
                    phoneInput.value = '';
                    phoneInput.style.backgroundColor = '';
                    phoneInput.placeholder = 'Enter phone number manually';
                }
            }
        } catch (error) {
            console.error('Error looking up patient:', error);

            // Allow manual entry on error
            if (nameInput) {
                nameInput.style.backgroundColor = '';
                nameInput.placeholder = 'Lookup failed - enter manually';
            }
            if (emailInput) {
                emailInput.style.backgroundColor = '';
                emailInput.placeholder = 'Enter email manually';
            }
            if (phoneInput) {
                phoneInput.style.backgroundColor = '';
                phoneInput.placeholder = 'Enter phone number manually';
            }
        } finally {
            // Hide loading indicator
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            this.validateForm();
        }
    }

    // Validate form
    validateForm() {
        const form = document.getElementById('dietRequestForm');
        const saveBtn = document.getElementById('saveDietRequestBtn');

        if (!form || !saveBtn) return;

        // Collect form data
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value.trim();
        }

        // Check required fields
        const requiredFields = ['iycNumber', 'patientName', 'anchor', 'duration', 'startDate'];
        const errors = [];

        requiredFields.forEach(field => {
            if (!data[field] || data[field] === '') {
                errors.push(`${field} is required`);
            }
        });

        // Special validation for "others" field
        const othersHiddenInput = document.getElementById('dietOthers');
        if (othersHiddenInput) {
            const othersValue = othersHiddenInput.value.trim();
            if (!othersValue) {
                errors.push('Others field is required');
            }
        }

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
            this.showMessage('dietFormMessage', 'Please fill in all required fields', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveDietRequestBtn');
        const originalText = saveBtn.innerHTML;

        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            // Get selected others values
            const selectedOthers = document.getElementById('dietOthers').value;

            // Prepare diet request data
            const dietRequestData = {
                dateRequested: new Date().toISOString().split('T')[0],
                iycNumber: this.formData.iycNumber,
                patientName: this.formData.patientName,
                email: this.formData.email || '',
                phoneNumber: this.formData.phoneNumber || '',
                anchor: this.formData.anchor,
                others: selectedOthers,
                brunch: this.formData.brunch || '',
                lunch: this.formData.lunch || '',
                dinner: this.formData.dinner || '',
                oneTimeTakeaway: this.formData.oneTimeTakeaway || '',
                duration: this.formData.duration,
                startDate: this.formData.startDate,
                endDate: this.formData.endDate || '',
                remarks: this.formData.remarks || '',
                status: 'Active'
            };

            // Save to Google Sheets
            const result = await googleSheetsAPI.saveDietRequest(dietRequestData);

            if (result.success) {
                // Show initial success message
                this.showMessage('dietFormMessage', 'Diet request saved successfully! Sending email...', 'success');

                // Show loading overlay for email sending
                this.showLoadingOverlay('Sending email notification...', 'Please wait while we send the email notification.');

                // Send email notification
                try {
                    const emailResult = await googleSheetsAPI.sendDietRequestEmail(result.dietRequestId);

                    // Hide loading overlay
                    this.hideLoadingOverlay();

                    if (emailResult.success) {
                        this.showMessage('dietFormMessage', 'Diet request saved and email sent successfully!', 'success');
                        // Show success modal notification
                        this.showSuccessModal('Email sent successfully!', 'The diet request email has been sent to all recipients.');
                    } else {
                        this.showMessage('dietFormMessage', 'Diet request saved but email failed to send. Please contact administrator.', 'warning');
                        // Show error modal notification
                        this.showErrorModal('Email sending failed', 'The diet request was saved but the email could not be sent. Please contact the administrator.');
                    }
                } catch (emailError) {
                    console.error('Error sending diet request email:', emailError);
                    // Hide loading overlay
                    this.hideLoadingOverlay();
                    this.showMessage('dietFormMessage', 'Diet request saved but email failed to send. Please contact administrator.', 'warning');
                    // Show error modal notification
                    this.showErrorModal('Email sending failed', 'An error occurred while sending the email. Please contact the administrator.');
                }

                this.resetForm();
            } else {
                this.showMessage('dietFormMessage', result.message || 'Failed to save diet request', 'error');
            }

        } catch (error) {
            console.error('Error saving diet request:', error);
            this.showMessage('dietFormMessage', 'An error occurred while saving. Please try again.', 'error');
        } finally {
            // Restore button state
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    // Reset form
    resetForm() {
        const form = document.getElementById('dietRequestForm');
        if (form) {
            form.reset();

            // Clear auto-filled styling
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.style.backgroundColor = '';
            });

            // Reset multi-select dropdown
            const checkboxes = document.querySelectorAll('#dietOthersOptions input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            this.updateSelectedOptions();

            // Reset to default start date
            this.setDefaultStartDate();

            // Reset validation
            this.validateForm();

            // Clear any messages
            this.showMessage('dietFormMessage', '', '');
        }
    }

    // Load patient data for name search
    async loadPatientData() {
        try {
            console.log('Diet Request - Loading patient data...');
            const result = await googleSheetsAPI.getAllPatients();

            if (result && result.success) {
                this.patients = result.patients || [];
                console.log('Diet Request - Patient data loaded successfully:', this.patients.length, 'patients');
            } else {
                console.error('Diet Request - Failed to load patient data');
                this.patients = [];
            }
        } catch (error) {
            console.error('Diet Request - Error loading patient data:', error);
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
        const dropdown = document.getElementById('dietNameSearchDropdown');
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
        const dropdown = document.getElementById('dietNameSearchDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    // Select patient from dropdown
    selectPatient(patient) {
        const iycInput = document.getElementById('dietIycNumber');
        const nameInput = document.getElementById('dietPatientName');
        const emailInput = document.getElementById('dietEmail');
        const phoneInput = document.getElementById('dietPhoneNumber');

        if (iycInput) iycInput.value = patient.iycNumber;
        if (nameInput) {
            nameInput.value = patient.name;
            nameInput.style.backgroundColor = '#e8f5e8';
        }
        if (emailInput) {
            emailInput.value = patient.email || '';
            emailInput.style.backgroundColor = '#e8f5e8';
        }
        if (phoneInput) {
            phoneInput.value = patient.phone || '';
            phoneInput.style.backgroundColor = '#e8f5e8';
        }

        this.hideNameDropdown();
        this.validateForm();
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

    // Show success modal (like the existing success overlay)
    showSuccessModal(title, message, duration = 3000) {
        // Remove existing modal if any
        this.hideSuccessModal();

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'dietSuccessModal';
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
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 10px;
                padding: 40px 30px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
                transform: scale(0.9);
                transition: transform 0.3s ease;
            ">
                <div style="margin-bottom: 20px;">
                    <div style="
                        width: 60px;
                        height: 60px;
                        background: #28a745;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 20px;
                    ">
                        <i class="fas fa-check" style="font-size: 24px; color: white;"></i>
                    </div>
                </div>
                <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">
                    ${title}
                </div>
                <div style="font-size: 14px; color: #666; line-height: 1.4;">
                    ${message}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
            const modal = overlay.querySelector('div');
            if (modal) {
                modal.style.transform = 'scale(1)';
            }
        }, 50);

        // Auto remove
        setTimeout(() => {
            this.hideSuccessModal();
        }, duration);
    }

    // Show error modal
    showErrorModal(title, message, duration = 4000) {
        // Remove existing modal if any
        this.hideSuccessModal();

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'dietSuccessModal';
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
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 10px;
                padding: 40px 30px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
                transform: scale(0.9);
                transition: transform 0.3s ease;
            ">
                <div style="margin-bottom: 20px;">
                    <div style="
                        width: 60px;
                        height: 60px;
                        background: #dc3545;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 20px;
                    ">
                        <i class="fas fa-times" style="font-size: 24px; color: white;"></i>
                    </div>
                </div>
                <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">
                    ${title}
                </div>
                <div style="font-size: 14px; color: #666; line-height: 1.4;">
                    ${message}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
            const modal = overlay.querySelector('div');
            if (modal) {
                modal.style.transform = 'scale(1)';
            }
        }, 50);

        // Auto remove
        setTimeout(() => {
            this.hideSuccessModal();
        }, duration);
    }

    // Hide success/error modal
    hideSuccessModal() {
        const overlay = document.getElementById('dietSuccessModal');
        if (overlay) {
            overlay.style.opacity = '0';
            const modal = overlay.querySelector('div');
            if (modal) {
                modal.style.transform = 'scale(0.9)';
            }
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = '';
            }, 300);
        }
    }

    // Show loading overlay (custom implementation)
    showLoadingOverlay(message = 'Sending email...', submessage = 'Please wait while we send the email notification.') {
        // Remove existing overlay if any
        this.hideLoadingOverlay();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'dietLoadingOverlay';
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
            z-index: 9999;
        `;

        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
            ">
                <div style="margin-bottom: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #667eea;"></i>
                </div>
                <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">
                    ${message}
                </div>
                <div style="font-size: 14px; color: #666; line-height: 1.4;">
                    ${submessage}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    // Hide loading overlay
    hideLoadingOverlay() {
        const overlay = document.getElementById('dietLoadingOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
    }

    // Show section loading state
    showSectionLoading(sectionName, isLoading) {
        const messageMapping = {
            'records': 'dietRecordsMessage'
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

    // Load section data
    async loadSectionData(sectionName) {
        if (this.loadingData) return;

        this.loadingData = true;
        console.log(`Diet Request - Loading data for section: ${sectionName}`);

        try {
            if (sectionName === 'records') {
                this.showSectionLoading(sectionName, true);

                const result = await googleSheetsAPI.getDietRequests();

                if (result && result.success) {
                    this.sectionData[sectionName] = result.dietRequests || [];
                    this.renderSectionTable(sectionName);
                    this.updateSectionControls(sectionName);
                    // Clear search when data is refreshed
                    this.clearSearch();
                } else {
                    console.error('Diet Request - Failed to load records');
                    this.showMessage('dietRecordsMessage', 'Failed to load records', 'error');
                }
            }
        } catch (error) {
            console.error(`Diet Request - Error loading ${sectionName} data:`, error);
            this.showMessage(`diet${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}Message`, 'Error loading data', 'error');
        } finally {
            this.showSectionLoading(sectionName, false);
            this.loadingData = false;
        }
    }

    // Render section table
    renderSectionTable(sectionName) {
        console.log(`Diet Request - Rendering table for section: ${sectionName}`);

        if (sectionName === 'records') {
            this.renderRecordsTable();
        }
    }

    // Render records table
    renderRecordsTable() {
        const tableBody = document.querySelector('#dietRecordsTable tbody');
        if (!tableBody) return;

        const records = this.sectionData['records'] || [];

        if (records.length === 0) {
            tableBody.innerHTML = '<tr class="no-data"><td colspan="9">No diet requests found</td></tr>';
            return;
        }

        tableBody.innerHTML = records.map(record => {
            const statusClass = this.getStatusClass(record.status);
            return `
                <tr data-id="${record.id}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="diet-record-checkbox" value="${record.id}">
                    </td>
                    <td>${record.dateRequested}</td>
                    <td>${record.patientName}</td>
                    <td>${record.duration} days</td>
                    <td>${record.startDate}</td>
                    <td>${record.endDate}</td>
                    <td><span class="status-badge ${statusClass}">${record.status}</span></td>
                    <td>
                        <button class="btn-icon" onclick="dietRequestManager.viewRecord('${record.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                    <td>
                        <button class="btn-icon" onclick="dietRequestManager.renewRecord('${record.id}')" title="Renew Request">
                            <i class="fas fa-redo"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Get status class for styling
    getStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'active': return 'status-active';
            case 'completed': return 'status-completed';
            case 'cancelled': return 'status-cancelled';
            default: return 'status-active';
        }
    }

    // Update section controls
    updateSectionControls(sectionName) {
        console.log(`Diet Request - Updating controls for section: ${sectionName}`);

        if (sectionName === 'records') {
            this.updateRecordsControls();
        }
    }

    // Update records controls
    updateRecordsControls() {
        const actionBtn = document.getElementById('dietRecordsActionBtn');
        const selectedCount = this.selectedRecords['records'].size;

        if (actionBtn) {
            actionBtn.disabled = selectedCount === 0;
            actionBtn.textContent = selectedCount > 0 ?
                `Actions (${selectedCount})` : 'Actions';
        }
    }

    // Handle record selection
    handleRecordSelection(checkbox) {
        const recordId = checkbox.value;
        const isChecked = checkbox.checked;

        if (isChecked) {
            this.selectedRecords['records'].add(recordId);
        } else {
            this.selectedRecords['records'].delete(recordId);
        }

        this.updateRecordsControls();
        this.updateSelectAllState('records');
    }

    // Handle select all
    handleSelectAll(selectAllCheckbox) {
        const isChecked = selectAllCheckbox.checked;
        const checkboxes = document.querySelectorAll('.diet-record-checkbox');

        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const recordId = checkbox.value;

            if (isChecked) {
                this.selectedRecords['records'].add(recordId);
            } else {
                this.selectedRecords['records'].delete(recordId);
            }
        });

        this.updateRecordsControls();
    }

    // Update select all state
    updateSelectAllState(sectionName) {
        if (sectionName === 'records') {
            const selectAllCheckbox = document.getElementById('selectAllDietRecordsHeader');
            const checkboxes = document.querySelectorAll('.diet-record-checkbox');
            const checkedCount = document.querySelectorAll('.diet-record-checkbox:checked').length;

            if (selectAllCheckbox) {
                selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
                selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
            }
        }
    }

    // Toggle action dropdown
    toggleActionDropdown(button) {
        const dropdown = button.nextElementSibling;
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            this.closeAllDropdowns();
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    // Close all dropdowns
    closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('#diet-request-module .dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }

    // Handle bulk action
    async handleBulkAction(item) {
        const action = item.getAttribute('data-action');
        const selectedIds = Array.from(this.selectedRecords['records']);

        if (selectedIds.length === 0) {
            alert('Please select records to perform this action.');
            return;
        }

        if (action === 'delete') {
            await this.deleteRecords(selectedIds);
        }

        this.closeAllDropdowns();
    }

    // Delete records
    async deleteRecords(recordIds) {
        if (!confirm(`Are you sure you want to delete ${recordIds.length} record(s)?`)) {
            return;
        }

        try {
            const result = await googleSheetsAPI.deleteDietRequests(recordIds);

            if (result.success) {
                this.showMessage('dietRecordsMessage', `Successfully deleted ${recordIds.length} record(s)`, 'success');
                this.selectedRecords['records'].clear();
                this.loadSectionData('records');
            } else {
                this.showMessage('dietRecordsMessage', result.message || 'Failed to delete records', 'error');
            }
        } catch (error) {
            console.error('Error deleting records:', error);
            this.showMessage('dietRecordsMessage', 'An error occurred while deleting records', 'error');
        }
    }

    // View record details
    viewRecord(recordId) {
        const record = this.sectionData['records'].find(r => r.id === recordId);
        if (record) {
            // Create and show a modal with record details
            this.showRecordDetailsModal(record);
        }
    }

    // Show record details modal
    showRecordDetailsModal(record) {
        // Create modal HTML
        const modalHtml = `
            <div id="dietDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Diet Request Details</h3>
                        <span class="modal-close" onclick="dietRequestManager.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>Name:</label>
                                <span>${record.patientName}</span>
                            </div>
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <span>${record.iycNumber || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Email:</label>
                                <span>${record.email || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Phone:</label>
                                <span>${record.phoneNumber || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Anchor:</label>
                                <span>${record.anchor}</span>
                            </div>
                            <div class="detail-item">
                                <label>Others:</label>
                                <span>${record.others}</span>
                            </div>
                            <div class="detail-item">
                                <label>Duration:</label>
                                <span>${record.duration} days</span>
                            </div>
                            <div class="detail-item">
                                <label>Start Date:</label>
                                <span>${record.startDate}</span>
                            </div>
                            <div class="detail-item">
                                <label>End Date:</label>
                                <span>${record.endDate}</span>
                            </div>
                            <div class="detail-item full-width">
                                <label>Brunch:</label>
                                <span>${record.brunch || 'N/A'}</span>
                            </div>
                            <div class="detail-item full-width">
                                <label>Lunch:</label>
                                <span>${record.lunch || 'N/A'}</span>
                            </div>
                            <div class="detail-item full-width">
                                <label>Dinner:</label>
                                <span>${record.dinner || 'N/A'}</span>
                            </div>
                            <div class="detail-item full-width">
                                <label>One Time Takeaway:</label>
                                <span>${record.oneTimeTakeaway || 'N/A'}</span>
                            </div>
                            <div class="detail-item full-width">
                                <label>Remarks:</label>
                                <span>${record.remarks || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="dietRequestManager.closeModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('dietDetailsModal');
        modal.style.display = 'flex';

        // Add event listener for clicking outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('dietDetailsModal');
        if (modal) {
            modal.remove();
        }
    }

    // Renew record
    renewRecord(recordId) {
        const record = this.sectionData['records'].find(r => r.id === recordId);
        if (record) {
            this.showRenewModal(record);
        }
    }

    // Show renew modal
    showRenewModal(record) {
        // Create modal HTML with editable fields
        const modalHtml = `
            <div id="dietRenewModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Renew Diet Request</h3>
                        <span class="modal-close" onclick="dietRequestManager.closeRenewModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="details-grid">
                            <div class="detail-item">
                                <label>IYC Number:</label>
                                <input type="text" class="readonly-field" value="${record.iycNumber || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Name:</label>
                                <input type="text" class="readonly-field" value="${record.patientName}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Phone:</label>
                                <input type="text" class="readonly-field" value="${record.phoneNumber || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Email:</label>
                                <input type="text" class="readonly-field" value="${record.email || ''}" readonly>
                            </div>
                            <div class="detail-item">
                                <label>Duration (days):</label>
                                <input type="number" id="renewDuration" value="${record.duration}" min="1" max="365">
                            </div>
                            <div class="detail-item">
                                <label>Start Date:</label>
                                <input type="date" id="renewStartDate" value="${record.startDate}">
                            </div>
                            <div class="detail-item">
                                <label>End Date:</label>
                                <input type="date" id="renewEndDate" value="${record.endDate}">
                            </div>
                            <div class="detail-item">
                                <label>Anchor:</label>
                                <select id="renewAnchor">
                                    <option value="">Select Anchor</option>
                                    <option value="${record.anchor}" selected>${record.anchor}</option>
                                </select>
                            </div>
                            <div class="detail-item full-width">
                                <label>Others:</label>
                                <select id="renewOthers" multiple>
                                    <option value="Option1">Option1</option>
                                    <option value="Option2">Option2</option>
                                    <option value="Option3">Option3</option>
                                </select>
                            </div>
                            <div class="detail-item full-width">
                                <label>Brunch:</label>
                                <textarea id="renewBrunch" rows="2">${record.brunch || ''}</textarea>
                            </div>
                            <div class="detail-item full-width">
                                <label>Lunch:</label>
                                <textarea id="renewLunch" rows="2">${record.lunch || ''}</textarea>
                            </div>
                            <div class="detail-item full-width">
                                <label>Dinner:</label>
                                <textarea id="renewDinner" rows="2">${record.dinner || ''}</textarea>
                            </div>
                            <div class="detail-item full-width">
                                <label>One Time Takeaway:</label>
                                <textarea id="renewOneTimeTakeaway" rows="2">${record.oneTimeTakeaway || ''}</textarea>
                            </div>
                            <div class="detail-item full-width">
                                <label>Remarks:</label>
                                <textarea id="renewRemarks" rows="3">${record.remarks || ''}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" onclick="dietRequestManager.saveRenewal('${record.id}')">Save Renewal</button>
                        <button type="button" class="btn-secondary" onclick="dietRequestManager.closeRenewModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('dietRenewModal');
        modal.style.display = 'flex';

        // Load anchor and others options
        this.loadRenewDropdownOptions();

        // Add event listener for clicking outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeRenewModal();
            }
        });

        // Add keyboard event listener for ESC key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                this.closeRenewModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);

        // Add date change listener to auto-calculate end date
        const startDateInput = document.getElementById('renewStartDate');
        const durationInput = document.getElementById('renewDuration');
        const endDateInput = document.getElementById('renewEndDate');

        const updateEndDate = () => {
            const startDate = startDateInput.value;
            const duration = parseInt(durationInput.value);

            if (startDate && duration) {
                const start = new Date(startDate);
                const end = new Date(start);
                end.setDate(start.getDate() + duration - 1);
                endDateInput.value = end.toISOString().split('T')[0];
            }
        };

        startDateInput.addEventListener('change', updateEndDate);
        durationInput.addEventListener('change', updateEndDate);
    }

    // Close renew modal
    closeRenewModal() {
        const modal = document.getElementById('dietRenewModal');
        if (modal) {
            modal.remove();
        }
    }

    // Load dropdown options for renew modal
    async loadRenewDropdownOptions() {
        try {
            // Load anchor options from system config
            const anchorSelect = document.getElementById('renewAnchor');
            const othersSelect = document.getElementById('renewOthers');

            if (this.systemConfig) {
                // Load anchor options (C5)
                if (this.systemConfig.anchors && Array.isArray(this.systemConfig.anchors)) {
                    anchorSelect.innerHTML = '<option value="">Select Anchor</option>';
                    this.systemConfig.anchors.forEach(anchor => {
                        const option = document.createElement('option');
                        option.value = anchor.name;
                        option.textContent = anchor.name;
                        anchorSelect.appendChild(option);
                    });
                }

                // Load others options (C7)
                if (this.systemConfig.others && Array.isArray(this.systemConfig.others)) {
                    othersSelect.innerHTML = '';
                    this.systemConfig.others.forEach(other => {
                        // Handle both string array and object array formats
                        const name = typeof other === 'string' ? other : other.name;
                        const option = document.createElement('option');
                        option.value = name;
                        option.textContent = name;
                        othersSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading dropdown options:', error);
        }
    }

    // Save renewal
    async saveRenewal(originalRecordId) {
        try {
            // Get form values
            const renewalData = {
                originalRecordId: originalRecordId,
                duration: parseInt(document.getElementById('renewDuration').value),
                startDate: document.getElementById('renewStartDate').value,
                endDate: document.getElementById('renewEndDate').value,
                anchor: document.getElementById('renewAnchor').value,
                others: Array.from(document.getElementById('renewOthers').selectedOptions).map(option => option.value).join(','),
                brunch: document.getElementById('renewBrunch').value,
                lunch: document.getElementById('renewLunch').value,
                dinner: document.getElementById('renewDinner').value,
                oneTimeTakeaway: document.getElementById('renewOneTimeTakeaway').value,
                remarks: document.getElementById('renewRemarks').value
            };

            // Validate required fields
            if (!renewalData.duration || !renewalData.startDate || !renewalData.endDate) {
                alert('Please fill in all required fields (Duration, Start Date, End Date)');
                return;
            }

            // Get original record data for read-only fields
            const originalRecord = this.sectionData['records'].find(r => r.id === originalRecordId);
            if (!originalRecord) {
                alert('Original record not found');
                return;
            }

            // Create new record with original read-only data and new editable data
            const newRecord = {
                ...originalRecord,
                id: 'diet_' + Date.now(), // Generate new ID
                dateRequested: new Date().toISOString().split('T')[0], // Today's date
                duration: renewalData.duration,
                startDate: renewalData.startDate,
                endDate: renewalData.endDate,
                anchor: renewalData.anchor,
                others: renewalData.others,
                brunch: renewalData.brunch,
                lunch: renewalData.lunch,
                dinner: renewalData.dinner,
                oneTimeTakeaway: renewalData.oneTimeTakeaway,
                remarks: renewalData.remarks,
                status: 'Active' // New renewal starts as active
            };

            // Save to Google Sheets
            const result = await googleSheetsAPI.saveDietRequest(newRecord);

            if (result.success) {
                this.showMessage('dietRecordsMessage', 'Diet request renewed successfully! Sending email...', 'success');
                this.closeRenewModal();

                // Show loading overlay for email sending
                this.showLoadingOverlay('Sending renewal email notification...', 'Please wait while we send the renewal email notification.');

                // Send renewal email notification
                try {
                    const emailResult = await googleSheetsAPI.sendDietRequestEmail(result.dietRequestId);

                    // Hide loading overlay
                    this.hideLoadingOverlay();

                    if (emailResult.success) {
                        // Show success modal notification
                        this.showSuccessModal('Renewal email sent successfully!', 'The diet request renewal email has been sent to all recipients.');
                        // Refresh the records table
                        this.loadSectionData('records');
                    } else {
                        // Show error modal notification
                        this.showErrorModal('Renewal email sending failed', 'The diet request was renewed but the email could not be sent. Please contact the administrator.');
                        // Still refresh the records table since the renewal was saved
                        this.loadSectionData('records');
                    }
                } catch (emailError) {
                    console.error('Error sending renewal email:', emailError);
                    // Hide loading overlay
                    this.hideLoadingOverlay();
                    // Show error modal notification
                    this.showErrorModal('Renewal email sending failed', 'An error occurred while sending the renewal email. Please contact the administrator.');
                    // Still refresh the records table since the renewal was saved
                    this.loadSectionData('records');
                }
            } else {
                this.showMessage('dietRecordsMessage', result.message || 'Failed to renew diet request', 'error');
            }
        } catch (error) {
            console.error('Error saving renewal:', error);
            this.showMessage('dietRecordsMessage', 'An error occurred while saving the renewal', 'error');
        }
    }

    // Update patient details from form
    updatePatientDetails() {
        // Get current form data
        const formData = {
            iycNumber: document.getElementById('dietIycNumber')?.value || '',
            patientName: document.getElementById('dietPatientName')?.value || '',
            email: document.getElementById('dietEmail')?.value || '',
            phoneNumber: document.getElementById('dietPhoneNumber')?.value || ''
        };

        console.log('Diet Request - Form data for update modal:', formData);
        this.showUpdateDetailsModal(formData);
    }

    // Show update details modal
    showUpdateDetailsModal(formData) {
        // Create modal HTML with editable patient fields
        const modalHtml = `
            <div id="dietUpdateDetailsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Update Patient Details</h3>
                        <span class="modal-close" onclick="dietRequestManager.closeUpdateDetailsModal()">&times;</span>
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
                                <label>Email: <span class="required">*</span></label>
                                <input type="email" id="updatePatientEmail" value="${formData.email || ''}" required>
                            </div>
                            <div class="detail-item">
                                <label>Phone: <span class="required">*</span></label>
                                <input type="tel" id="updatePatientPhone" value="${formData.phoneNumber || ''}" required>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" onclick="dietRequestManager.savePatientDetails()">Save Changes</button>
                        <button type="button" class="btn-secondary" onclick="dietRequestManager.closeUpdateDetailsModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal with proper display
        const modal = document.getElementById('dietUpdateDetailsModal');
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
        const modal = document.getElementById('dietUpdateDetailsModal');
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
            const iycNumber = document.querySelector('#dietUpdateDetailsModal .readonly-field').value.trim();

            // Validate required fields
            if (!name || !email || !phone) {
                alert('Please fill in all required fields (Name, Email, Phone)');
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Please enter a valid email address');
                return;
            }

            // Show loading overlay
            loadingOverlay.show('Updating patient details...', 'Please wait while we save your changes to the database');

            // Prepare patient data for update
            const patientData = {
                iycNumber: iycNumber,
                name: name,
                email: email,
                phone: phone
            };

            // Update patient in database
            const result = await googleSheetsAPI.updatePatientDetails(patientData);

            if (result && result.success) {
                // Show success overlay
                loadingOverlay.showSuccess('Patient details updated successfully!', 'Your changes have been saved to the database');

                // Update the form fields with the new values
                const dietNameInput = document.getElementById('dietPatientName');
                const dietEmailInput = document.getElementById('dietEmail');
                const dietPhoneInput = document.getElementById('dietPhoneNumber');

                if (dietNameInput) dietNameInput.value = name;
                if (dietEmailInput) dietEmailInput.value = email;
                if (dietPhoneInput) dietPhoneInput.value = phone;

                this.showMessage('dietFormMessage', 'Patient details updated successfully!', 'success');
                this.closeUpdateDetailsModal();

                // Refresh the records table if we're on that section
                if (this.currentSection === 'records') {
                    this.loadSectionData('records');
                }
            } else {
                const errorMessage = result ? (result.message || 'Failed to update patient details') : 'No response from server';
                loadingOverlay.showError('Update failed', errorMessage);
                this.showMessage('dietFormMessage', errorMessage, 'error');
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
            this.showMessage('dietFormMessage', errorMessage, 'error');
        }
    }


}

// Global instance
const dietRequestManager = new DietRequestManager();

// Export for debugging
window.dietRequestManager = dietRequestManager;