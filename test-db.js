// test-db.js
const mongoose = require('mongoose');

const uri = 'mongodb+srv://propertybyfridah:Fridah254Simple@cluster0.joar9ei.mongodb.net/propertyByFridahDB?retryWrites=true&w=majority';

console.log('Testing MongoDB connection...');
console.log('URI:', uri.replace('Fridah254Simple', '******'));

mongoose.connect(uri)
  .then(() => {
    console.log('✅ CONNECTED SUCCESSFULLY!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });