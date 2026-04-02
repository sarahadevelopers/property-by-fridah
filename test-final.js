const mongoose = require('mongoose');

// Correct URI with authSource
const uri = 'mongodb+srv://propertybyfridah:Fridah254Simple@cluster0.joar9ei.mongodb.net/propertyByFridahDB?retryWrites=true&w=majority&authSource=admin';

console.log('Testing MongoDB connection with authSource=admin...');
console.log('URI:', uri.replace('Fridah254Simple', '******'));

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  family: 4
})
.then(() => {
  console.log('✅ CONNECTED SUCCESSFULLY!');
  console.log('Database:', mongoose.connection.name);
  console.log('Host:', mongoose.connection.host);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Error:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});