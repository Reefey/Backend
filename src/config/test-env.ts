import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function testEnvironment() {
  console.log('🔍 Testing environment configuration...\n');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ];
  
  const optionalVars = [
    'PORT',
    'NODE_ENV',
    'AI_RATE_LIMIT_PER_DAY',
    'AI_CONFIDENCE_THRESHOLD',
    'AI_MAX_FILE_SIZE',
    'AI_TIMEOUT',
    'STORAGE_BUCKET'
  ];
  
  console.log('📋 Required Environment Variables:');
  let allRequiredSet = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`  ❌ ${varName}: NOT SET`);
      allRequiredSet = false;
    }
  }
  
  console.log('\n📋 Optional Environment Variables:');
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName}: ${value}`);
    } else {
      console.log(`  ⚪ ${varName}: not set (using default)`);
    }
  }
  
  console.log('\n📊 Summary:');
  if (allRequiredSet) {
    console.log('✅ All required environment variables are set!');
    console.log('🚀 You can run the full connection test with: npm run test');
  } else {
    console.log('❌ Some required environment variables are missing!');
    console.log('📝 Please check your .env file and set the missing variables.');
    console.log('\nExample .env file:');
    console.log('PORT=3000');
    console.log('NODE_ENV=development');
    console.log('SUPABASE_URL=https://your-project-id.supabase.co');
    console.log('SUPABASE_ANON_KEY=your-anon-key-here');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here');
    console.log('OPENAI_API_KEY=your-openai-api-key-here');
  }
}

// Run the test
testEnvironment();
