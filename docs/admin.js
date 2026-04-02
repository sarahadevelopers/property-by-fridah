// =========================
// PropertyByFridah - Admin Dashboard (FIXED + Image Modal + Reorder + Cover Fix)
// =========================

// API Configuration
const API_BASE = 'https://property-by-fridah.onrender.com';
const API_ENDPOINTS = {
    properties: `${API_BASE}/api/properties`,
    propertyById: (id) => `${API_BASE}/api/properties/${id}`,
    addProperty: `${API_BASE}/api/properties/add`,
    health: `${API_BASE}/api/health`,
    apiHealth: `${API_BASE}/api/health`
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
let allProperties = [];          // will always hold processed frontend objects
let features = [];
let selectedImages = [];         // files user has chosen (sanitised)

// =========================
// Public API for property.js frontend
// =========================
window.PropertyAdminAPI = {
    // Get all properties (public method for other pages)
    getAllProperties: async function() {
        try {
            const response = await this._makeRequest(API_ENDPOINTS.properties);
            // If backend returns paginated object { items, total, ... }, extract items
            const list = Array.isArray(response) ? response : (response.items || []);
            // Process properties to match frontend structure AND store them
            const processed = list.map(property => this._processForFrontend(property));
            allProperties = processed;   // ✅ now allProperties is always processed
            return processed;
        } catch (error) {
            console.error('PropertyAdminAPI: Error fetching properties:', error);
            throw error;
        }
    },

    // Process property data for frontend consumption
    _processForFrontend: function(property) {
        // Normalize data to match frontend expectations
        const normalizedProperty = {
            _id: property._id || property.id,
            title: property.title || 'Untitled Property',
            location: property.location || 'unknown',
            type: property.type || 'unknown',
            transaction: property.transaction || 'sale',
            status: property.status || 'available',
            price: property.price || 'Price on request',
            priceNum: property.priceNum || this._extractPriceNumber(property),
            priceDisplay: this._formatPriceDisplay(property),
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            parking: property.parking || 0,
            size: property.size || property.area || '',
            description: property.description || 'No description available',
            whatsapp: property.whatsapp || '254721911181',
            images: Array.isArray(property.images) ? 
                property.images.map(img => this._normalizeImageUrl(img)) : [],
            features: Array.isArray(property.features) ? property.features : [],
            amenities: Array.isArray(property.amenities) ? property.amenities : [],
            createdAt: property.createdAt || new Date().toISOString()
        };

        // Ensure transaction is either 'sale' or 'rent' (map 'lease' to 'rent')
        if (normalizedProperty.transaction === 'lease') {
            normalizedProperty.transaction = 'rent';
        }

        return normalizedProperty;
    },

    // Extract price number (same logic as frontend)
    _extractPriceNumber: function(property) {
        // if already numeric
        if (property.priceNum !== undefined && property.priceNum !== null) {
            const n = Number(property.priceNum);
            return Number.isFinite(n) ? n : 0;
        }

        if (!property.price) return 0;

        const raw = String(property.price).toLowerCase().trim();

        // Remove common period words BEFORE parsing so "month" doesn't trigger "m"
        const cleaned = raw
            .replace(/\/\s*(month|mo|week|wk|day|yr|year)\b/g, '')
            .replace(/\b(per|a)\s*(month|mo|week|wk|day|yr|year)\b/g, '')
            .replace(/\b(monthly|weekly|daily|yearly|annum)\b/g, '')
            .trim();

        // Extract first number + optional suffix M/K right after the number
        const match = cleaned.match(/(\d[\d,]*\.?\d*)\s*([mk])?\b/);
        if (!match) return 0;

        let num = parseFloat(match[1].replace(/,/g, ''));
        if (!Number.isFinite(num)) return 0;

        const suffix = match[2];
        if (suffix === 'm') num *= 1_000_000;
        if (suffix === 'k') num *= 1_000;

        return num;
    },

    // Normalize image URL (same as property.js)
    _normalizeImageUrl: function(src) {
        if (!src) return this._getPlaceholderImage();
        if (src.startsWith('http://') || src.startsWith('https://')) {
            // Cloudinary optimization
            if (src.includes('res.cloudinary.com')) {
                return src.replace('/upload/', '/upload/f_auto,q_auto,w_900,c_fill,g_auto/');
            }
            return src;
        }
        if (src.startsWith('/')) return `${API_BASE}${src}`;
        return `${API_BASE}/${src}`;
    },

    // Get placeholder image (same as property.js)
    _getPlaceholderImage: function(type = '') {
        const images = {
            'bungalow': 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'apartment': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'land-res': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'warehouse': 'https://images.unsplash.com/photo-1487956382158-bb926046304a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'office': 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        return images[type] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    },

    // Format price for display (same as property.js)
    _formatPriceDisplay: function(property) {
        const amount = property.priceNum || this._extractPriceNumber(property);
        const transaction = property.transaction || 'sale';
        const rawPrice = property.price || '';
        return this._formatPrice(amount, transaction, rawPrice);
    },

    // Format price (same as property.js)
    _formatPrice: function(amount, transaction = 'sale', rawPrice = '') {
        if (!amount || amount === 0) return 'Price on request';
        
        const tx = (transaction || 'sale').toLowerCase();
        
        // Rent / Lease: show full number
        if (tx === 'rent' || tx === 'lease') {
            const period = this._detectPeriod(rawPrice);
            return `KES ${Math.round(amount).toLocaleString('en-KE')}${period}`;
        }
        
        // Sale: M/K format
        if (amount >= 1000000) {
            const millions = amount / 1000000;
            const formatted = millions % 1 === 0 ? 
                millions.toFixed(0) : 
                millions.toFixed(1).replace(/\.0$/, '');
            return `KES ${formatted}M`;
        } else if (amount >= 1000) {
            return `KES ${(amount / 1000).toFixed(0)}K`;
        }
        
        return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
    },

    // Detect period (same as property.js)
    _detectPeriod: function(rawPrice = '') {
        const s = (rawPrice || '').toLowerCase();

        if (s.includes('/month') || s.includes('per month') || s.includes('monthly')) return ' / month';
        if (s.includes('/week')  || s.includes('per week')  || s.includes('weekly'))  return ' / week';
        if (s.includes('/day')   || s.includes('per day')   || s.includes('daily'))   return ' / day';
        if (s.includes('/year')  || s.includes('per year')  || s.includes('yearly') || s.includes('annum')) return ' / year';

        return ''; // don’t default to / month
    },

    // Get property by ID
    getPropertyById: async function(id) {
        try {
            const property = await this._makeRequest(API_ENDPOINTS.propertyById(id));
            return this._processForFrontend(property);
        } catch (error) {
            console.error(`PropertyAdminAPI: Error fetching property ${id}:`, error);
            throw error;
        }
    },

    // Get filtered properties
    getProperties: function(filters = {}) {
        let filtered = [...allProperties];
        
        if (filters.type) {
            filtered = filtered.filter(p => p.type === filters.type);
        }
        
        if (filters.location) {
            filtered = filtered.filter(p => 
                p.location.toLowerCase().includes(filters.location.toLowerCase())
            );
        }
        
        if (filters.transaction) {
            filtered = filtered.filter(p => p.transaction === filters.transaction);
        }
        
        if (filters.minPrice) {
            filtered = filtered.filter(p => 
                (p.priceNum || 0) >= filters.minPrice
            );
        }
        
        if (filters.maxPrice) {
            filtered = filtered.filter(p => 
                (p.priceNum || 0) <= filters.maxPrice
            );
        }
        
        if (filters.status) {
            filtered = filtered.filter(p => p.status === filters.status);
        }
        
        return filtered;
    },

    // Check server health
    checkServerHealth: async function() {
        try {
            const response = await fetch(API_ENDPOINTS.health);
            return response.ok;
        } catch {
            return false;
        }
    },

    // Private method for making requests
    _makeRequest: async function(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
};

// =========================
// Utility Functions (for Admin Dashboard only)
// =========================
const Utils = {
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Simple price formatting for admin table (not the same as frontend)
    formatPrice: (price) => {
        if (!price || price === 0) return 'Price on request';
        if (price >= 1000000) {
            const millions = price / 1000000;
            const formatted = millions % 1 === 0 ? 
                millions.toFixed(0) : 
                millions.toFixed(1).replace(/\.0$/, '');
            return `KES ${formatted}M`;
        } else if (price >= 1000) {
            return `KES ${(price / 1000).toFixed(0)}K`;
        }
        return `KES ${price.toLocaleString('en-KE')}`;
    },

    createPropertyCard: (property) => {
        const processedProperty = window.PropertyAdminAPI._processForFrontend(property);
        
        return {
            id: processedProperty._id,
            title: processedProperty.title || 'Untitled Property',
            location: processedProperty.location || 'Location not specified',
            type: processedProperty.type ? processedProperty.type.charAt(0).toUpperCase() + processedProperty.type.slice(1) : 'N/A',
            transaction: processedProperty.transaction || 'sale',
            price: processedProperty.priceDisplay || 'KES N/A', // Use priceDisplay from frontend
            priceNum: processedProperty.priceNum || 0,
            status: processedProperty.status || 'available',
            images: processedProperty.images || [],
            bedrooms: processedProperty.bedrooms || 0,
            bathrooms: processedProperty.bathrooms || 0,
            parking: processedProperty.parking || 0,
            size: processedProperty.size || '',
            description: processedProperty.description || '',
            whatsapp: processedProperty.whatsapp || '',
            features: processedProperty.features || [],
            amenities: processedProperty.amenities || [],
            createdAt: processedProperty.createdAt || new Date().toISOString()
        };
    },

    // Format price for display in table (use frontend formatting)
    getPriceDisplay: (property) => {
        return window.PropertyAdminAPI._formatPriceDisplay(property);
    }
};

// =========================
// Image Management (with reorder and cover indicator)
// =========================
// =========================
// Image Management (with reorder, cover indicator, and publicId sync)
// =========================
const ImageManager = {
  MAX_MB: 10,
  MAX_FILES: 20,

  init: () => {
    if (!imageInput) return;

    imageInput.addEventListener("change", (e) => {
      const raw = Array.from(e.target.files || []);
      selectedImages = ImageManager.sanitizeFiles(raw);
      ImageManager.syncInputWithSelected();
      ImageManager.previewImages(selectedImages);
    });

    const clearPreviewBtn = document.getElementById("clearPreview");
    if (clearPreviewBtn) {
      clearPreviewBtn.addEventListener("click", () => {
        selectedImages = [];
        ImageManager.syncInputWithSelected();
        if (imagePreview) imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
      });
    }
  },

  sanitizeFiles: (files) => {
    if (files.length > ImageManager.MAX_FILES) {
      alert(`You selected ${files.length} images. Only the first ${ImageManager.MAX_FILES} will be used.`);
    }

    const ok = [];
    const maxBytes = ImageManager.MAX_MB * 1024 * 1024;

    for (const f of files) {
      if (!f.type || !f.type.startsWith("image/")) {
        alert(`"${f.name}" is not an image. It was removed.`);
        continue;
      }

      if (f.size > maxBytes) {
        alert(`"${f.name}" is too large (${Utils.formatFileSize(f.size)}). Max is ${ImageManager.MAX_MB}MB. It was removed.`);
        continue;
      }

      ok.push(f);
      if (ok.length >= ImageManager.MAX_FILES) break;
    }

    return ok;
  },

  syncInputWithSelected: () => {
    if (!imageInput) return;
    const dt = new DataTransfer();
    (selectedImages || []).forEach((f) => dt.items.add(f));
    imageInput.files = dt.files;
  },

  // ----- Newly selected images (files) -----
  removeSelectedImage: (index) => {
    if (!Array.isArray(selectedImages)) selectedImages = [];
    if (index < 0 || index >= selectedImages.length) return;

    selectedImages.splice(index, 1);
    ImageManager.syncInputWithSelected();
    ImageManager.previewImages(selectedImages);
  },

  moveSelectedImage: (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedImages.length) return;

    [selectedImages[index], selectedImages[newIndex]] = [selectedImages[newIndex], selectedImages[index]];
    ImageManager.syncInputWithSelected();
    ImageManager.previewImages(selectedImages);
  },

  previewImages: (files) => {
    if (!imagePreview) return;

    if (!files || files.length === 0) {
      imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
      return;
    }

    imagePreview.innerHTML = "";

    files.forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const div = document.createElement("div");
        div.className = "preview-image";
        div.dataset.index = index;
        const coverLabel = index === 0 ? "⭐ COVER — " : "";
        div.innerHTML = `
          <img src="${e.target.result}" alt="Preview ${index + 1}">
          <span class="image-name">${coverLabel}${file.name}</span>
          <span class="image-size">${Utils.formatFileSize(file.size)}</span>
          <div class="reorder-buttons">
            <button type="button" class="reorder-btn up-btn" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
              <i class="fas fa-chevron-up"></i>
            </button>
            <button type="button" class="reorder-btn down-btn" data-index="${index}" ${index === files.length-1 ? 'disabled' : ''}>
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <button type="button" class="remove-selected-btn" data-index="${index}" title="Remove this image">
            <i class="fas fa-times"></i>
          </button>
        `;

        div.querySelector(".up-btn").addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const idx = Number(ev.currentTarget.dataset.index);
          ImageManager.moveSelectedImage(idx, -1);
        });

        div.querySelector(".down-btn").addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const idx = Number(ev.currentTarget.dataset.index);
          ImageManager.moveSelectedImage(idx, 1);
        });

        div.querySelector(".remove-selected-btn").addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const idx = Number(ev.currentTarget.dataset.index);
          ImageManager.removeSelectedImage(idx);
        });

        imagePreview.appendChild(div);
      };

      reader.readAsDataURL(file);
    });
  },

  // ----- Existing images (URLs + publicIds) -----
  // NEW: store both arrays
  existingImages: [],      // URLs
  existingPublicIds: [],   // Cloudinary public IDs (in same order)

  displayExistingImages: (images, publicIds = []) => {
    if (!existingImagesPreview) return;

    // Store both arrays
    ImageManager.existingImages = Array.isArray(images) ? [...images] : [];
    ImageManager.existingPublicIds = Array.isArray(publicIds) ? [...publicIds] : [];

    if (ImageManager.existingImages.length === 0) {
      existingImagesPreview.innerHTML = '<p class="text-muted">No existing images</p>';
      return;
    }

    existingImagesPreview.innerHTML = "";

    ImageManager.existingImages.forEach((url, index) => {
      const div = document.createElement("div");
      div.className = "preview-image existing";
      div.dataset.index = index;
      const coverLabel = index === 0 ? "⭐ COVER" : `Image ${index + 1}`;
      div.innerHTML = `
        <img src="${url}" alt="Existing image ${index + 1}">
        <span class="image-index">${coverLabel}</span>
        <div class="reorder-buttons">
          <button type="button" class="reorder-btn up-btn" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
            <i class="fas fa-chevron-up"></i>
          </button>
          <button type="button" class="reorder-btn down-btn" data-index="${index}" ${index === ImageManager.existingImages.length-1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
        <button type="button" class="remove-existing-btn" data-index="${index}" title="Remove this image">
          <i class="fas fa-times"></i>
        </button>
      `;

      // Up button
      div.querySelector(".up-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(e.currentTarget.dataset.index);
        ImageManager.moveExistingImage(idx, -1);
      });

      // Down button
      div.querySelector(".down-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(e.currentTarget.dataset.index);
        ImageManager.moveExistingImage(idx, 1);
      });

      // Remove button
      div.querySelector(".remove-existing-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(e.currentTarget.dataset.index);
        ImageManager.removeExistingImage(idx);
      });

      existingImagesPreview.appendChild(div);
    });
  },

  // Move an existing image (swap both arrays)
  moveExistingImage: (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= ImageManager.existingImages.length) return;

    // Swap URLs
    [ImageManager.existingImages[index], ImageManager.existingImages[newIndex]] =
      [ImageManager.existingImages[newIndex], ImageManager.existingImages[index]];

    // Swap publicIds
    [ImageManager.existingPublicIds[index], ImageManager.existingPublicIds[newIndex]] =
      [ImageManager.existingPublicIds[newIndex], ImageManager.existingPublicIds[index]];

    // Re-render previews
    ImageManager.displayExistingImages(ImageManager.existingImages, ImageManager.existingPublicIds);

    // Notify form that editing state changed
    FormManager.updateStatus('editing');
  },

  // Remove an existing image (from both arrays)
  removeExistingImage: (index) => {
    if (confirm("Remove this image from the property?")) {
      ImageManager.existingImages.splice(index, 1);
      ImageManager.existingPublicIds.splice(index, 1);
      ImageManager.displayExistingImages(ImageManager.existingImages, ImageManager.existingPublicIds);
      FormManager.updateStatus("editing");
    }
  }
};

