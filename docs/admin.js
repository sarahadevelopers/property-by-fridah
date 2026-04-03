// =========================
// PropertyByFridah - Admin Dashboard (COMPLETE REWRITE - STABLE VERSION)
// Features: No downtime, retry logic, better error handling, image upload, modal, etc.
// =========================

// =========================
// API Configuration
// =========================
const API_BASE = 'https://propertybyfridahnew-db-user.onrender.com';
const API_ENDPOINTS = {
    properties: `${API_BASE}/api/properties`,
    propertyById: (id) => `${API_BASE}/api/properties/${id}`,
    addProperty: `${API_BASE}/api/properties/add`,
    health: `${API_BASE}/api/health`,
    apiHealth: `${API_BASE}/api/health`,
    corsTest: `${API_BASE}/api/cors-test`
};

// =========================
// DOM Elements
// =========================
const loginForm = document.getElementById('loginForm');
const loginSection = document.getElementById('loginSection');
const adminSection = document.getElementById('adminSection');
const propertyForm = document.getElementById('propertyForm');
const propertiesTable = document.getElementById('propertiesTable')?.querySelector('tbody');
const logoutBtn = document.getElementById('logoutBtn');
const imageInput = document.getElementById('images');
const imagePreview = document.getElementById('imagePreview');
const existingImagesPreview = document.getElementById('existingImagesPreview');
const formStatus = document.getElementById('formStatus');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');

// =========================
// Global State
// =========================
let currentEditId = null;
let existingImages = [];
let existingPublicIds = [];
let allProperties = [];
let features = [];
let selectedImages = [];

// =========================
// Utility Functions
// =========================
const Utils = {
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    showToast: (message, type = 'success') => {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('adminToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'adminToast';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(toast);
            
            // Add animation styles if not present
            if (!document.querySelector('#toastStyles')) {
                const style = document.createElement('style');
                style.id = 'toastStyles';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        toast.style.backgroundColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
        toast.textContent = message;
        toast.style.opacity = '1';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 3000);
    },

    formatPrice: (priceNum) => {
        if (!priceNum || priceNum === 0) return 'Price on request';
        if (priceNum >= 1000000) {
            const millions = priceNum / 1000000;
            return `KES ${millions.toFixed(1)}M`.replace('.0M', 'M');
        } else if (priceNum >= 1000) {
            return `KES ${(priceNum / 1000).toFixed(0)}K`;
        }
        return `KES ${priceNum.toLocaleString('en-KE')}`;
    },

    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// =========================
// API Service with Retry Logic
// =========================
const ApiService = {
    async request(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        ...options.headers
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error(`Request failed (attempt ${i + 1}/${retries}):`, error);
                if (i === retries - 1) throw error;
                await Utils.delay(1000 * (i + 1)); // Exponential backoff
            }
        }
    },

    get(url) {
        return this.request(url);
    },

    post(url, data, isFormData = false) {
        const options = {
            method: 'POST',
            body: data
        };
        if (!isFormData) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    },

    patch(url, data, isFormData = false) {
        const options = {
            method: 'PATCH',
            body: data
        };
        if (!isFormData) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    },

    delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
};

// =========================
// Property API
// =========================
const PropertyAPI = {
    async fetchProperties() {
        try {
            const properties = await ApiService.get(API_ENDPOINTS.properties);
            const processed = properties.map(p => this.processProperty(p));
            allProperties = processed;
            return processed;
        } catch (error) {
            console.error('Error fetching properties:', error);
            throw error;
        }
    },

    processProperty(property) {
        return {
            _id: property._id,
            id: property._id,
            title: property.title || 'Untitled',
            location: property.location || 'Unknown',
            type: property.type || 'Unknown',
            transaction: property.transaction || 'sale',
            status: property.status || 'available',
            price: property.price || Utils.formatPrice(property.priceNum),
            priceNum: property.priceNum || 0,
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            parking: property.parking || 0,
            size: property.size || '',
            description: property.description || '',
            whatsapp: property.whatsapp || '254721911181',
            images: property.images || [],
            features: property.features || [],
            createdAt: property.createdAt
        };
    },

    async getPropertyById(id) {
        const property = await ApiService.get(API_ENDPOINTS.propertyById(id));
        return this.processProperty(property);
    },

    async createProperty(formData) {
        return await ApiService.post(API_ENDPOINTS.addProperty, formData, true);
    },

    async updateProperty(id, formData) {
        return await ApiService.patch(API_ENDPOINTS.propertyById(id), formData, true);
    },

    async deleteProperty(id) {
        return await ApiService.delete(API_ENDPOINTS.propertyById(id));
    }
};

