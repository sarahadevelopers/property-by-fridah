const express = require('express');
const router = express.Router();
const Property = require('../models/Property');

function parseAcreSize(sizeStr) {
  if (!sizeStr) return null;
  const frac = sizeStr.match(/(\d+)\/(\d+)/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = sizeStr.match(/([\d.]+)/);
  return num ? parseFloat(num[1]) : null;
}

function getAvailability(status) {
  if (!status) return "https://schema.org/InStock";
  switch (status.toLowerCase()) {
    case "sold": return "https://schema.org/SoldOut";
    case "reserved": return "https://schema.org/Reserved";
    default: return "https://schema.org/InStock";
  }
}

router.get('/jsonld', async (req, res) => {
  const properties = await Property.find();

  const graph = [];

  // 🔹 Agent node (ONLY ONCE)
  graph.push({
    "@type": "RealEstateAgent",
    "@id": "https://propertybyfridah.com/#agent",
    "name": "Property by Fridah",
    "url": "https://propertybyfridah.com",
    "logo": "https://propertybyfridah.com/PropertyByFridah-favicon.webp",
    "telephone": "+254721911181",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Kitengela",
      "addressCountry": "KE"
    }
  });

  // 🔹 Property nodes
  properties.forEach(p => {
    let type = "House";
    if (p.type === "plot") type = "LandParcel";
    if (p.type === "apartment") type = "Apartment";

    graph.push({
      "@type": type,
      "@id": `https://propertybyfridah.com/properties/${p._id}`,
      "name": p.title,
      "description": p.description,
      "image": p.images.map(img =>
        `https://propertybyfridah.com/images/${img}`
      ),
      "address": {
        "@type": "PostalAddress",
        "addressLocality": p.location,
        "addressCountry": "KE"
      },
      ...(p.bedrooms ? { "numberOfRooms": p.bedrooms } : {}),
      ...(p.size ? {
        "floorSize": {
          "@type": "QuantitativeValue",
          "value": parseAcreSize(p.size),
          "unitCode": "ACR"
        }
      } : {}),
      "offers": {
        "@type": "Offer",
        "price": p.price,
        "priceCurrency": "KES",
        "availability": getAvailability(p.status),
        "seller": { "@id": "https://propertybyfridah.com/#agent" }
      },
      // ✅ Add timestamps for Google
      ...(p.createdAt ? { "datePosted": p.createdAt.toISOString() } : {}),
      ...(p.updatedAt ? { "dateModified": p.updatedAt.toISOString() } : {})
    });
  });

  res.json({
    "@context": "https://schema.org",
    "@graph": graph
  });
});

module.exports = router;