// =========================
// Image Preview Modal
// =========================
const ImageModal = {
  modal: null,
  modalImage: null,
  modalPrev: null,
  modalNext: null,
  modalCounter: null,
  currentImages: [],
  currentIndex: 0,

  init: () => {
    ImageModal.modal = document.getElementById('imageModal');
    if (!ImageModal.modal) return;

    ImageModal.modalImage = document.getElementById('modalImage');
    ImageModal.modalPrev = document.getElementById('modalPrev');
    ImageModal.modalNext = document.getElementById('modalNext');
    ImageModal.modalCounter = document.getElementById('modalCounter');

    // Close on X click
    document.querySelector('.modal-close').addEventListener('click', ImageModal.close);

    // Close on outside click
    ImageModal.modal.addEventListener('click', (e) => {
      if (e.target === ImageModal.modal) ImageModal.close();
    });

    // Prev/Next buttons
    ImageModal.modalPrev.addEventListener('click', ImageModal.prev);
    ImageModal.modalNext.addEventListener('click', ImageModal.next);
  },

  open: (images, startIndex = 0) => {
    if (!images || images.length === 0) return;
    ImageModal.currentImages = images;
    ImageModal.currentIndex = startIndex;
    ImageModal.updateImage();
    ImageModal.modal.classList.add('show');
  },

  close: () => {
    ImageModal.modal.classList.remove('show');
  },

  next: () => {
    if (ImageModal.currentImages.length === 0) return;
    ImageModal.currentIndex = (ImageModal.currentIndex + 1) % ImageModal.currentImages.length;
    ImageModal.updateImage();
  },

  prev: () => {
    if (ImageModal.currentImages.length === 0) return;
    ImageModal.currentIndex = (ImageModal.currentIndex - 1 + ImageModal.currentImages.length) % ImageModal.currentImages.length;
    ImageModal.updateImage();
  },

  updateImage: () => {
    if (!ImageModal.modalImage || !ImageModal.modalCounter) return;
    ImageModal.modalImage.src = ImageModal.currentImages[ImageModal.currentIndex];
    ImageModal.modalCounter.textContent = `${ImageModal.currentIndex + 1} / ${ImageModal.currentImages.length}`;
  }
};

