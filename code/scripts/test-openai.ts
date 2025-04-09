#!/usr/bin/env ts-node
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Check if API key is set
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: apiKey,
});

// Simple text test
async function testText() {
  try {
    console.log('Testing text completion...');
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say "OpenAI connection is working!" if you can read this.' }
      ],
    });
    
    console.log('✅ Text API Test Result:');
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error('❌ Text API Test Failed:', error);
  }
}

// Test if gpt-4o model exists
async function testModels() {
  try {
    console.log('\nChecking available models...');
    const models = await openai.models.list();
    const modelIds = models.data.map((model: { id: string }) => model.id);
    
    const gpt4o = modelIds.find((id: string) => id === 'gpt-4o');
    if (gpt4o) {
      console.log('✅ gpt-4o model is available');
    } else {
      console.log('❌ gpt-4o model not found. Available models that might support vision:');
      const possibleVisionModels = modelIds.filter((id: string) => 
        id.includes('gpt-4') || id.includes('vision') || id.includes('dall-e')
      );
      console.log(possibleVisionModels.join('\n'));
    }
  } catch (error) {
    console.error('❌ Model List Test Failed:', error);
  }
}

// Main test function
async function runTests() {
  console.log('🔍 Testing OpenAI API Connection\n');
  
  await testText();
  await testModels();
  
  console.log('\n✨ Tests completed');
}

// Run the tests
runTests().catch(console.error); 