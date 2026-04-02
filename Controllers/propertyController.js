const mongoose = require('mongoose');
const Property = require('../models/Property');
const cloudinary = require('../utils/cloudinary'); // ensure this exports the configured cloudinary.v2 instance

// ===================== HELPER FUNCTIONS =====================

function parsePrice(price) {
  if (typeof price === 'number') return Math.round(price);
  if (!price) return 0;
  
  const cleaned = price.toString()
    .replace(/KES\s*/i, '')
    .replace(/,/g, '')
    .trim();
  
  const numeric = parseFloat(cleaned);
  return isNaN(numeric) ? 0 : Math.round(numeric);
}

// ===================== GET ALL PROPERTIES =====================
exports.getProperties = async (req, res) => {
  try {
    console.log('📊 Fetching properties...');
    const properties = await Property.find().sort({ createdAt: -1 });
    
    console.log(`✅ Found ${properties.length} properties`);
    
    // Format properties for frontend
    const formatted = properties.map(p => ({
      _id: p._id,
      title: p.title,
      location: p.location,
      type: p.type,
      transaction: p.transaction || 'sale',
      priceNum: p.priceNum || 0,
      price: p.price || 'KES 0',
      bedrooms: p.bedrooms || 0,
      bathrooms: p.bathrooms || 0,
      parking: p.parking || 0,
      size: p.size || '',
      status: p.status || 'available',
      description: p.description || '',
      whatsapp: p.whatsapp || '254721911181',
      images: p.images || [],
      cloudinaryPublicIds: p.cloudinaryPublicIds || [],
      createdAt: p.createdAt
    }));

    res.json(formatted);

  } catch (err) {
    console.error('❌ Error in getProperties:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch properties',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== GET SINGLE PROPERTY =====================
exports.getPropertyById = async (req, res) => {
  try {
    console.log(`🔍 Fetching property: ${req.params.id}`);
    const property = await Property.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    res.json({
      success: true,
      data: {
        _id: property._id,
        title: property.title,
        location: property.location,
        type: property.type,
        transaction: property.transaction || 'sale',
        priceNum: property.priceNum || 0,
        price: property.price || 'KES 0',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        parking: property.parking || 0,
        size: property.size || '',
        status: property.status || 'available',
        description: property.description || '',
        whatsapp: property.whatsapp || '254721911181',
        images: property.images || [],
        cloudinaryPublicIds: property.cloudinaryPublicIds || [],
        createdAt: property.createdAt
      }
    });
  } catch (err) {
    console.error('❌ Error in getPropertyById:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch property',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== ADD NEW PROPERTY =====================
exports.addProperty = async (req, res) => {
  try {
    console.log('➕ Starting addProperty (Cloudinary)...');
    console.log('📦 Request body keys:', Object.keys(req.body));
    console.log('🖼️ req.processedFiles:', req.processedFiles ? req.processedFiles.length : 0);
    
    const {
      title,
      location,
      type,
      transaction = 'sale',
      price,
      priceNum,
      bedrooms = 0,
      bathrooms = 0,
      parking = 0,
      size = '',
      status = 'available',
      description = '',
      whatsapp = '254721911181'
    } = req.body;

    // ✅ Validate required fields: either price or priceNum must exist
    if (!title || !location || !type || (priceNum === undefined && !price)) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields',
        required: ['title', 'location', 'type', 'price or priceNum']
      });
    }

    // ✅ Prefer priceNum if provided, fallback to parsing price
    let numericPrice;
    if (priceNum !== undefined && priceNum !== null && priceNum !== '') {
      numericPrice = Number(priceNum);
    } else {
      numericPrice = parsePrice(price);
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price format',
        example: 'KES 8,500,000 or 8500000'
      });
    }

    numericPrice = Math.round(numericPrice);
    console.log(`💰 Price: ${numericPrice}`);

    // Get Cloudinary URLs and publicIds
    const images = req.processedFiles ? req.processedFiles.map(file => file.url) : [];
    const cloudinaryPublicIds = req.processedFiles ? req.processedFiles.map(file => file.publicId) : [];
    
    console.log(`🖼️ Cloudinary images to save: ${images.length} files`);
    console.log(`🔑 Cloudinary publicIds: ${cloudinaryPublicIds.length}`);

    // Format price for display
    const formattedPrice = `KES ${numericPrice.toLocaleString()}`;
    
    // Create property object
    const propertyData = {
      title: title.trim(),
      location: location.trim(),
      type: type.trim().toLowerCase(),
      transaction: transaction.trim().toLowerCase(),
      price: formattedPrice,
      priceNum: numericPrice,
      bedrooms: parseInt(bedrooms) || 0,
      bathrooms: parseInt(bathrooms) || 0,
      parking: parseInt(parking) || 0,
      size: (size || '').trim(),
      status: (status || 'available').trim().toLowerCase(),
      description: (description || '').trim(),
      whatsapp: (whatsapp || '254721911181').trim(),
      images: images,
      cloudinaryPublicIds: cloudinaryPublicIds
    };

    console.log('📝 Creating property with data:', {
      title: propertyData.title,
      location: propertyData.location,
      type: propertyData.type,
      transaction: propertyData.transaction,
      price: propertyData.price,
      imagesCount: propertyData.images.length
    });

    // Save to database
    const newProperty = new Property(propertyData);
    const savedProperty = await newProperty.save();
    
    console.log(`✅ Property saved with Cloudinary: ${savedProperty._id}`);

    res.status(201).json({
      success: true,
      data: savedProperty,
      message: 'Property added successfully with Cloudinary images'
    });

  } catch (err) {
    console.error('❌ Error in addProperty:', err);
    
    // Clean up Cloudinary images if there's an error
    if (req.processedFiles && req.processedFiles.length > 0) {
      console.log('🧹 Cleaning up Cloudinary images due to error...');
      await Promise.all(
        req.processedFiles.map(file => 
          cloudinary.uploader.destroy(file.publicId)
            .catch(cleanupErr => 
              console.warn('Failed to cleanup Cloudinary image:', cleanupErr.message)
            )
        )
      );
    }
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate property',
        error: 'A property with similar details already exists'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to add property',
      error: process.env.NODE_ENV === 'production' ? 'Server error. Please try again.' : err.message
    });
  }
};

