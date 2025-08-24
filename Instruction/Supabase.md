# Supabase Setup Guide for Reefey App

## Overview
Complete setup guide for creating a Supabase instance for the Reefey snorkeling app.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project: `reefey-app`
3. Choose region and set database password
4. Wait for setup completion

## Step 2: Storage Bucket Setup

### Create Storage Bucket

1. Go to "Storage" in Supabase dashboard
2. Create bucket: `reefey-photos`
   - Public bucket: ✅
   - File size limit: 10MB
   - Allowed MIME types: `image/*`

## Step 3: Database Setup

### Run SQL Scripts

1. Go to "SQL Editor" in your Supabase dashboard
2. **First**: Copy and paste the entire content of `Database-Schema.sql` file
3. Click "Run" to create the database structure
4. **Second**: Copy and paste the entire content of `Database-Data.sql` file
5. Click "Run" to insert sample data

The scripts include:
- **Database-Schema.sql**: Tables, indexes, triggers, helper functions, storage policies
- **Database-Data.sql**: Sample data (spots, marine species, relationships)

### Storage Policies

Storage policies are already included in the `Database-Schema.sql` script. No additional SQL needed.

## Step 4: Row Level Security

RLS policies are already included in the `Database-Schema.sql` script. No additional configuration needed.

## Step 5: Get API Keys

1. Go to Settings → API
2. Copy:
   - Project URL
   - anon public key
   - service_role secret key

## Step 6: Environment Variables

Create `.env` file:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
OPENAI_API_KEY=your-openai-api-key-here
PORT=3000
NODE_ENV=development
```

## File Structure

```
reefey-photos/
├── collections/{device_id}/{species}/
│   ├── photo1.jpg                    # Original photo
│   ├── photo1_annotated.jpg          # AI-annotated version
│   └── photo2.jpg
├── marine/{marine_id}/
│   ├── clownfish.jpg                 # Reference image
│   └── clownfish_preview.jpg         # Preview version
└── spots/{spot_id}/
    └── spot1.jpg
```

## Next Steps

1. ✅ Database structure created (Database-Schema.sql)
2. ✅ Sample data inserted (Database-Data.sql)
3. ✅ Storage bucket configured
4. ✅ RLS policies enabled
5. ✅ API keys obtained
6. 🔄 Connect backend server
7. 🔄 Test all endpoints
8. 🔄 Deploy to production

Your Supabase instance is ready for the Reefey app! 🐠
