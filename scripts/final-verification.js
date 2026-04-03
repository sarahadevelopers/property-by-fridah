// scripts/final-verification.js
const axios = require('axios');

async function verifyDeployment() {
  const baseUrl = process.env.API_URL || 'https://propertybyfridahnew-db-user.onrender.com';
  
  const tests = [
    { name: 'Health Check', endpoint: '/api/properties/health', method: 'GET' },
    { name: 'Get Properties', endpoint: '/api/properties', method: 'GET' },
    { name: 'Get Sample Data', endpoint: '/api/properties/sample', method: 'GET' },
  ];
  
  console.log('🔍 Running deployment verification...');
  
  for (const test of tests) {
    try {
      const response = await axios({
        method: test.method,
        url: baseUrl + test.endpoint,
        timeout: 10000
      });
      
      console.log(`✅ ${test.name}: ${response.status} - ${response.data.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
  
  console.log('🎉 Verification complete!');
}

verifyDeployment();