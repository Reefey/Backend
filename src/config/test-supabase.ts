import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  
  // Check if environment variables are set
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Environment variables not configured!');
    console.error('Please set the following variables in your .env file:');
    console.error('- SUPABASE_URL');
    console.error('- SUPABASE_ANON_KEY');
    console.error('\nExample:');
    console.error('SUPABASE_URL=https://your-project-id.supabase.co');
    console.error('SUPABASE_ANON_KEY=your-anon-key-here');
    process.exit(1);
  }
  
  try {
    console.log('📡 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test database connection
    console.log('🗄️  Testing database connection...');
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('\nPossible issues:');
      console.error('1. Database tables not created - run the SQL setup script');
      console.error('2. Invalid credentials - check your Supabase URL and keys');
      console.error('3. Network connectivity issues');
      process.exit(1);
    }
    
    console.log('✅ Database connected successfully!');
    console.log(`📊 Found ${data?.length || 0} records in spots table`);
    
    // Test storage connection
    console.log('\n📦 Testing storage connection...');
    const { error: storageError } = await supabase.storage
      .from('reefey-photos')
      .list('', { limit: 1 });
    
    if (storageError) {
      console.warn('⚠️  Storage connection failed:', storageError.message);
      console.warn('Make sure you have created the storage bucket:');
      console.warn('- reefey-photos');
    } else {
      console.log('✅ Storage connected successfully!');
    }
    
    console.log('\n🎉 All tests completed!');
    console.log('🚀 You can now start the server with: npm run dev');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConnection();