// =========================
// Image Management
// =========================
const ImageManager = {
    MAX_MB: 10,
    MAX_FILES: 20,

    init() {
        if (!imageInput) return;

        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.selectedImages = this.sanitizeFiles(files);
            this.syncInput();
            this.previewNewImages();
        });

        const clearBtn = document.getElementById('clearPreview');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.selectedImages = [];
                this.syncInput();
                if (imagePreview) imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
            });
        }
    },

    selectedImages: [],

    sanitizeFiles(files) {
        const valid = [];
        const maxBytes = this.MAX_MB * 1024 * 1024;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                Utils.showToast(`${file.name} is not an image`, 'error');
                continue;
            }
            if (file.size > maxBytes) {
                Utils.showToast(`${file.name} exceeds ${this.MAX_MB}MB`, 'error');
                continue;
            }
            valid.push(file);
            if (valid.length >= this.MAX_FILES) break;
        }
        return valid;
    },

    syncInput() {
        if (!imageInput) return;
        const dt = new DataTransfer();
        this.selectedImages.forEach(f => dt.items.add(f));
        imageInput.files = dt.files;
    },

    previewNewImages() {
        if (!imagePreview) return;

        if (!this.selectedImages.length) {
            imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
            return;
        }

        imagePreview.innerHTML = '';
        this.selectedImages.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-image';
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <span class="image-name">${file.name}</span>
                    <span class="image-size">${Utils.formatFileSize(file.size)}</span>
                    <button type="button" class="remove-selected-btn" data-index="${index}" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                div.querySelector('.remove-selected-btn')?.addEventListener('click', () => {
                    this.selectedImages.splice(index, 1);
                    this.syncInput();
                    this.previewNewImages();
                });
                imagePreview.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    },

    displayExistingImages(images, publicIds = []) {
        if (!existingImagesPreview) return;
        
        existingImages = images || [];
        existingPublicIds = publicIds || [];

        if (!existingImages.length) {
            existingImagesPreview.innerHTML = '<p class="text-muted">No existing images</p>';
            return;
        }

        existingImagesPreview.innerHTML = '';
        existingImages.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'preview-image existing';
            div.innerHTML = `
                <img src="${url}" alt="Existing image">
                <span class="image-index">${index === 0 ? '⭐ COVER' : `Image ${index + 1}`}</span>
                <button type="button" class="remove-existing-btn" data-index="${index}" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            `;
            div.querySelector('.remove-existing-btn')?.addEventListener('click', () => {
                existingImages.splice(index, 1);
                existingPublicIds.splice(index, 1);
                this.displayExistingImages(existingImages, existingPublicIds);
                FormManager.updateStatus('editing');
            });
            existingImagesPreview.appendChild(div);
        });
    },

    getFinalImages() {
        return existingImages;
    },

    getFinalPublicIds() {
        return existingPublicIds;
    },

    hasNewImages() {
        return this.selectedImages.length > 0;
    },

    getNewImages() {
        return this.selectedImages;
    }
};

// =========================
// Features Management
// =========================
const FeaturesManager = {
    init() {
        const addBtn = document.getElementById('addFeature');
        const input = document.getElementById('featureInput');
        
        if (addBtn) addBtn.addEventListener('click', () => this.addFeature());
        if (input) input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addFeature();
            }
        });
        
        this.loadFeatures();
    },

    loadFeatures() {
        const input = document.getElementById('features');
        if (input && input.value) {
            try {
                features = JSON.parse(input.value);
                this.displayFeatures();
            } catch (e) {
                features = [];
            }
        }
    },

    addFeature() {
        const input = document.getElementById('featureInput');
        const feature = input.value.trim();
        if (!feature) return;
        
        features.push(feature);
        document.getElementById('features').value = JSON.stringify(features);
        this.displayFeatures();
        input.value = '';
        input.focus();
    },

    removeFeature(index) {
        if (confirm('Remove this feature?')) {
            features.splice(index, 1);
            document.getElementById('features').value = JSON.stringify(features);
            this.displayFeatures();
        }
    },

    displayFeatures() {
        const container = document.getElementById('featuresList');
        if (!container) return;
        
        if (!features.length) {
            container.innerHTML = '<p class="text-muted">No features added yet</p>';
            return;
        }
        
        container.innerHTML = '';
        features.forEach((feature, index) => {
            const tag = document.createElement('span');
            tag.className = 'feature-tag';
            tag.innerHTML = `
                ${feature}
                <button type="button" class="remove-feature" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            tag.querySelector('.remove-feature')?.addEventListener('click', () => this.removeFeature(index));
            container.appendChild(tag);
        });
    },

    getFeatures() {
        return features;
    }
};

// =========================
// Form Management
// =========================
const FormManager = {
    reset() {
        propertyForm?.reset();
        currentEditId = null;
        existingImages = [];
        existingPublicIds = [];
        features = [];
        ImageManager.selectedImages = [];
        
        // Reset transaction buttons
        document.querySelectorAll('.transaction-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.transaction === 'sale') btn.classList.add('active');
        });
        document.getElementById('transaction').value = 'sale';
        
        document.getElementById('features').value = '[]';
        FeaturesManager.displayFeatures();
        
        formTitle.textContent = 'Add New Property';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Property';
        submitBtn.disabled = false;
        
        imageInput.value = '';
        imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
        existingImagesPreview.innerHTML = '<p class="text-muted">No existing images</p>';
        document.getElementById('propertyId').value = '';
        
        this.updateStatus('ready');
    },

    populateForEdit(property) {
        currentEditId = property._id;
        
        // Reset images
        existingImages = [...(property.images || [])];
        existingPublicIds = [];
        ImageManager.selectedImages = [];
        
        // Fill form fields
        const fields = ['title', 'location', 'type', 'status', 'price', 'bedrooms', 'bathrooms', 'parking', 'size', 'description', 'whatsapp'];
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = property[field] || (field === 'price' ? property.priceNum : '');
        });
        
        document.getElementById('price').value = property.priceNum || 0;
        
        // Set transaction
        const transaction = property.transaction || 'sale';
        document.getElementById('transaction').value = transaction;
        document.querySelectorAll('.transaction-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.transaction === transaction);
        });
        
        // Set features
        features = [...(property.features || [])];
        document.getElementById('features').value = JSON.stringify(features);
        FeaturesManager.displayFeatures();
        
        // Display existing images
        ImageManager.displayExistingImages(property.images || []);
        
        formTitle.textContent = `Edit Property: ${property.title}`;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Property';
        this.updateStatus('editing');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('title')?.focus();
    },

    updateStatus(status, message = '') {
        if (!formStatus) return;
        formStatus.style.display = 'block';
        
        switch(status) {
            case 'creating':
                formStatus.textContent = 'Creating property...';
                formStatus.className = 'alert alert-info';
                break;
            case 'updating':
                formStatus.textContent = 'Updating property...';
                formStatus.className = 'alert alert-info';
                break;
            case 'editing':
                formStatus.textContent = `Editing property: ${currentEditId}`;
                formStatus.className = 'alert alert-warning';
                break;
            case 'ready':
                formStatus.style.display = 'none';
                break;
            default:
                formStatus.textContent = message;
                formStatus.className = 'alert alert-secondary';
        }
    }
};

// =========================
// Properties Table
// =========================
const PropertiesTable = {
    render(properties) {
        if (!propertiesTable) return;
        
        if (!properties.length) {
            propertiesTable.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div class="alert alert-info">
                            <i class="fas fa-home fa-2x mb-3"></i>
                            <h5>No Properties Found</h5>
                            <p>Start by adding your first property!</p>
                            <button class="btn btn-primary mt-2" onclick="FormManager.reset()">
                                <i class="fas fa-plus"></i> Add First Property
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        propertiesTable.innerHTML = '';
        
        properties.forEach(property => {
            const tr = document.createElement('tr');
            const thumbSrc = property.images?.[0];
            
            tr.innerHTML = `
                <td><strong>${this.escapeHtml(property.title)}</strong></td>
                <td>
                    ${thumbSrc ? `
                        <div style="display:flex;align-items:center;gap:10px;">
                            <img src="${thumbSrc}" alt="thumb" style="width:44px;height:34px;object-fit:cover;border-radius:8px;cursor:pointer;"
                                 data-property-id="${property._id}" class="thumbnail-clickable">
                            <span class="badge bg-success">${property.images.length}</span>
                        </div>
                    ` : '<span class="badge bg-warning">No images</span>'}
                </td>
                <td>${this.escapeHtml(property.location)}</td>
                <td>${this.escapeHtml(property.type)}</td>
                <td>${property.transaction?.toUpperCase() || 'SALE'}</td>
                <td>${Utils.formatPrice(property.priceNum)}</td>
                <td><span class="status-badge ${property.status}">${property.status?.charAt(0).toUpperCase() + property.status?.slice(1) || 'Available'}</span></td>
                <td class="actions">
                    <button class="btn btn-outline edit-btn" data-id="${property._id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger delete-btn" data-id="${property._id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            propertiesTable.appendChild(tr);
        });
        
        this.attachEventListeners();
    },

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    },

    attachEventListeners() {
        propertiesTable.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    const property = await PropertyAPI.getPropertyById(id);
                    FormManager.populateForEdit(property);
                } catch (error) {
                    Utils.showToast('Failed to load property', 'error');
                }
            });
        });
        
        propertiesTable.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Delete this property permanently?')) return;
                
                try {
                    await PropertyAPI.deleteProperty(id);
                    Utils.showToast('Property deleted successfully');
                    await this.loadAndRender();
                    if (currentEditId === id) FormManager.reset();
                } catch (error) {
                    Utils.showToast('Failed to delete property', 'error');
                }
            });
        });
        
        propertiesTable.querySelectorAll('.thumbnail-clickable').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const id = thumb.dataset.propertyId;
                const property = allProperties.find(p => p._id === id);
                if (property?.images?.length) {
                    ImageModal.open(property.images);
                }
            });
        });
    },

    async loadAndRender() {
        PropertiesTable.showLoading();
        try {
            const properties = await PropertyAPI.fetchProperties();
            this.render(properties);
        } catch (error) {
            this.showError(error.message);
        }
    },

    showLoading() {
        if (!propertiesTable) return;
        propertiesTable.innerHTML = '<tr><td colspan="8" class="text-center"><div class="spinner-border text-primary"></div><p class="mt-2">Loading...</p></td></tr>';
    },

    showError(error) {
        if (!propertiesTable) return;
        propertiesTable.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error}</td></tr>`;
    }
};

// =========================
// Image Modal
// =========================
const ImageModal = {
    modal: null,
    images: [],
    currentIndex: 0,

    init() {
        this.modal = document.getElementById('imageModal');
        if (!this.modal) return;
        
        document.querySelector('.modal-close')?.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
        document.getElementById('modalPrev')?.addEventListener('click', () => this.prev());
        document.getElementById('modalNext')?.addEventListener('click', () => this.next());
    },

    open(images, startIndex = 0) {
        if (!images?.length) return;
        this.images = images;
        this.currentIndex = startIndex;
        this.updateImage();
        this.modal.classList.add('show');
    },

    close() {
        this.modal.classList.remove('show');
    },

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateImage();
    },

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.updateImage();
    },

    updateImage() {
        const img = document.getElementById('modalImage');
        const counter = document.getElementById('modalCounter');
        if (img) img.src = this.images[this.currentIndex];
        if (counter) counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }
};

// =========================
// Form Submission Handler
// =========================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validation
    const title = document.getElementById('title')?.value.trim();
    const location = document.getElementById('location')?.value;
    const type = document.getElementById('type')?.value;
    const price = parseFloat(document.getElementById('price')?.value || 0);
    
    if (!title) { Utils.showToast('Title is required', 'error'); return; }
    if (!location) { Utils.showToast('Location is required', 'error'); return; }
    if (!type) { Utils.showToast('Property type is required', 'error'); return; }
    if (isNaN(price) || price <= 0) { Utils.showToast('Valid price is required', 'error'); return; }
    
    // Create or update
    const formData = new FormData();
    formData.append('title', title);
    formData.append('location', location);
    formData.append('type', type.toLowerCase());
    formData.append('transaction', document.getElementById('transaction')?.value || 'sale');
    formData.append('status', document.getElementById('status')?.value || 'available');
    formData.append('priceNum', price);
    formData.append('bedrooms', document.getElementById('bedrooms')?.value || 0);
    formData.append('bathrooms', document.getElementById('bathrooms')?.value || 0);
    formData.append('parking', document.getElementById('parking')?.value || 0);
    formData.append('size', document.getElementById('size')?.value || '');
    formData.append('description', document.getElementById('description')?.value || '');
    formData.append('whatsapp', document.getElementById('whatsapp')?.value || '254721911181');
    formData.append('features', JSON.stringify(features));
    
    // Add images
    ImageManager.getNewImages().forEach(file => formData.append('images', file));
    
    // Add existing images info for updates
    if (currentEditId) {
        formData.append('existingImages', JSON.stringify(existingImages));
        formData.append('existingPublicIds', JSON.stringify(existingPublicIds));
    }
    
    submitBtn.disabled = true;
    const action = currentEditId ? 'updating' : 'creating';
    FormManager.updateStatus(action);
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${action === 'updating' ? 'Updating...' : 'Creating...'}`;
    
    try {
        if (currentEditId) {
            await PropertyAPI.updateProperty(currentEditId, formData);
            Utils.showToast('Property updated successfully');
        } else {
            await PropertyAPI.createProperty(formData);
            Utils.showToast('Property created successfully');
        }
        
        FormManager.reset();
        await PropertiesTable.loadAndRender();
    } catch (error) {
        console.error('Save error:', error);
        Utils.showToast(error.message || 'Failed to save property', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = currentEditId ? '<i class="fas fa-save"></i> Update Property' : '<i class="fas fa-save"></i> Create Property';
        FormManager.updateStatus('ready');
    }
}

