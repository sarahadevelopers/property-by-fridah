const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Property type is required'],
    enum: [
      'bungalow', 'maisonette', 'townhouse', 'apartment', 'studio', 'villa', 'furnished',
      'land-res', 'land-comm', 'ranch'
    ],
    lowercase: true
  },
  transaction: {
    type: String,
    enum: ['sale', 'rent', 'lease'],
    default: 'sale',
    lowercase: true
  },
  price: {
    type: String,
    required: [true, 'Price is required']
  },
  priceNum: {
    type: Number,
    required: [true, 'Price number is required'],
    min: [0, 'Price must be positive']
  },
  bedrooms: {
    type: Number,
    default: 0,
    min: [0, 'Bedrooms cannot be negative']
  },
  bathrooms: {
    type: Number,
    default: 0,
    min: [0, 'Bathrooms cannot be negative']
  },
  parking: {
    type: Number,
    default: 0,
    min: [0, 'Parking cannot be negative']
  },
  size: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['available', 'sold', 'reserved'],
    default: 'available',
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  whatsapp: {
    type: String,
    required: [true, 'WhatsApp number is required'],
    trim: true,
    match: [/^2547\d{8}$/, 'WhatsApp must be like 2547XXXXXXXX']
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return false;
        return v.includes('cloudinary.com') || v.startsWith('http');
      },
      message: 'Image must be a valid URL'
    }
  }],
  cloudinaryPublicIds: [{
    type: String
  }],
  features: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true // automatically adds createdAt and updatedAt
});

// Add indexes for better performance
propertySchema.index({ location: 1, type: 1, status: 1 });
propertySchema.index({ priceNum: 1 });
propertySchema.index({ createdAt: -1 });

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;