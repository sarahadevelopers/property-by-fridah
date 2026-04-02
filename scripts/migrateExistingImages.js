require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const { uploadToCloudinary } = require('../middleware/cloudinaryUpload');
const fs = require('fs').promises;
const path = require('path');

async function migrateExistingImages() {
  console.log('🔄 Starting image migration to Cloudinary...');
  
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find properties with local image paths (not Cloudinary)
  const properties = await Property.find({
    images: { $not: { $all: [/cloudinary\.com/] } }
  });
  
  console.log(`📦 Found ${properties.length} properties to migrate`);
  
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    console.log(`\n📍 Processing property ${i + 1}/${properties.length}: ${property.title}`);
    
    const migratedImages = [];
    const cloudinaryPublicIds = [];
    
    for (const imageUrl of property.images) {
      try {
        // If already Cloudinary URL, extract public ID
        if (imageUrl.includes('cloudinary.com')) {
          console.log(`✅ Already Cloudinary URL: ${imageUrl}`);
          migratedImages.push(imageUrl);
          
          // Extract public ID from URL
          const match = imageUrl.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
          if (match && match[1]) {
            cloudinaryPublicIds.push(match[1]);
          }
          continue;
        }
        
        // For local images, extract the filename and look in backups/uploads
        const filename = path.basename(imageUrl);
        const filePath = path.join(__dirname, '..', 'backups', 'uploads', filename);
        
        // Check if file exists
        try {
          await fs.access(filePath);
          
          // Read file and upload to Cloudinary
          console.log(`📤 Uploading: ${filePath}`);
          const fileBuffer = await fs.readFile(filePath);
          
          const result = await uploadToCloudinary(fileBuffer, 'propertybyfridah/migrated');
          console.log(`✅ Uploaded to: ${result.secure_url}`);
          
          migratedImages.push(result.secure_url);
          cloudinaryPublicIds.push(result.public_id);
          
        } catch (err) {
          console.warn(`⚠️ File not found: ${filePath}, keeping original URL`);
          migratedImages.push(imageUrl);
        }
        
      } catch (error) {
        console.error(`❌ Error processing image:`, error.message);
        migratedImages.push(imageUrl); // Keep original on error
      }
    }
    
    // Update property
    property.images = migratedImages;
    property.cloudinaryPublicIds = cloudinaryPublicIds;
    await property.save();
    
    console.log(`✅ Updated property with ${migratedImages.length} Cloudinary images`);
  }
  
  console.log('\n🎉 Migration completed successfully!');
  process.exit(0);
}

migrateExistingImages().catch(console.error);