// =========================
// Form Management
// =========================
const FormManager = {
    updateStatus: (status, message = '') => {
        if (!formStatus) return;
        
        formStatus.style.display = 'block';
        
        switch(status) {
            case 'creating':
                formStatus.textContent = 'Creating new property...';
                formStatus.className = 'alert alert-info';
                break;
            case 'editing':
                formStatus.textContent = `Editing property ID: ${currentEditId}`;
                formStatus.className = 'alert alert-warning';
                break;
            case 'ready':
                formStatus.style.display = 'none';
                break;
            default:
                formStatus.textContent = message;
                formStatus.className = 'alert alert-secondary';
        }
    },

    reset: () => {
        if (propertyForm) propertyForm.reset();
        currentEditId = null;
        existingImages = [];
        features = [];
        
        // Reset transaction buttons
        document.querySelectorAll('.transaction-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.transaction === 'sale') {
                btn.classList.add('active');
            }
        });
        document.getElementById('transaction').value = 'sale';
        
        // Reset features
        document.getElementById('features').value = '[]';
        FeaturesManager.displayFeatures();
        
        if (formTitle) formTitle.textContent = 'Add New Property';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Property';
            submitBtn.disabled = false;
        }
        
        // Clear selected uploads
        selectedImages = [];
        if (imageInput) {
            imageInput.value = '';
            // Also clear the DataTransfer
            const dt = new DataTransfer();
            imageInput.files = dt.files;
        }

        // Reset previews
        if (imagePreview) imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
        if (existingImagesPreview) existingImagesPreview.innerHTML = '<p class="text-muted">No existing images</p>';
        document.getElementById('propertyId').value = '';
        FormManager.updateStatus('ready');
    },

    populateForEdit: (property) => {
        const processedProperty = window.PropertyAdminAPI._processForFrontend(property);

        // Clear any previously selected new uploads
        selectedImages = [];
        if (imageInput) {
            imageInput.value = '';
            const dt = new DataTransfer();
            imageInput.files = dt.files;
        }
        if (imagePreview) imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';

        const fields = {
            propertyId: currentEditId,
            title: processedProperty.title || '',
            location: processedProperty.location || '',
            type: processedProperty.type || '',
            status: processedProperty.status || 'available',
            price: processedProperty.priceNum || 0,
            bedrooms: processedProperty.bedrooms ?? 0,
            bathrooms: processedProperty.bathrooms ?? 0,
            parking: processedProperty.parking ?? 0,
            size: processedProperty.size || '',
            description: processedProperty.description || '',
            whatsapp: processedProperty.whatsapp || '254721911181'
        };

        Object.entries(fields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });

        // Set transaction
        const transaction = processedProperty.transaction || 'sale';
        const txInput = document.getElementById('transaction');
        if (txInput) txInput.value = transaction;

        document.querySelectorAll('.transaction-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.transaction === transaction);
        });

        // Set features
        features = processedProperty.features || processedProperty.amenities || [];
        const featuresInput = document.getElementById('features');
        if (featuresInput) featuresInput.value = JSON.stringify(features);
        FeaturesManager.displayFeatures();

        // Existing images preview
        ImageManager.displayExistingImages(Array.isArray(processedProperty.images) ? processedProperty.images : []);

        // UI
        if (formTitle) formTitle.textContent = `Edit Property: ${processedProperty.title || 'Property'}`;
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Property';

        FormManager.updateStatus('editing');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        const titleEl = document.getElementById('title');
        if (titleEl) titleEl.focus();
    }
};

