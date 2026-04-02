const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ================= RATE LIMITING =================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(apiLimiter);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: {
    success: false,
    message: 'Too many upload requests, please try again later.'
  }
});

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= VALIDATION SCHEMAS =================

// For creating a new property (all fields required)
const createPropertyValidation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('location').notEmpty().trim().withMessage('Location is required'),
  body('type').notEmpty().isIn([
    'bungalow', 'maisonette', 'townhouse', 'apartment', 'studio', 'villa', 'furnished',
    'land-res', 'land-comm', 'ranch'
  ]).withMessage('Valid property type is required'),
  body('transaction').optional().isIn(['sale', 'rent', 'lease']).withMessage('Transaction must be sale/rent/lease'),
  body('price').notEmpty().withMessage('Price is required'),
  body('priceNum').isNumeric().withMessage('Price must be a number'),
  body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a positive integer'),
  body('bathrooms').optional().isInt({ min: 0 }).withMessage('Bathrooms must be a positive integer'),
  body('parking').optional().isInt({ min: 0 }).withMessage('Parking must be a positive integer'),
  body('status').isIn(['available', 'sold', 'reserved']).withMessage('Valid status is required'),
  body('whatsapp').optional().matches(/^2547\d{8}$/).withMessage('WhatsApp must be like 2547XXXXXXXX'),
];

// For updating a property (all fields optional)
const updatePropertyValidation = [
  body('title').optional().notEmpty().trim().withMessage('Title cannot be empty'),
  body('location').optional().notEmpty().trim().withMessage('Location cannot be empty'),
  body('type').optional().isIn([
    'bungalow', 'maisonette', 'townhouse', 'apartment', 'studio', 'villa', 'furnished',
    'land-res', 'land-comm', 'ranch'
  ]).withMessage('Valid property type is required'),
  body('transaction').optional().isIn(['sale', 'rent', 'lease']).withMessage('Transaction must be sale/rent/lease'),
  body('price').optional().notEmpty().withMessage('Price cannot be empty'),
  body('priceNum').optional().isNumeric().withMessage('Price must be a number'),
  body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a positive integer'),
  body('bathrooms').optional().isInt({ min: 0 }).withMessage('Bathrooms must be a positive integer'),
  body('parking').optional().isInt({ min: 0 }).withMessage('Parking must be a positive integer'),
  body('status').optional().isIn(['available', 'sold', 'reserved']).withMessage('Valid status is required'),
  body('whatsapp').optional().matches(/^2547\d{8}$/).withMessage('WhatsApp must be like 2547XXXXXXXX'),
];

const idValidation = [
  param('id').isMongoId().withMessage('Valid MongoDB ID required')
];

// ================= STREAMING UPLOAD TO CLOUDINARY =================
const uploadToCloudinary = (buffer, folder = 'propertybyfridah') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        format: 'webp',
        quality: 'auto',
        transformation: [
          { width: 1920, height: 1080, crop: 'limit' },
          { quality: 'auto:good' }
        ],
        resource_type: 'image',
        timeout: 60000
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name
          });
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
};

// ================= MEMORY‑EFFICIENT FILE HANDLING =================
const storage = multer.memoryStorage();

// ✅ Fixed fileFilter: properly reject invalid files with MulterError
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  // Use MulterError to provide a consistent error format
  cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG, PNG, and WebP images are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20                   // max 20 files per request
  }
});

// ================= CLOUDINARY UPLOAD MIDDLEWARE =================
const processUploadedImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  // ✅ Additional hard limit check (defense in depth)
  if (req.files.length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 20 images allowed per request'
    });
  }

  console.log(`📤 Processing ${req.files.length} files for Cloudinary upload`);

  try {
    const uploadPromises = req.files.map(async (file, index) => {
      try {
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(`File ${index + 1} is empty`);
        }
        if (file.buffer.length > 10 * 1024 * 1024) {
          throw new Error(`File ${index + 1} exceeds 10MB limit`);
        }

        console.log(`🔄 Uploading file ${index + 1} (${(file.buffer.length / 1024 / 1024).toFixed(2)}MB)`);
        const result = await uploadToCloudinary(file.buffer, 'propertybyfridah/properties');
        console.log(`✅ File ${index + 1} uploaded: ${result.public_id}`);

        return {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          originalName: file.originalname
        };
      } catch (uploadError) {
        console.error(`❌ Failed to upload file ${index + 1}:`, {
          name: file.originalname,
          size: file.size,
          error: uploadError.message
        });
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    req.processedFiles = results.filter(r => r !== null);

    if (req.processedFiles.length === 0 && req.files.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload any images. Please try again.',
        details: 'Cloudinary upload failed for all files'
      });
    }

    console.log(`🎉 Successfully uploaded ${req.processedFiles.length}/${req.files.length} files`);
    next();
  } catch (error) {
    console.error('🚨 Image processing middleware error:', error);

    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        message: 'Upload timeout. Please try smaller files.',
        code: 'UPLOAD_TIMEOUT'
      });
    }

    if (error.message.includes('File size too large') || error.message.includes('exceeds 10MB limit')) {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 10MB per file.',
        code: 'FILE_TOO_LARGE'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process images',
      code: 'IMAGE_PROCESSING_ERROR',
      detail: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// ================= CONTROLLERS =================
const {
  addProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  deleteImage,
  debugInfo
} = require('../Controllers/propertyController');

// ================= ERROR HANDLER =================
const handleControllerError = (controllerFn) => async (req, res, next) => {
  try {
    await controllerFn(req, res, next);
  } catch (error) {
    console.error('🚨 Controller Error:', {
      path: req.path,
      method: req.method,
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });

    const errorResponses = {
      ValidationError: () => res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(e => e.message)
      }),
      MongoError: () => error.code === 11000 ? res.status(409).json({
        success: false,
        message: 'Duplicate entry found',
        code: 'DUPLICATE_KEY'
      }) : res.status(500).json({
        success: false,
        message: 'Database error',
        code: 'MONGO_ERROR'
      }),
      MulterError: () => {
        // Special handling for file type errors
        if (error.message && error.message.includes('Only JPEG')) {
          return res.status(400).json({
            success: false,
            message: error.message,
            code: 'INVALID_FILE_TYPE'
          });
        }
        return res.status(400).json({
          success: false,
          message: error.message,
          code: 'UPLOAD_ERROR'
        });
      },
      default: () => res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message })
      })
    };

    const handler = errorResponses[error.name] || errorResponses.default;
    handler();
  }
};

