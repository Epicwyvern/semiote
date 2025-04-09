#!/usr/bin/env ts-node

// Script to check if required environment variables are set
console.log('Checking environment variables...');

const checkEnv = (name: string): boolean => {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing environment variable: ${name}`);
    return false;
  }
  console.log(`✅ Found ${name}`);
  return true;
};

// Check required variables
const requiredVars = ['OPENAI_API_KEY', 'GOOGLE_BOOKS_API_KEY'];
const allPresent = requiredVars.every(checkEnv);

if (allPresent) {
  console.log('✅ All required environment variables are set');
} else {
  console.error('❌ Some environment variables are missing');
  console.log('\nMake sure you have created a .env.local file with the following variables:');
  console.log('OPENAI_API_KEY=your_openai_api_key');
  console.log('GOOGLE_BOOKS_API_KEY=your_google_books_api_key');
  process.exit(1);
}

// Test OpenAI API key format
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey && !openaiKey.startsWith('sk-')) {
  console.warn('⚠️ Warning: Your OpenAI API key does not start with "sk-". This may not be a valid key.');
}

console.log('\nYou can now run the development server:');
console.log('npm run dev'); 