// =========================
// Features Management
// =========================
const FeaturesManager = {
    init: () => {
        const addFeatureBtn = document.getElementById('addFeature');
        if (addFeatureBtn) {
            addFeatureBtn.addEventListener('click', FeaturesManager.addFeature);
        }
        
        const featureInput = document.getElementById('featureInput');
        if (featureInput) {
            featureInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    FeaturesManager.addFeature();
                }
            });
        }
        
        // Load features from hidden input
        const featuresInput = document.getElementById('features');
        if (featuresInput && featuresInput.value) {
            try {
                features = JSON.parse(featuresInput.value);
                FeaturesManager.displayFeatures();
            } catch (e) {
                console.error('Error parsing features:', e);
                features = [];
            }
        }
    },
    
    addFeature: () => {
        const featureInput = document.getElementById('featureInput');
        const feature = featureInput.value.trim();
        
        if (!feature) return;
        
        features.push(feature);
        document.getElementById('features').value = JSON.stringify(features);
        FeaturesManager.displayFeatures();
        featureInput.value = '';
        featureInput.focus();
    },
    
    removeFeature: (index) => {
        if (confirm('Remove this feature?')) {
            features.splice(index, 1);
            document.getElementById('features').value = JSON.stringify(features);
            FeaturesManager.displayFeatures();
        }
    },
    
    displayFeatures: () => {
        const featuresList = document.getElementById('featuresList');
        if (!featuresList) return;
        
        featuresList.innerHTML = '';
        
        if (features.length === 0) {
            featuresList.innerHTML = '<p class="text-muted" style="font-size: 14px; padding: 10px; color: #6c757d;">No features added yet</p>';
            return;
        }
        
        features.forEach((feature, index) => {
            const span = document.createElement('span');
            span.className = 'feature-tag';
            span.innerHTML = `
                ${feature}
                <button type="button" class="remove-feature" data-index="${index}" title="Remove feature">
                    <i class="fas fa-times"></i>
                </button>
            `;
            featuresList.appendChild(span);
        });
        
        // Add event listeners for remove buttons
        featuresList.querySelectorAll('.remove-feature').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                FeaturesManager.removeFeature(index);
            });
        });
    }
};

// =========================
// Properties Table Management (with cover as first image)
// =========================
const PropertiesTable = {
    render: (properties) => {
        if (!propertiesTable) return;
        
        if (!Array.isArray(properties) || properties.length === 0) {
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
                </tr>`;
            return;
        }
        
        propertiesTable.innerHTML = '';
        
        properties.forEach(property => {
            const propertyCard = Utils.createPropertyCard(property);
            
            const tr = document.createElement('tr');
            // Use the FIRST image as thumbnail (cover)
            const thumbSrc = propertyCard.images.length > 0 ? propertyCard.images[0] : null;
            tr.innerHTML = `
                <td>${propertyCard.title}</td>
                <td>
                    ${thumbSrc ? 
                        `<div style="display:flex;align-items:center;gap:10px;">
                            <img
                                src="${thumbSrc}"
                                alt="thumb"
                                style="width:44px;height:34px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;cursor:pointer;"
                                loading="lazy"
                                data-property-id="${propertyCard.id}"
                                class="thumbnail-clickable"
                                onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&q=60';"
                            />
                            <span class="badge bg-success">${propertyCard.images.length}</span>
                        </div>`
                    : `<span class="badge bg-warning">No images</span>`}
                </td>
                <td>${propertyCard.location}</td>
                <td>${propertyCard.type}</td>
                <td>${propertyCard.transaction.toUpperCase()}</td>
                <td>${propertyCard.price}</td>
                <td><span class="status-badge ${propertyCard.status}">${propertyCard.status.charAt(0).toUpperCase() + propertyCard.status.slice(1)}</span></td>
                
                <td class="actions">
                    <button class="btn btn-outline edit-btn" data-id="${propertyCard.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger delete-btn" data-id="${propertyCard.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            propertiesTable.appendChild(tr);
        });
        
        PropertiesTable.attachEventListeners();
    },

    attachEventListeners: () => {
        if (!propertiesTable) return;

        propertiesTable.addEventListener('click', (e) => {
            // Handle buttons
            const btn = e.target.closest('button');
            if (btn) {
                const id = btn.dataset.id;
                if (!id) return;
                if (btn.classList.contains('edit-btn')) {
                    PropertyAPI.editProperty(id);
                } else if (btn.classList.contains('delete-btn')) {
                    PropertyAPI.deleteProperty(id);
                }
                return;
            }

            // Handle thumbnail click for modal – open at first image (index 0)
            const thumb = e.target.closest('.thumbnail-clickable');
            if (thumb) {
                const propertyId = thumb.dataset.propertyId;
                const property = allProperties.find(p => p._id === propertyId || p.id === propertyId);
                if (property && property.images && property.images.length > 0) {
                    ImageModal.open(property.images, 0); // ✅ start at cover
                }
            }
        });
    },

    showLoading: () => {
        if (!propertiesTable) return;
        
        propertiesTable.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading properties...</p>
                </td>
            </tr>`;
    },

    showError: (error) => {
        if (!propertiesTable) return;
        
        let errorHtml = '';
        if (error.includes('MongoDB') || error.includes('whitelist')) {
            errorHtml = `
                <div class="alert alert-danger">
                    <h5><i class="fas fa-database"></i> Database Connection Error</h5>
                    <p>${error}</p>
                    <p class="mt-3"><strong>Fix this:</strong></p>
                    <ol>
                        <li>Go to <a href="https://cloud.mongodb.com" target="_blank">MongoDB Atlas</a></li>
                        <li>Security → Network Access → Add IP Address</li>
                        <li>Enter <code>0.0.0.0/0</code> and click Confirm</li>
                    </ol>
                </div>`;
        } else {
            errorHtml = `
                <div class="alert alert-danger">
                    <h5><i class="fas fa-exclamation-triangle"></i> Error Loading Properties</h5>
                    <p>${error}</p>
                </div>`;
        }
        
        propertiesTable.innerHTML = `
            <tr>
                <td colspan="8">${errorHtml}</td>
            </tr>`;
    }
};

// =========================
// Transaction Buttons Management
// =========================
const TransactionManager = {
    init: () => {
        const transactionButtons = document.querySelectorAll('.transaction-btn');
        transactionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                transactionButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('transaction').value = btn.dataset.transaction;
            });
        });
    }
};

// =========================
// API Communication
// =========================
const PropertyAPI = {
    fetchProperties: async () => {
        if (!propertiesTable) return;
        
        PropertiesTable.showLoading();
        
        try {
            const properties = await window.PropertyAdminAPI.getAllProperties();
            // allProperties already set inside getAllProperties()
            PropertiesTable.render(properties);
            console.log(`✅ Loaded ${properties.length} properties`);
            return properties;
        } catch (error) {
            console.error('❌ Error fetching properties:', error);
            PropertiesTable.showError(error.message);
            throw error;
        }
    },

    editProperty: async (id) => {
        try {
            console.log('✏️ Editing property ID:', id);
            currentEditId = id;
            
            const property = await window.PropertyAdminAPI.getPropertyById(id);
            FormManager.populateForEdit(property);
            console.log('✅ Form populated for editing');
        } catch (error) {
            console.error('❌ Error fetching property data:', error);
            alert(`Error: ${error.message || 'Failed to load property for editing'}`);
        }
    },

    createProperty: async (propertyData, imageFiles) => {
        const formData = new FormData();

        Object.keys(propertyData).forEach((key) => {
            const value = propertyData[key];
            if (value === undefined || value === null) return;

            if (Array.isArray(value) || typeof value === "object") {
                formData.append(key, JSON.stringify(value));
            } else {
                formData.append(key, value);
            }
        });

        for (let i = 0; i < imageFiles.length; i++) {
            formData.append("images", imageFiles[i]);
        }

        const response = await fetch(API_ENDPOINTS.addProperty, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create property: ${errorText}`);
        }

        return await response.json();
    },

    updateProperty: async (id, propertyData, hasNewImages, imageFiles = []) => {
        if (!hasNewImages) {
            return await fetch(API_ENDPOINTS.propertyById(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(propertyData)
            }).then(res => {
                if (!res.ok) throw new Error(`Update failed: ${res.status}`);
                return res.json();
            });
        } else {
            const formData = new FormData();
            formData.append('data', JSON.stringify(propertyData));

            for (let i = 0; i < imageFiles.length; i++) {
                formData.append('images', imageFiles[i]);
            }

            return await fetch(API_ENDPOINTS.propertyById(id), {
                method: 'PATCH',
                body: formData
            }).then(res => {
                if (!res.ok) throw new Error(`Update failed: ${res.status}`);
                return res.json();
            });
        }
    },

    deleteProperty: async (id) => {
        if (!confirm("Are you sure you want to delete this property?\n\nThis action cannot be undone.")) {
            return;
        }

        try {
            const response = await fetch(API_ENDPOINTS.propertyById(id), {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Delete failed: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            alert(data.message || "✅ Property deleted successfully!");
            
            if (currentEditId === id) {
                FormManager.reset();
            }
            
            await PropertyAPI.fetchProperties();
        } catch (error) {
            console.error('❌ Error deleting property:', error);
            alert(`Error: ${error.message || 'Failed to delete property'}`);
        }
    }
};

// =========================
// Form Submission Handler
// =========================
async function handleFormSubmit(e) {
    e.preventDefault();

    // Validation
    const requiredFields = ['title', 'location', 'type', 'status', 'price'];
    for (const field of requiredFields) {
        const el = document.getElementById(field);
        const value = (el?.value || '').trim();
        if (!value) {
            alert(`Please fill in the ${field} field`);
            return;
        }
    }

    const price = parseFloat(document.getElementById('price').value);
    if (isNaN(price) || price <= 0) {
        alert('Please enter a valid price (positive number)');
        return;
    }

    // Transaction
    const transaction = document.getElementById('transaction').value;

    // Features
    const featuresValue = document.getElementById('features').value;
    let featuresArray = [];
    try {
        featuresArray = JSON.parse(featuresValue);
    } catch (err) {
        console.error('Error parsing features:', err);
        featuresArray = [];
    }

    // Prepare property data
    const propertyData = {
        title: document.getElementById('title').value.trim(),
        location: document.getElementById('location').value,
        type: document.getElementById('type').value.toLowerCase(),
        transaction,
        status: document.getElementById('status').value.toLowerCase(),
        priceNum: price,
        price: `KES ${price.toLocaleString('en-KE')}`,
        bedrooms: Number(document.getElementById('bedrooms').value || 0),
        bathrooms: Number(document.getElementById('bathrooms').value || 0),
        parking: Number(document.getElementById('parking').value || 0),
        size: document.getElementById('size').value || '',
        description: document.getElementById('description').value || '',
        whatsapp: document.getElementById('whatsapp').value || '254721911181',
        features: featuresArray,
        amenities: featuresArray,
        images: existingImages // final list of existing images after removals & reordering
    };

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = currentEditId
            ? '<i class="fas fa-spinner fa-spin"></i> Updating...'
            : '<i class="fas fa-spinner fa-spin"></i> Creating...';

        let result;

        if (!currentEditId) {
            // CREATE: must have at least 1 selected image
            if (!selectedImages || selectedImages.length === 0) {
                alert('Please select at least one image for new property');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Property';
                return;
            }

            result = await PropertyAPI.createProperty(propertyData, selectedImages);
            alert('✅ Property created successfully!');
        } else {
            // UPDATE: new images optional
            const hasNewImages = selectedImages && selectedImages.length > 0;

            result = await PropertyAPI.updateProperty(currentEditId, propertyData, hasNewImages, selectedImages);
            alert('✅ Property updated successfully!');
        }

        // Clear form + refresh table
        FormManager.reset();
        await PropertyAPI.fetchProperties();
    } catch (error) {
        console.error('❌ Error saving property:', error);
        alert(`Error: ${error?.message || 'Failed to save property'}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = currentEditId
            ? '<i class="fas fa-save"></i> Update Property'
            : '<i class="fas fa-save"></i> Create Property';
    }
}

// =========================
// Authentication
// =========================
const Auth = {
    login: (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username && password) {
            localStorage.setItem('adminLoggedIn', "true");
            loginSection.style.display = "none";
            adminSection.style.display = "block";
            PropertyAPI.fetchProperties();
            FormManager.reset();
        } else {
            alert("Please enter credentials");
        }
    },

    logout: () => {
        localStorage.removeItem('adminLoggedIn');
        loginSection.style.display = "block";
        adminSection.style.display = "none";
        FormManager.reset();
    },

    checkAuth: () => {
        return localStorage.getItem('adminLoggedIn') === "true";
    }
};

// =========================
// Server Health Check
// =========================
async function checkServerHealth() {
    try {
        const response = await fetch(API_ENDPOINTS.health);
        if (!response.ok) {
            console.warn('⚠️ Server health check failed');
        }
    } catch (error) {
        console.warn('⚠️ Server may be starting up...');
    }
}

// =========================
// Initialization
// =========================
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.checkAuth()) {
        loginSection.style.display = "none";
        adminSection.style.display = "block";
        
        checkServerHealth().then(() => {
            PropertyAPI.fetchProperties();
        });
    }
    
    ImageManager.init();
    FeaturesManager.init();
    TransactionManager.init();
    ImageModal.init(); // Initialize modal
    FormManager.updateStatus('ready');
    
    if (loginForm) loginForm.addEventListener('submit', Auth.login);
    if (logoutBtn) logoutBtn.addEventListener('click', Auth.logout);
    if (propertyForm) propertyForm.addEventListener('submit', handleFormSubmit);
    
    const resetBtn = document.getElementById('resetForm');
    if (resetBtn) resetBtn.addEventListener('click', FormManager.reset);
});

// =========================
// Export for testing/usage
// =========================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PropertyAdminAPI,
        Utils,
        PropertyAPI,
        Auth
    };
}