// =========================
// Transaction Buttons
// =========================
const TransactionManager = {
    init() {
        document.querySelectorAll('.transaction-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.transaction-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('transaction').value = btn.dataset.transaction;
            });
        });
    }
};

// =========================
// Authentication
// =========================
const Auth = {
    login(e) {
        e.preventDefault();
        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;
        
        // Simple auth - you can change credentials here
        if (username === 'admin' && password === 'password123') {
            localStorage.setItem('adminLoggedIn', 'true');
            loginSection.style.display = 'none';
            adminSection.style.display = 'block';
            PropertiesTable.loadAndRender();
            FormManager.reset();
        } else {
            Utils.showToast('Invalid credentials', 'error');
        }
    },

    logout() {
        localStorage.removeItem('adminLoggedIn');
        loginSection.style.display = 'block';
        adminSection.style.display = 'none';
        FormManager.reset();
    },

    checkAuth() {
        return localStorage.getItem('adminLoggedIn') === 'true';
    }
};

// =========================
// Initialization
// =========================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize all modules
    ImageManager.init();
    FeaturesManager.init();
    TransactionManager.init();
    ImageModal.init();
    FormManager.updateStatus('ready');
    
    // Setup event listeners
    loginForm?.addEventListener('submit', (e) => Auth.login(e));
    logoutBtn?.addEventListener('click', () => Auth.logout());
    propertyForm?.addEventListener('submit', handleFormSubmit);
    document.getElementById('resetForm')?.addEventListener('click', () => FormManager.reset());
    
    // Check authentication
    if (Auth.checkAuth()) {
        loginSection.style.display = 'none';
        adminSection.style.display = 'block';
        await PropertiesTable.loadAndRender();
    } else {
        loginSection.style.display = 'block';
        adminSection.style.display = 'none';
    }
});

// Make FormManager globally accessible for inline buttons
window.FormManager = FormManager;