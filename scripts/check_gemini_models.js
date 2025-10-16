#!/usr/bin/env node
/**
 * Check available Gemini models without consuming credits
 */

const https = require('https');

async function checkGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY not found in environment');
    return;
  }

  console.log('🔍 Checking available Gemini models...');

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models?key=${apiKey}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.models) {
          console.log('✅ Available Gemini models:');
          response.models.forEach(model => {
            console.log(`  - ${model.name}`);
          });

          // Find models that support generateContent
          const generateContentModels = response.models.filter(model =>
            model.supportedGenerationMethods &&
            model.supportedGenerationMethods.includes('generateContent')
          );

          console.log('\n📝 Models supporting generateContent:');
          generateContentModels.forEach(model => {
            console.log(`  - ${model.name}`);
          });
        } else {
          console.log('❌ No models found in response');
          console.log('Response:', data);
        }
      } catch (e) {
        console.log('❌ Failed to parse response:', e.message);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ Request failed:', error.message);
  });

  req.end();
}

checkGeminiModels();
