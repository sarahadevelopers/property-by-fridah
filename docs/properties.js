// ============================================
// PROPERTIES PAGE - PERFECTED & OPTIMIZED (WITH PRICE FIX)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // ========== CONFIGURATION ==========
    const CONFIG = {
        apiBase: 'https://property-by-fridah.onrender.com',
        itemsPerPage: 9,
        cacheKey: 'property_by_fridah_cache',
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        retryAttempts: 2,
        retryDelay: 2000,
        fetchLimit: 100 // ✅ Request 100 properties from API
    };

    // ========== DOM ELEMENTS ==========
    const elements = {
        container: document.getElementById('propertiesGrid'),
        mobileMenu: document.getElementById('mobileMenu'),
        navLinks: document.getElementById('navLinks'),
        overlay: document.getElementById('overlay'),
        heroSearch: document.getElementById('hero-search'),
        searchJumpBtn: document.querySelector('.hero-search-btn'),
        filterSearch: document.getElementById('smart-search'),
        locationFilter: document.getElementById('location'),
        typeFilter: document.getElementById('property-type'),
        priceFilter: document.getElementById('price-range'),
        bedroomsFilter: document.getElementById('bedrooms'),
        applyFiltersBtn: document.getElementById('applyFilters'),
        resetFiltersBtn: document.getElementById('resetFilters'),
        resetFiltersBtn2: document.getElementById('resetFilters2'),
        noResults: document.getElementById('noResults'),
        tabButtons: document.querySelectorAll('.tab-btn'),
        modal: document.getElementById('propertyModal'),
        modalClose: document.getElementById('modalClose'),
        modalBody: document.getElementById('modalBody'),
        pagination: document.getElementById('pagination')
    };

    // ========== STATE MANAGEMENT ==========
    let state = {
        properties: [],
        filteredProperties: [],
        currentPage: 1,
        isLoading: false,
        activeTransaction: 'sale',
        retryCount: 0,
        isServerHealthy: false,
        filters: {
            search: '',
            location: 'all',
            type: 'all',
            price: 'all',
            bedrooms: 'all'
        }
    };

    // ========== MODAL GLOBALS ==========
    let currentKeyDownHandler = null;

    // ========== INITIALIZATION ==========
    function init() {
        console.log('Initializing property page...');
        
        if (!elements.container) {
            console.error('ERROR: Element with id="propertiesGrid" not found!');
            return;
        }

        setupEventListeners();
        updateFooterYear();
        
        // Pre-wake the server early
        fetch(`${CONFIG.apiBase}/health`).catch(() => {});
        
        checkServerHealth().then(() => {
            // Try to load from cache first for instant display
            const cached = getCachedProperties();
            if (cached && cached.length > 0) {
                console.log('📦 Using cached properties');
                state.properties = cached.map(processPropertyData);
                applyFilters(true);
                state.isLoading = false;
            }
            
            // Always fetch fresh data in background
            loadProperties();
        });
    }

    // ========== SERVER HEALTH CHECK ==========
    async function checkServerHealth() {
        try {
            // Try using admin.js API first if available
            if (window.PropertyAdminAPI && typeof window.PropertyAdminAPI.checkServerHealth === 'function') {
                state.isServerHealthy = await window.PropertyAdminAPI.checkServerHealth();
                console.log('✅ Using admin.js API for health check');
                return;
            }
            
            // Fallback to direct API call with AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.apiBase}/health`, {
                signal: controller.signal
            }).catch(() => null);
            
            clearTimeout(timeoutId);
            state.isServerHealthy = response?.ok || false;
            
            if (!state.isServerHealthy) {
                console.warn('⚠️ Server may be starting up or sleeping');
            }
        } catch (error) {
            console.warn('Server health check failed:', error);
            state.isServerHealthy = false;
        }
    }

    // ========== CACHE MANAGEMENT ==========
    function getCachedProperties() {
        try {
            const raw = localStorage.getItem(CONFIG.cacheKey);
            if (!raw) return null;
            
            const cached = JSON.parse(raw);
            const isValid = Date.now() - cached.timestamp < CONFIG.cacheTTL;
            
            return isValid ? cached.data : null;
        } catch (error) {
            console.warn('Cache read failed:', error);
            return null;
        }
    }
    
    function setCachedProperties(data) {
        try {
            localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (error) {
            console.warn('Cache write failed:', error);
        }
    }

    // ========== DATA LOADING ==========
    async function loadProperties() {
        if (state.isLoading) return;
        
        state.isLoading = true;
        showSkeletons(); // Show skeletons immediately
        
        try {
            console.log('Fetching properties from API...');
            
            let properties = [];
            
            // Try to use admin.js API if available
            if (window.PropertyAdminAPI && typeof window.PropertyAdminAPI.getAllProperties === 'function') {
                console.log('🔄 Using admin.js API to fetch properties');
                properties = await window.PropertyAdminAPI.getAllProperties();
            } else {
                // Fallback to direct fetch with limit parameter
                console.log('🔄 Using direct API fetch');
                properties = await fetchPropertiesDirectly();
            }
            
            // If API fails, use sample data
            if (!properties || !Array.isArray(properties) || properties.length === 0) {
                console.log('API returned no data, using sample properties');
                properties = getSampleProperties();
            }
            
            console.log(`Loaded ${properties.length} properties`);
            
            // Process properties
            state.properties = properties.map(processPropertyData);
            
            // Cache the results
            setCachedProperties(properties);
            
            // Apply filters and render (initial load)
            applyFilters(true);
            
            if (properties.length === 0) {
                showEmptyState('No properties available at the moment. Please check back later.');
            }
            
        } catch (error) {
            console.error('❌ Error loading properties:', error);
            
            // Use sample data as fallback
            console.log('Using sample data due to error');
            state.properties = getSampleProperties().map(processPropertyData);
            applyFilters(true);
            
            // Show warning but continue
            showToast('Using sample data. API connection issue.', 'warning');
            
        } finally {
            state.isLoading = false;
        }
    }

    async function fetchPropertiesDirectly() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            // ✅ Request limit parameter for 100 properties
            const response = await fetch(`${CONFIG.apiBase}/api/properties?limit=${CONFIG.fetchLimit}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Handle different response formats
            if (data.success === false) {
                throw new Error(data.message || 'API error');
            }
            
            return Array.isArray(data) ? data : [];
            
        } catch (error) {
            console.warn('API fetch failed:', error.message);
            return null; // Return null to trigger sample data
        }
    }

    function processPropertyData(property) {
        // Generate ID if missing
        const id = property._id || property.id || generateId();
        
        // Normalize location
        let location = (property.location || 'unknown').toLowerCase().trim();
        const locationMap = {
            'kitengela': 'kitengela',
            'ngong': 'ngong',
            'syokimau': 'syokimau',
            'ongata rongai': 'ongata-rongai',
            'ongata-rongai': 'ongata-rongai',
            'athi river': 'athi-river',
            'kilimani': 'kilimani'
        };
        location = locationMap[location] || location;
        
        // Determine transaction type
        let transaction = 'sale';
        if (property.transaction) {
            transaction = property.transaction.toLowerCase();
        } else if (property.purpose === 'rent' || property.listingType === 'rent') {
            transaction = 'rent';
        }
        
        // Extract price
        const priceNum = extractPriceNumber(property);
        
        // Determine property type
        let type = 'unknown';
        if (property.type) {
            type = property.type.toLowerCase();
        } else if (property.category) {
            type = property.category.toLowerCase();
        }
        
        // Normalize type to match filter values
        const typeMap = {
            'bungalow': 'bungalow',
            'maisonette': 'maisonette',
            'townhouse': 'townhouse',
            'apartment': 'apartment',
            'flat': 'apartment',
            'studio': 'studio',
            'bedsitter': 'studio',
            'villa': 'villa',
            'furnished': 'furnished',
            'office': 'office',
            'shop': 'shop',
            'retail': 'shop',
            'warehouse': 'warehouse',
            'godown': 'warehouse',
            'land': 'land-res',
            'plot': 'land-res',
            'residential plot': 'land-res',
            'commercial land': 'land-comm',
            'agricultural': 'ranch',
            'ranch': 'ranch'
        };
        type = typeMap[type] || type;
        
        return {
            id: id,
            title: property.title || 'Untitled Property',
            location: location,
            type: type,
            transaction: transaction,
            status: (property.status || 'available').toLowerCase(),
            priceNum: priceNum,
            priceDisplay: formatPrice(priceNum, transaction, property.price),
            bedrooms: parseInt(property.bedrooms) || 0,
            bathrooms: parseInt(property.bathrooms) || 0,
            parking: parseInt(property.parking) || 0,
            size: property.size || property.area || '',
            description: property.description || 'No description available',
            whatsapp: property.whatsapp || '254721911181',
            images: Array.isArray(property.images) ? property.images.map(img => normalizeImageUrl(img)) : [],
            features: property.features || property.amenities || [],
            createdAt: property.createdAt || new Date().toISOString()
        };
    }

    // ✅ FIXED: Price extraction function
   function extractPriceNumber(property) {
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
  // Examples matched:
  // "kes 7.5m" -> 7.5 + m
  // "ksh 250k" -> 250 + k
  // "kes 85,000" -> 85,000 + (no suffix)
  const match = cleaned.match(/(\d[\d,]*\.?\d*)\s*([mk])?\b/);
  if (!match) return 0;

  let num = parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return 0;

  const suffix = match[2]; // 'm' or 'k' or undefined
  if (suffix === 'm') num *= 1_000_000;
  if (suffix === 'k') num *= 1_000;

  return num;
}


    function formatPrice(amount, transaction = 'sale', rawPrice = '') {
  if (!amount || amount === 0) return 'Price on request';

  const tx = (transaction || 'sale').toLowerCase();

  // ✅ Rent / Lease: show full number (no K/M compression)
  if (tx === 'rent' || tx === 'lease') {
    const period = detectPeriod(rawPrice);
    return `KES ${Math.round(amount).toLocaleString('en-KE')}${period}`;
  }

  // ✅ Sale: keep your M/K format
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    const formatted =
      millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, '');
    return `KES ${formatted}M`;
  } else if (amount >= 1000) {
    return `KES ${(amount / 1000).toFixed(0)}K`;
  }

  return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
}

function detectPeriod(rawPrice = '') {
  const s = (rawPrice || '').toLowerCase();

  // common rent words
  if (s.includes('/month') || s.includes('per month') || s.includes('monthly')) return ' / month';
  if (s.includes('/week') || s.includes('per week') || s.includes('weekly')) return ' / week';
  if (s.includes('/day') || s.includes('per day') || s.includes('daily')) return ' / day';
  if (s.includes('/year') || s.includes('per year') || s.includes('yearly') || s.includes('annum')) return ' / year';

  // default for rent/lease if nothing is provided
  return ' / month';
}

    // ========== IMAGE HANDLING ==========
    function normalizeImageUrl(src) {
        if (!src) return getPlaceholderImage();
        if (src.startsWith('http://') || src.startsWith('https://')) {
            return src.includes('res.cloudinary.com') ? cloudinaryCardUrl(src) : src;
        }
        if (src.startsWith('/')) return `${CONFIG.apiBase}${src}`;
        return `${CONFIG.apiBase}/${src}`;
    }

    function cloudinaryCardUrl(url) {
        if (!url.includes('res.cloudinary.com')) return url;
        // Add Cloudinary transformations for optimal loading
        return url.replace('/upload/', '/upload/f_auto,q_auto,w_900,c_fill,g_auto/');
    }

    function getPlaceholderImage(type = '') {
        const images = {
            'bungalow': 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'apartment': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'land-res': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'warehouse': 'https://images.unsplash.com/photo-1487956382158-bb926046304a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'office': 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        
        return images[type] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    }

    // ========== UI STATES ==========
    function showSkeletons() {
        elements.container.innerHTML = '';
        
        // Create skeleton cards for instant UI feedback
        const skeletons = Array.from({ length: CONFIG.itemsPerPage }, (_, i) => `
            <div class="property-card skeleton-card" style="animation-delay: ${i * 50}ms">
                <div class="property-img">
                    <div class="skeleton-img"></div>
                </div>
                <div class="property-details">
                    <div class="skeleton-line" style="width: 60%"></div>
                    <div class="skeleton-line" style="width: 90%; height: 24px; margin: 10px 0"></div>
                    <div class="skeleton-line" style="width: 70%"></div>
                    <div class="property-features">
                        <div class="skeleton-circle"></div>
                        <div class="skeleton-circle"></div>
                        <div class="skeleton-circle"></div>
                        <div class="skeleton-circle"></div>
                    </div>
                </div>
            </div>
        `).join('');
        
        elements.container.innerHTML = skeletons;
    }

    function showEmptyState(message) {
        // ✅ Use existing #noResults block without overwriting structure
        if (elements.noResults) {
            const heading = elements.noResults.querySelector('h3');
            const paragraph = elements.noResults.querySelector('p');
            
            if (heading) heading.textContent = message || 'No properties match your filters';
            if (paragraph) {
                paragraph.innerHTML = 'Try adjusting your search criteria or <a href="https://wa.me/254721911181" target="_blank">WhatsApp us</a> for personalized property recommendations.';
            }
            
            elements.noResults.style.display = 'block';
        }
    }

    function updateFooterYear() {
        const currentYear = new Date().getFullYear();
        document.querySelectorAll('[id="currentYear"], [id="y"]').forEach(el => {
            el.textContent = currentYear;
        });
    }

    // ========== FILTERING ==========
    function applyFilters(initialLoad = false) {
        if (!state.properties.length) return;
        
        // ✅ Only reset page when NOT initial load
        if (!initialLoad) {
            state.currentPage = 1;
        }
        
        // Update state from UI
        if (!initialLoad) {
            state.filters = {
                search: elements.filterSearch?.value.toLowerCase() || '',
                location: elements.locationFilter?.value || 'all',
                type: elements.typeFilter?.value || 'all',
                price: elements.priceFilter?.value || 'all',
                bedrooms: elements.bedroomsFilter?.value || 'all'
            };
        }
        
        console.log('Applying filters:', state.filters);
        console.log('Active transaction:', state.activeTransaction);
        
        // Filter properties
        state.filteredProperties = state.properties.filter(property => {
            console.log('Checking property:', property.title, 'Price:', property.priceNum, 'Transaction:', property.transaction);
            
            // 1. Transaction filter (tabs)
            if (property.transaction !== state.activeTransaction) {
                console.log('❌ Failed transaction filter');
                return false;
            }
            
            // 2. Search filter
            if (state.filters.search) {
                const searchableText = `
                    ${property.title}
                    ${formatLocationName(property.location)}
                    ${formatTypeName(property.type)}
                    ${property.description}
                `.toLowerCase();
                
                if (!searchableText.includes(state.filters.search)) {
                    console.log('❌ Failed search filter');
                    return false;
                }
            }
            
            // 3. Location filter
            if (state.filters.location !== 'all' && property.location !== state.filters.location) {
                console.log('❌ Failed location filter');
                return false;
            }
            
            // 4. Type filter
            if (state.filters.type !== 'all' && property.type !== state.filters.type) {
                console.log('❌ Failed type filter');
                return false;
            }
            
            // 5. Price filter (FIXED)
            if (state.filters.price !== 'all') {
                if (!checkPriceFilter(property.priceNum, state.filters.price)) {
                    console.log('❌ Failed price filter');
                    return false;
                }
            }
            
            // 6. Bedrooms filter (skip for non-residential)
            if (state.filters.bedrooms !== 'all') {
                const nonResidentialTypes = ['land-res', 'land-comm', 'ranch', 'warehouse', 'office', 'shop'];
                if (!nonResidentialTypes.includes(property.type)) {
                    if (!checkBedroomsFilter(property, state.filters.bedrooms)) {
                        console.log('❌ Failed bedrooms filter');
                        return false;
                    }
                }
            }
            
            console.log('✅ Property passed all filters');
            return true;
        });
        
        console.log(`Filtered to ${state.filteredProperties.length} properties`);
        
        // Update UI
        renderProperties();
        
        // Show/hide no results
        if (elements.noResults) {
            elements.noResults.style.display = state.filteredProperties.length ? 'none' : 'block';
        }
    }

    // ✅ FIXED: Price filter function
    function checkPriceFilter(priceNum, filter) {
        const price = priceNum || 0;
        
        console.log(`Checking price: ${price} against filter: ${filter}`);
        
        // For rent/lease properties
        if (state.activeTransaction === 'rent' || state.activeTransaction === 'lease') {
            switch(filter) {
                case '0-15k':
                    return price <= 15000;
                case '15k-50k':
                    return price >= 15000 && price <= 50000;
                case '50k-150k':
                    return price >= 50000 && price <= 150000;
                case 'over-150k':
                    return price > 150000;
                default:
                    return true; // "all" option
            }
        } 
        // For sale properties
        else {
            switch(filter) {
                case 'under-5m':
                    return price <= 5000000;
                case '5m-15m':
                    return price >= 5000000 && price <= 15000000;
                case '15m-30m':
                    return price >= 15000000 && price <= 30000000;
                case 'over-30m':
                    return price > 30000000;
                default:
                    return true; // "all" option
            }
        }
    }

    function checkBedroomsFilter(property, filter) {
        const bedrooms = property.bedrooms || 0;
        
        if (filter === '4+') {
            return bedrooms >= 4;
        } else {
            return bedrooms.toString() === filter;
        }
    }

    function resetFilters() {
        // ✅ Reset page to 1
        state.currentPage = 1;
        
        // Reset filter inputs
        if (elements.filterSearch) elements.filterSearch.value = '';
        if (elements.locationFilter) elements.locationFilter.value = 'all';
        if (elements.typeFilter) elements.typeFilter.value = 'all';
        updatePriceOptions();
        if (elements.bedroomsFilter) elements.bedroomsFilter.value = 'all';
        
        applyFilters();
    }

    function updatePriceOptions() {
        if (!elements.priceFilter) return;
        
        const isRental = state.activeTransaction === 'rent' || state.activeTransaction === 'lease';
        
        let options = '<option value="all">Any Price</option>';
        
        if (isRental) {
            options += `
                <option value="0-15k">Under KES 15k</option>
                <option value="15k-50k">KES 15k – 50k</option>
                <option value="50k-150k">KES 50k – 150k</option>
                <option value="over-150k">Over KES 150k</option>
            `;
        } else {
            options += `
                <option value="under-5m">Under KES 5M</option>
                <option value="5m-15m">KES 5M – 15M</option>
                <option value="15m-30m">KES 15M – 30M</option>
                <option value="over-30m">Over KES 30M</option>
            `;
        }
        
        elements.priceFilter.innerHTML = options;
    }

    // ========== RENDERING ==========
    function renderProperties() {
        elements.container.innerHTML = '';
        
        if (state.filteredProperties.length === 0) {
            showEmptyState('No properties match your filters');
            if (elements.pagination) elements.pagination.innerHTML = '';
            return;
        }
        
        // Calculate pagination with safety check
        const totalPages = Math.ceil(state.filteredProperties.length / CONFIG.itemsPerPage);
        if (state.currentPage > totalPages) state.currentPage = totalPages || 1;
        
        const startIndex = (state.currentPage - 1) * CONFIG.itemsPerPage;
        const endIndex = startIndex + CONFIG.itemsPerPage;
        const pageProperties = state.filteredProperties.slice(startIndex, endIndex);
        
        // Render property cards
        pageProperties.forEach((property, index) => {
            const card = createPropertyCard(property, index);
            elements.container.appendChild(card);
        });
        
        // Update pagination
        renderPagination();
    }

    function createPropertyCard(property, index) {
        const card = document.createElement('div');
        card.className = 'property-card fade-in';
        card.style.animationDelay = `${index * 50}ms`;
        
        // ✅ Determine status badge - show badge ONLY for available properties
        // ✅ For sold/reserved, show overlay only (no duplicate badge)
        let statusBadge = '';
        let statusClass = 'badge-available';
        
        if (property.status === 'sold') {
            statusBadge = '<div class="sold-overlay"><div class="sold-text">SOLD</div></div>';
        } else if (property.status === 'reserved') {
            statusBadge = '<div class="sold-overlay"><div class="sold-text">RESERVED</div></div>';
        }
        
        // Only show badge for available properties (not sold/reserved)
        const showBadge = property.status === 'available';
        
        // Get main image (first image or placeholder)
        const mainImage = property.images?.[0] || getPlaceholderImage(property.type);
        
        card.innerHTML = `
            <div class="property-img">
                <div class="img-wrapper">
                    <img src="${mainImage}" 
                         alt="${property.title}" 
                         loading="lazy"
                         decoding="async"
                         width="600"
                         height="400"
                         ${index === 0 ? 'fetchpriority="high"' : ''}
                         onerror="this.src='${getPlaceholderImage(property.type)}'">
                </div>
                ${statusBadge}
                ${showBadge ? `<div class="property-badge ${statusClass}">${property.status.toUpperCase()}</div>` : ''}
            </div>
            
            <div class="property-details">
                <div class="property-price">${property.priceDisplay}</div>
                <h3 class="property-title">${property.title}</h3>
                
                <div class="property-location">
                    <i class="fas fa-map-marker-alt"></i> ${formatLocationName(property.location)}
                </div>
                
                <div class="property-features">
                    ${property.bedrooms > 0 ? `
                    <div class="feature" title="Bedrooms">
                        <i class="fas fa-bed"></i>
                        <span>${property.bedrooms}</span>
                    </div>` : ''}
                    
                    ${property.bathrooms > 0 ? `
                    <div class="feature" title="Bathrooms">
                        <i class="fas fa-bath"></i>
                        <span>${property.bathrooms}</span>
                    </div>` : ''}
                    
                    ${property.parking > 0 ? `
                    <div class="feature" title="Parking">
                        <i class="fas fa-car"></i>
                        <span>${property.parking}</span>
                    </div>` : ''}
                    
                    ${property.size ? `
                    <div class="feature" title="Size">
                        <i class="fas fa-expand"></i>
                        <span>${property.size}</span>
                    </div>` : ''}
                </div>
                
                <div class="property-ctas">
                    <a href="https://wa.me/${property.whatsapp}?text=${encodeURIComponent(
                        `Hi, I'm interested in "${property.title}" at ${formatLocationName(property.location)}. Price: ${property.priceDisplay}`
                    )}" 
                       class="btn btn-whatsapp" 
                       target="_blank"
                       rel="noopener">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                    <button class="btn btn-secondary view-details-btn" data-id="${property.id}">
                        View Details
                    </button>
                </div>
            </div>`;
        
        // Add click handler for view details
        card.querySelector('.view-details-btn').addEventListener('click', () => {
            openPropertyModal(property);
        });
        
        return card;
    }

    function renderPagination() {
        if (!elements.pagination) return;
        
        const totalPages = Math.ceil(state.filteredProperties.length / CONFIG.itemsPerPage);
        
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        if (state.currentPage > 1) {
            html += `<button class="pagination-btn" data-page="${state.currentPage - 1}">
                        <i class="fas fa-chevron-left"></i> Previous
                     </button>`;
        }
        
        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === state.currentPage ? 'active' : ''}" 
                     data-page="${i}">${i}</button>`;
        }
        
        // Next button
        if (state.currentPage < totalPages) {
            html += `<button class="pagination-btn" data-page="${state.currentPage + 1}">
                        Next <i class="fas fa-chevron-right"></i>
                     </button>`;
        }
        
        elements.pagination.innerHTML = html;
        
        // Add click handlers
        elements.pagination.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page)) {
                    state.currentPage = page;
                    renderProperties();
                    window.scrollTo({ top: elements.container.offsetTop - 100, behavior: 'smooth' });
                }
            });
        });
    }

    // ========== MODAL FUNCTIONS ==========
    function openPropertyModal(property) {
        console.log('Opening modal for property:', property.title);
        
        if (!property || !elements.modalBody) return;
        
        // Initialize gallery state
        const galleryState = {
            currentIndex: 0,
            images: property.images || [getPlaceholderImage(property.type)],
            totalImages: property.images?.length || 1
        };
        
        // Create modal HTML with gallery navigation
        elements.modalBody.innerHTML = `
            <div class="modal-top">
                <h2>${property.title}</h2>
                <div class="modal-price">${property.priceDisplay}</div>
            </div>
            
            <div class="modal-gallery">
                <div class="main-image-container">
                    <img src="${galleryState.images[0]}" 
                         alt="${property.title}" 
                         class="main-image"
                         onerror="this.src='${getPlaceholderImage(property.type)}'">
                    
                    ${galleryState.totalImages > 1 ? `
                        <button class="gallery-nav gallery-prev" aria-label="Previous image">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="gallery-nav gallery-next" aria-label="Next image">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <div class="image-counter">
                            <span class="current-index">${galleryState.currentIndex + 1}</span>
                            /
                            <span class="total-images">${galleryState.totalImages}</span>
                        </div>
                    ` : ''}
                </div>
                
                ${galleryState.totalImages > 1 ? `
                    <div class="thumbnails">
                        ${galleryState.images.slice(0, 6).map((src, i) => `
                            <img src="${src}" 
                                 alt="${property.title} - Image ${i+1}" 
                                 class="thumbnail ${i === 0 ? 'active' : ''}"
                                 loading="lazy"
                                 data-index="${i}"
                                 onerror="this.src='${getPlaceholderImage(property.type)}'">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-info">
                <div class="info-grid">
                    <div class="info-item">
                        <strong><i class="fas fa-map-marker-alt"></i> Location:</strong>
                        <span>${formatLocationName(property.location)}</span>
                    </div>
                    <div class="info-item">
                        <strong><i class="fas fa-home"></i> Type:</strong>
                        <span>${formatTypeName(property.type)}</span>
                    </div>
                    ${property.bedrooms > 0 ? `
                    <div class="info-item">
                        <strong><i class="fas fa-bed"></i> Bedrooms:</strong>
                        <span>${property.bedrooms}</span>
                    </div>` : ''}
                    ${property.bathrooms > 0 ? `
                    <div class="info-item">
                        <strong><i class="fas fa-bath"></i> Bathrooms:</strong>
                        <span>${property.bathrooms}</span>
                    </div>` : ''}
                    ${property.parking > 0 ? `
                    <div class="info-item">
                        <strong><i class="fas fa-car"></i> Parking:</strong>
                        <span>${property.parking}</span>
                    </div>` : ''}
                    ${property.size ? `
                    <div class="info-item">
                        <strong><i class="fas fa-expand"></i> Size:</strong>
                        <span>${property.size}</span>
                    </div>` : ''}
                    <div class="info-item">
                        <strong><i class="fas fa-exchange-alt"></i> Status:</strong>
                        <span class="status-${property.status}">${property.status.toUpperCase()}</span>
                    </div>
                </div>
                
                ${property.description ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-align-left"></i> Description</h3>
                        <p>${property.description}</p>
                    </div>
                ` : ''}
                
                ${property.features && property.features.length > 0 ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-star"></i> Features</h3>
                        <div class="features-grid">
                            ${property.features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-actions">
                <a href="https://wa.me/${property.whatsapp}?text=${encodeURIComponent(
                    `Hi, I'm interested in "${property.title}" at ${formatLocationName(property.location)}. Price: ${property.priceDisplay}`
                )}" 
                   class="btn btn-whatsapp" 
                   target="_blank"
                   rel="noopener">
                    <i class="fab fa-whatsapp"></i> WhatsApp Inquiry
                </a>
                <a href="tel:+254721911181" class="btn btn-secondary">
                    <i class="fas fa-phone"></i> Call Now
                </a>
            </div>`;
        
        // Open modal
        elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Add gallery functionality
        if (galleryState.totalImages > 1) {
            const mainImage = elements.modalBody.querySelector('.main-image');
            const prevBtn = elements.modalBody.querySelector('.gallery-prev');
            const nextBtn = elements.modalBody.querySelector('.gallery-next');
            const thumbnails = elements.modalBody.querySelectorAll('.thumbnail');
            const currentIndexSpan = elements.modalBody.querySelector('.current-index');
            
            // Function to update gallery
            const updateGallery = (newIndex) => {
                galleryState.currentIndex = newIndex;
                
                // Update main image with fade effect
                mainImage.style.opacity = '0.7';
                setTimeout(() => {
                    mainImage.src = galleryState.images[newIndex];
                    mainImage.style.opacity = '1';
                }, 150);
                
                // Update active thumbnail
                thumbnails.forEach((thumb, i) => {
                    thumb.classList.toggle('active', i === newIndex);
                });
                
                // Update counter
                if (currentIndexSpan) {
                    currentIndexSpan.textContent = newIndex + 1;
                }
            };
            
            // Previous button
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    const newIndex = galleryState.currentIndex === 0 
                        ? galleryState.totalImages - 1 
                        : galleryState.currentIndex - 1;
                    updateGallery(newIndex);
                });
            }
            
            // Next button
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const newIndex = galleryState.currentIndex === galleryState.totalImages - 1 
                        ? 0 
                        : galleryState.currentIndex + 1;
                    updateGallery(newIndex);
                });
            }
            
            // Thumbnail clicks
            thumbnails.forEach((thumb, i) => {
                thumb.addEventListener('click', () => {
                    updateGallery(i);
                });
            });
            
            // Swipe functionality for mobile
            let touchStartX = 0;
            let touchEndX = 0;
            
            if (mainImage) {
                mainImage.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                }, { passive: true });
                
                mainImage.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    handleSwipe();
                }, { passive: true });
            }
            
            function handleSwipe() {
                const swipeThreshold = 50; // Minimum swipe distance
                const swipeDistance = touchEndX - touchStartX;
                
                if (Math.abs(swipeDistance) > swipeThreshold) {
                    if (swipeDistance > 0) {
                        // Swipe right - previous image
                        const newIndex = galleryState.currentIndex === 0 
                            ? galleryState.totalImages - 1 
                            : galleryState.currentIndex - 1;
                        updateGallery(newIndex);
                    } else {
                        // Swipe left - next image
                        const newIndex = galleryState.currentIndex === galleryState.totalImages - 1 
                            ? 0 
                            : galleryState.currentIndex + 1;
                        updateGallery(newIndex);
                    }
                }
            }
            
            // Keyboard navigation
            currentKeyDownHandler = (e) => {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const newIndex = galleryState.currentIndex === 0 
                        ? galleryState.totalImages - 1 
                        : galleryState.currentIndex - 1;
                    updateGallery(newIndex);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const newIndex = galleryState.currentIndex === galleryState.totalImages - 1 
                        ? 0 
                        : galleryState.currentIndex + 1;
                    updateGallery(newIndex);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeModal();
                }
            };
            
            // Add keyboard listener
            document.addEventListener('keydown', currentKeyDownHandler);
        }
        
        // Force mobile viewport adjustment
        setTimeout(() => {
            if (window.innerWidth <= 768) {
                // Scroll to top of modal
                elements.modalBody.scrollTop = 0;
                
                // Ensure modal content is fully visible
                const modalContent = elements.modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.display = 'flex';
                    modalContent.style.flexDirection = 'column';
                    modalContent.style.height = '100vh';
                    modalContent.style.maxHeight = '100vh';
                }
                
                // Ensure all content sections are visible
                const modalSections = elements.modalBody.querySelectorAll('.modal-section, .modal-info, .modal-actions');
                modalSections.forEach(section => {
                    section.style.display = 'block';
                    section.style.visibility = 'visible';
                    section.style.opacity = '1';
                    section.style.maxHeight = 'none';
                    section.style.overflow = 'visible';
                });
                
                // Set viewport for better mobile experience
                const metaViewport = document.querySelector('meta[name="viewport"]');
                if (metaViewport) {
                    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                }
            }
        }, 50);
        
        // Focus on close button for accessibility
        setTimeout(() => {
            if (elements.modalClose) {
                elements.modalClose.focus();
                
                // Add visual indicator for mobile
                if (window.innerWidth <= 768) {
                    elements.modalClose.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
                    elements.modalClose.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.3)';
                    
                    // Remove highlight after 1 second
                    setTimeout(() => {
                        elements.modalClose.style.backgroundColor = '';
                        elements.modalClose.style.boxShadow = '';
                    }, 1000);
                }
            }
        }, 100);
    }

    function closeModal() {
        console.log('Closing modal');
        
        // Remove keyboard event listener
        if (currentKeyDownHandler) {
            document.removeEventListener('keydown', currentKeyDownHandler);
            currentKeyDownHandler = null;
        }
        
        // Close modal
        elements.modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
        
        // Reset viewport for normal scrolling
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
        }
        
        // Reset modal body scroll position
        if (elements.modalBody) {
            elements.modalBody.scrollTop = 0;
            
            // Reset any inline styles
            const modalContent = elements.modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.display = '';
                modalContent.style.flexDirection = '';
                modalContent.style.height = '';
                modalContent.style.maxHeight = '';
            }
        }
    }

    // ========== UTILITY FUNCTIONS ==========
    function formatLocationName(location) {
        if (!location) return 'Unknown Location';
        
        const locationMap = {
            'kitengela': 'Kitengela',
            'ngong': 'Ngong',
            'syokimau': 'Syokimau',
            'ongata-rongai': 'Ongata Rongai',
            'athi-river': 'Athi River',
            'kilimani': 'Kilimani',
            'unknown': 'Location not specified'
        };
        
        return locationMap[location] || 
               location.charAt(0).toUpperCase() + location.slice(1).replace(/-/g, ' ');
    }

    function formatTypeName(type) {
        if (!type) return 'Property';
        
        const typeMap = {
            'bungalow': 'Bungalow',
            'maisonette': 'Maisonette',
            'townhouse': 'Townhouse',
            'apartment': 'Apartment',
            'studio': 'Studio/Bedsitter',
            'villa': 'Villa',
            'furnished': 'Furnished',
            'office': 'Office Space',
            'shop': 'Shop/Retail',
            'warehouse': 'Warehouse/Godown',
            'land-res': 'Residential Plot',
            'land-comm': 'Commercial Land',
            'ranch': 'Ranch/Agricultural',
            'unknown': 'Property'
        };
        
        return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
    }

    function generateId() {
        return 'prop_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function getSampleProperties() {
        return [
            {
                id: 1,
                title: "3-Bedroom Bungalow in Kitengela",
                transaction: "sale",
                status: "available",
                price: "KES 7,500,000",
                location: "kitengela",
                type: "bungalow",
                bedrooms: 3,
                bathrooms: 2,
                parking: 2,
                size: "50x100 ft",
                images: [],
                description: "Beautiful modern bungalow with spacious rooms and ample parking",
                features: ["Master ensuite", "DSQ", "Gated community", "Water backup"],
                whatsapp: "254721911181"
            },
            {
                id: 2,
                title: "Residential Plot in Ngong",
                transaction: "sale",
                status: "available",
                price: "KES 4,200,000",
                location: "ngong",
                type: "land-res",
                bedrooms: 0,
                bathrooms: 0,
                parking: 0,
                size: "1/8 Acre",
                images: [],
                description: "Prime residential plot with title deed ready",
                features: ["Corner plot", "Title deed", "Access road", "Ready for construction"],
                whatsapp: "254721911181"
            },
            {
                id: 3,
                title: "2-Bedroom Apartment in Kilimani",
                transaction: "rent",
                status: "available",
                price: "KES 85,000/month",
                location: "kilimani",
                type: "apartment",
                bedrooms: 2,
                bathrooms: 2,
                parking: 1,
                size: "1200 sq ft",
                images: [],
                description: "Modern apartment in prime location",
                features: ["Furnished", "Gym", "Swimming pool", "24/7 security"],
                whatsapp: "254721911181"
            }
        ];
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }

    // ========== EVENT HANDLERS ==========
    function setupEventListeners() {
        console.log('Setting up event listeners');
        
        // Mobile menu
        if (elements.mobileMenu) {
            elements.mobileMenu.addEventListener('click', toggleMobileMenu);
        }
        if (elements.overlay) {
            elements.overlay.addEventListener('click', closeMobileMenu);
        }
        
        // Search jump
        if (elements.heroSearch) {
            elements.heroSearch.addEventListener('focus', jumpToSearch);
        }
        if (elements.searchJumpBtn) {
            elements.searchJumpBtn.addEventListener('click', jumpToSearch);
        }
        
        // Tabs
        elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                state.activeTransaction = btn.dataset.type;
                updatePriceOptions();
                state.currentPage = 1; // ✅ Reset page when tab changes
                applyFilters();
            });
        });
        
        // Filters
        if (elements.applyFiltersBtn) {
            elements.applyFiltersBtn.addEventListener('click', () => {
                state.currentPage = 1; // ✅ Reset page when filters applied
                applyFilters();
            });
        }
        if (elements.resetFiltersBtn) {
            elements.resetFiltersBtn.addEventListener('click', resetFilters);
        }
        if (elements.resetFiltersBtn2) {
            elements.resetFiltersBtn2.addEventListener('click', resetFilters);
        }
        
        // Filter change events
        const filterElements = [
            elements.filterSearch,
            elements.locationFilter,
            elements.typeFilter,
            elements.priceFilter,
            elements.bedroomsFilter
        ];
        
        filterElements.forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => {
                    state.currentPage = 1; // ✅ Reset page when filter changes
                    applyFilters();
                });
            }
        });
        
        // Search input with debounce
        if (elements.filterSearch) {
            elements.filterSearch.addEventListener('input', debounce(() => {
                state.currentPage = 1; // ✅ Reset page when typing
                applyFilters();
            }, 300));
        }
        
        // Modal - FIXED FOR MOBILE
        if (elements.modalClose) {
            console.log('Setting up modal close button listener');
            
            // Create a single handler function
            const closeModalHandler = (e) => {
                console.log('Close button clicked/touched');
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            };
            
            // Add both click and touch events for mobile compatibility
            elements.modalClose.addEventListener('click', closeModalHandler);
            elements.modalClose.addEventListener('touchend', closeModalHandler);
            
            // Also add mouseup for good measure
            elements.modalClose.addEventListener('mouseup', closeModalHandler);
        }
        
        if (elements.modal) {
            // Close modal when clicking on background overlay
            elements.modal.addEventListener('click', (e) => {
                if (e.target === elements.modal) {
                    closeModal();
                }
            });
            
            // Also add touch for mobile
            elements.modal.addEventListener('touchend', (e) => {
                if (e.target === elements.modal) {
                    e.preventDefault();
                    closeModal();
                }
            }, { passive: false });
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modal?.classList.contains('active')) {
                closeModal();
            }
        });
        
        // Window resize
        window.addEventListener('resize', handleResize);
    }

    function toggleMobileMenu() {
        const isOpening = !elements.navLinks.classList.contains('active');
        
        elements.navLinks.classList.toggle('active');
        elements.overlay.classList.toggle('active');
        elements.mobileMenu.innerHTML = isOpening 
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-bars"></i>';
        
        document.documentElement.style.overflow = isOpening ? 'hidden' : '';
    }

    function closeMobileMenu() {
        elements.navLinks.classList.remove('active');
        elements.overlay.classList.remove('active');
        elements.mobileMenu.innerHTML = '<i class="fas fa-bars"></i>';
        document.documentElement.style.overflow = '';
    }

    function jumpToSearch() {
        const filtersSection = document.querySelector('.property-filters');
        if (filtersSection && elements.filterSearch) {
            filtersSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            
            setTimeout(() => {
                if (elements.heroSearch && elements.heroSearch.value.trim()) {
                    elements.filterSearch.value = elements.heroSearch.value.trim();
                }
                elements.filterSearch.focus();
            }, 350);
        }
    }

    function handleResize() {
        if (window.innerWidth > 768 && elements.navLinks?.classList.contains('active')) {
            closeMobileMenu();
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ========== START THE APPLICATION ==========
    init();
});

// Add global styles
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        /* Loading skeleton */
        .skeleton-card {
            opacity: 0.7;
        }
        
        .skeleton-img {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            padding-top: 66.67%;
            width: 100%;
        }
        
        .skeleton-line {
            background: #f0f0f0;
            height: 14px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        
        .skeleton-circle {
            width: 40px;
            height: 40px;
            background: #f0f0f0;
            border-radius: 50%;
        }
        
        /* Property badges */
        .property-badge {
            position: absolute;
            top: 15px;
            left: 15px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            color: white;
            z-index: 2;
        }
        
        .badge-available { background: #28a745; }
        .badge-sold { background: #dc3545; }
        .badge-reserved { background: #ffc107; color: #212529; }
        
        /* Sold overlay */
        .sold-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
        }
        
        .sold-text {
            background: #dc3545;
            color: white;
            padding: 10px 25px;
            font-size: 1.2rem;
            font-weight: bold;
            border-radius: 4px;
            transform: rotate(-15deg);
        }
        
        .reserved-text {
            background: #ffc107;
            color: #212529;
            padding: 10px 25px;
            font-size: 1.2rem;
            font-weight: bold;
            border-radius: 4px;
            transform: rotate(-15deg);
        }
        
        /* Property features */
        .property-features {
            display: flex;
            gap: 15px;
            margin: 15px 0;
            padding: 10px 0;
            border-top: 1px solid #eee;
            border-bottom: 1px solid #eee;
            flex-wrap: wrap;
        }
        
        .feature {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
            color: #555;
        }
        
        .feature i {
            color: #28a745;
        }
        
        /* Modal styles */
        .property-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            overflow-y: auto;
        }
        
        .property-modal.active {
            display: block;
        }
        
        .modal-content {
            position: relative;
            background: white;
            margin: 50px auto;
            max-width: 900px;
            border-radius: 12px;
            overflow: hidden;
            animation: modalSlide 0.3s ease;
        }
        
        .modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.5);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-gallery {
            position: relative;
            height: 400px;
            overflow: hidden;
        }
        
        .modal-gallery .main-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .thumbnails {
            display: flex;
            gap: 10px;
            padding: 15px;
            background: #f8f9fa;
            overflow-x: auto;
        }
        
        .thumbnail {
            width: 80px;
            height: 60px;
            object-fit: cover;
            border-radius: 6px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.3s;
        }
        
        .thumbnail.active,
        .thumbnail:hover {
            opacity: 1;
            border: 2px solid #28a745;
        }
        
        .modal-info {
            padding: 30px;
        }
        
        .modal-top {
            padding: 30px 30px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-price {
            font-size: 1.5rem;
            font-weight: bold;
            color: #28a745;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f5f5f5;
        }
        
        .info-item:last-child {
            border-bottom: none;
        }
        
        .modal-section {
            margin-bottom: 25px;
        }
        
        .modal-section h3 {
            color: #333;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .features-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }
        
        .feature-tag {
            background: #f0f9ff;
            color: #0369a1;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
        }
        
        /* Pagination */
        .pagination {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
        }
        
        .pagination-btn {
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: 'Jost', sans-serif;
        }
        
        .pagination-btn:hover {
            border-color: #28a745;
            color: #28a745;
        }
        
        .pagination-btn.active {
            background: #28a745;
            color: white;
            border-color: #28a745;
        }
        
        /* Toast */
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 300px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        }
        
        .toast-warning {
            border-left: 4px solid #ffc107;
        }
        
        .toast-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .toast-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #999;
        }
        
        /* Animations */
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        
        @keyframes modalSlide {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
            .modal-content {
                margin: 0;
                height: 100vh;
                border-radius: 0;
            }
            
            .modal-gallery {
                height: 300px;
            }
            
            .modal-actions {
                flex-direction: column;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .property-features {
                justify-content: space-between;
            }
            
            .feature {
                flex: 0 0 calc(50% - 10px);
            }
        }
    `;
    document.head.appendChild(style);
});