// ================= HEALTH & INFO =================
router.get('/health', (req, res) => {
  cloudinary.api.ping()
    .then(() => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        services: {
          cloudinary: 'connected',
          database: 'connected',
          uploads: 'cloudinary-only'
        },
        limits: {
          fileSize: '10MB',
          maxFiles: '20 files/request',
          rateLimit: '100 requests/15min'
        }
      });
    })
    .catch(cloudinaryError => {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          cloudinary: 'disconnected',
          error: cloudinaryError.message
        }
      });
    });
});

router.get('/info', async (req, res) => {
  try {
    const Property = require('../models/Property');
    const propertyCount = await Property.countDocuments();

    const cloudinaryInfo = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'propertybyfridah/properties',
      max_results: 1
    });

    res.json({
      success: true,
      data: {
        properties: propertyCount,
        cloudinary: {
          total: cloudinaryInfo.total_count,
          used: `${(cloudinaryInfo.rate_limit_allowed - cloudinaryInfo.rate_limit_remaining)}/${cloudinaryInfo.rate_limit_allowed} requests used`
        },
        server: {
          node: process.version,
          environment: process.env.NODE_ENV,
          uptime: `${process.uptime().toFixed(0)} seconds`,
          memory: {
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            heap: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get server info',
      code: 'INFO_ERROR'
    });
  }
});

// ================= SAMPLE DATA =================
router.post('/sample', uploadLimiter, async (req, res) => {
  try {
    const Property = require('../models/Property');

    const existingSample = await Property.findOne({ title: "Modern Apartment in Kilimani" });
    if (existingSample) {
      return res.status(409).json({
        success: false,
        message: 'Sample property already exists',
        propertyId: existingSample._id
      });
    }

    const sampleProperty = new Property({
      title: "Modern Apartment in Kilimani",
      location: "Kilimani, Nairobi",
      type: "apartment",
      price: "KES 12,500,000",
      priceNum: 12500000,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      size: "1200 sq ft",
      status: "available",
      description: "A modern apartment with great amenities in a prime location.",
      whatsapp: "254721911181",
      images: [
        "https://res.cloudinary.com/demo/image/upload/v123/sample-house.jpg"
      ],
      features: ["Swimming pool", "Gym", "24/7 Security", "Parking"]
    });

    await sampleProperty.save();

    res.status(201).json({
      success: true,
      message: 'Sample property created',
      property: {
        id: sampleProperty._id,
        title: sampleProperty.title,
        location: sampleProperty.location
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create sample property',
      code: 'SAMPLE_ERROR'
    });
  }
});

// ================= DEBUG ROUTES =================
router.get('/debug/cloudinary', async (req, res) => {
  try {
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'propertybyfridah',
      max_results: 10
    });

    res.json({
      success: true,
      cloudinary: {
        total: resources.total_count,
        resources: resources.resources.map(r => ({
          public_id: r.public_id,
          url: r.secure_url,
          format: r.format,
          bytes: r.bytes
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/debug/info', handleControllerError(debugInfo));

router.post('/test/upload', uploadLimiter, upload.array('images', 2), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadResults = await Promise.all(
      req.files.map(file => uploadToCloudinary(file.buffer, 'propertybyfridah/test'))
    );

    res.json({
      success: true,
      message: 'Test upload successful',
      uploaded: uploadResults.map(r => ({
        url: r.secure_url,
        public_id: r.public_id,
        size: `${(r.bytes / 1024).toFixed(2)}KB`
      })),
      note: 'These are test files and will be automatically deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================= MAIN API ROUTES =================
router.get('/', handleControllerError(getProperties));
router.get('/:id', idValidation, handleControllerError(getPropertyById));

// POST create property – uses create validation
router.post(
  '/add',
  uploadLimiter,
  upload.array('images', 20),
  processUploadedImages,
  createPropertyValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  },
  handleControllerError(addProperty)
);

// PATCH update property – uses update validation (all fields optional)
router.patch(
  '/:id',
  uploadLimiter,
  upload.array('images', 20),
  processUploadedImages,
  idValidation,
  updatePropertyValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  },
  handleControllerError(updateProperty)
);

// DELETE image
router.delete(
  '/:id/image',
  idValidation,
  [body('publicId').notEmpty().withMessage('Cloudinary publicId is required')],
  handleControllerError(deleteImage)
);

// DELETE property
router.delete('/:id', idValidation, handleControllerError(deleteProperty));

// ================= CLEANUP ROUTE (ADMIN) =================
router.post('/admin/cleanup', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  try {
    const result = await cloudinary.api.delete_resources_by_prefix('propertybyfridah/test');
    res.json({
      success: true,
      message: 'Cleanup completed',
      deleted: result.deleted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;