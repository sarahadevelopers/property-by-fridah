const mongoose = require('mongoose');

// Direct connection to shard servers (bypasses SRV DNS)
const uri = 'mongodb://propertybyfridah:Fridah254Simple@ac-r26uh4l-shard-00-00.joar9ei.mongodb.net:27017,ac-r26uh4l-shard-00-01.joar9ei.mongodb.net:27017,ac-r26uh4l-shard-00-02.joar9ei.mongodb.net:27017/propertyByFridahDB?ssl=true&replicaSet=atlas-o8mhpq-shard-0&authSource=admin&retryWrites=true&w=majority';

console.log('Testing DIRECT connection to MongoDB Atlas...');
console.log('This bypasses SRV DNS resolution');

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