// ===================== UPDATE PROPERTY (with publicId sync) =====================
exports.updateProperty = async (req, res) => {
  try {
    console.log(`✏️ Updating property: ${req.params.id}`);

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Parse update data (may be wrapped in "data" for FormData)
    let updateData = {};
    if (req.body && typeof req.body.data === 'string') {
      try {
        updateData = JSON.parse(req.body.data);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid JSON in "data" field' });
      }
    } else {
      updateData = { ...req.body };
    }

    // ----------------------------------------------------------------
    // 1) Determine the client's intended images list
    // ----------------------------------------------------------------
    // If updateData.images is provided, use it; otherwise keep existing DB images.
    const clientImages = Array.isArray(updateData.images)
      ? updateData.images
      : (property.images || []);

    // ----------------------------------------------------------------
    // 2) Build a map from existing DB URLs to publicIds
    // ----------------------------------------------------------------
    const urlToPublicId = new Map();
    (property.images || []).forEach((url, idx) => {
      const publicId = (property.cloudinaryPublicIds || [])[idx];
      if (publicId) urlToPublicId.set(url, publicId);
    });

    // ----------------------------------------------------------------
    // 3) Create aligned pairs for images that already exist in DB
    // ----------------------------------------------------------------
    const existingPairs = clientImages
      .map(url => ({ url, publicId: urlToPublicId.get(url) }))
      .filter(p => p.publicId !== undefined); // keep only those we can map

    let baseImages = existingPairs.map(p => p.url);
    let basePublicIds = existingPairs.map(p => p.publicId);

    // ----------------------------------------------------------------
    // 4) Append newly uploaded images (if any)
    // ----------------------------------------------------------------
    if (req.processedFiles && req.processedFiles.length > 0) {
      const newImages = req.processedFiles.map(f => f.url);
      const newPublicIds = req.processedFiles.map(f => f.publicId);
      baseImages = [...baseImages, ...newImages];
      basePublicIds = [...basePublicIds, ...newPublicIds];
    }

    // Set the final arrays in updateData
    updateData.images = baseImages;
    updateData.cloudinaryPublicIds = basePublicIds;

    // ----------------------------------------------------------------
    // Handle price updates
    // ----------------------------------------------------------------
    if (updateData.price !== undefined && updateData.price !== null && updateData.price !== '') {
      const n = parsePrice(updateData.price);
      if (n > 0) {
        updateData.priceNum = n;
        updateData.price = `KES ${n.toLocaleString()}`;
      }
    } else if (updateData.priceNum !== undefined && updateData.priceNum !== null && updateData.priceNum !== '') {
      const n = Number(updateData.priceNum);
      if (Number.isFinite(n) && n > 0) {
        updateData.priceNum = Math.round(n);
        updateData.price = `KES ${Math.round(n).toLocaleString()}`;
      }
    }

    // Normalize strings
    if (typeof updateData.title === 'string') updateData.title = updateData.title.trim();
    if (typeof updateData.location === 'string') updateData.location = updateData.location.trim();
    if (typeof updateData.type === 'string') updateData.type = updateData.type.trim().toLowerCase();
    if (typeof updateData.transaction === 'string') updateData.transaction = updateData.transaction.trim().toLowerCase();
    if (typeof updateData.status === 'string') updateData.status = updateData.status.trim().toLowerCase();
    if (typeof updateData.description === 'string') updateData.description = updateData.description.trim();
    if (typeof updateData.whatsapp === 'string') updateData.whatsapp = updateData.whatsapp.trim();

    // Update the property
    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Property updated: ${updatedProperty._id}`);

    return res.json({
      success: true,
      data: updatedProperty,
      message: 'Property updated successfully'
    });

  } catch (err) {
    console.error('❌ Error in updateProperty:', err);

    // Clean up Cloudinary images if there's an error
    if (req.processedFiles && req.processedFiles.length > 0) {
      console.log('🧹 Cleaning up Cloudinary images due to error...');
      await Promise.all(
        req.processedFiles.map(file =>
          cloudinary.uploader.destroy(file.publicId).catch(() => null)
        )
      );
    }

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: 'Validation error', errors });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update property',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== DELETE IMAGE (by index, using publicId) =====================
exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Cloudinary publicId is required'
      });
    }

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    // Find index of the image by publicId
    const idx = (property.cloudinaryPublicIds || []).indexOf(publicId);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found in property'
      });
    }

    // Remove from both arrays (keep them in sync)
    property.cloudinaryPublicIds.splice(idx, 1);
    property.images.splice(idx, 1);

    // Save before Cloudinary deletion? Either way, we need to persist the change.
    await property.save();

    // Delete from Cloudinary (don't wait if it fails, but log)
    cloudinary.uploader.destroy(publicId)
      .then(result => console.log(`🗑️ Deleted Cloudinary image: ${publicId}`, result))
      .catch(err => console.warn(`⚠️ Failed to delete from Cloudinary: ${publicId}`, err));

    console.log(`🗑️ Removed image from property: ${publicId}`);

    res.json({
      success: true,
      message: 'Image deleted successfully',
      data: {
        images: property.images,
        cloudinaryPublicIds: property.cloudinaryPublicIds
      }
    });

  } catch (err) {
    console.error('❌ Error deleting image:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete image',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== DELETE PROPERTY (CLOUDINARY VERSION) =====================
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    // Delete all images from Cloudinary
    if (property.cloudinaryPublicIds && property.cloudinaryPublicIds.length > 0) {
      console.log(`🗑️ Deleting ${property.cloudinaryPublicIds.length} images from Cloudinary...`);
      
      const deletionResults = await Promise.allSettled(
        property.cloudinaryPublicIds.map(publicId => 
          cloudinary.uploader.destroy(publicId)
            .then(result => ({ publicId, result }))
            .catch(error => ({ publicId, error }))
        )
      );

      deletionResults.forEach(result => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Deleted from Cloudinary: ${result.value.publicId}`);
        } else {
          console.warn('⚠️ Failed to delete from Cloudinary:', result.reason);
        }
      });
    }

    await property.deleteOne();
    
    console.log(`🗑️ Property deleted from database: ${req.params.id}`);
    
    res.json({
      success: true,
      message: 'Property deleted successfully from Cloudinary and database'
    });

  } catch (err) {
    console.error('❌ Error in deleteProperty:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete property',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== DEBUG ENDPOINT =====================
exports.debugInfo = async (req, res) => {
  try {
    const propertyCount = await Property.countDocuments();
    
    let cloudinaryInfo = {};
    try {
      const resources = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'propertybyfridah',
        max_results: 1
      });
      cloudinaryInfo = {
        totalResources: resources.total_count,
        rateLimitUsed: resources.rate_limit_allowed - resources.rate_limit_remaining,
        rateLimitAllowed: resources.rate_limit_allowed
      };
    } catch (cloudinaryErr) {
      cloudinaryInfo = { error: cloudinaryErr.message };
    }
    
    res.json({
      success: true,
      debug: {
        propertyCount,
        cloudinary: cloudinaryInfo,
        nodeEnv: process.env.NODE_ENV,
        mongoConnected: !!mongoose.connection.readyState,
        cloudinaryConfigured: !!process.env.CLOUDINARY_CLOUD_NAME
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};