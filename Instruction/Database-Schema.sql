-- =====================================================
-- REEFEY APP DATABASE SCHEMA
-- =====================================================
-- Run this SQL script in Supabase SQL Editor to create the database structure
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- =====================================================
-- SPOTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS spots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50) CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    best_time VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MARINE SPECIES TABLE (Master Database)
-- =====================================================
CREATE TABLE IF NOT EXISTS marine (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    scientific_name VARCHAR(255),
    category VARCHAR(50) CHECK (category IN ('Fishes', 'Creatures', 'Corals')),
    rarity INTEGER CHECK (rarity >= 1 AND rarity <= 5),
    size_min_cm DECIMAL(8, 2),
    size_max_cm DECIMAL(8, 2),
    habitat_type TEXT[],
    diet VARCHAR(100),
    behavior VARCHAR(100),
    danger VARCHAR(50) CHECK (danger IN ('Low', 'Medium', 'High', 'Extreme')),
    venomous BOOLEAN DEFAULT FALSE,
    description TEXT,
    life_span VARCHAR(100),
    reproduction VARCHAR(200),
    migration VARCHAR(100),
    endangered VARCHAR(100),
    fun_fact TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SPOT-MARINE JUNCTION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS spot_marine (
    id SERIAL PRIMARY KEY,
    spot_id INTEGER REFERENCES spots(id) ON DELETE CASCADE,
    marine_id INTEGER REFERENCES marine(id) ON DELETE CASCADE,
    frequency VARCHAR(50) CHECK (frequency IN ('Common', 'Occasional', 'Rare')),
    seasonality VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(spot_id, marine_id)
);

-- =====================================================
-- COLLECTIONS TABLE (User Findings)
-- =====================================================
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    marine_id INTEGER REFERENCES marine(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'identified' CHECK (status IN ('identified', 'unknown', 'pending')),
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- COLLECTION PHOTOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS collection_photos (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    annotated_url TEXT,
    date_found TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    spot_id INTEGER REFERENCES spots(id) ON DELETE SET NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    bounding_box JSONB,
    notes TEXT,
    storage_bucket VARCHAR(100),
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Spots indexes
CREATE INDEX IF NOT EXISTS idx_spots_location ON spots USING GIST (ll_to_earth(lat::double precision, lng::double precision));
CREATE INDEX IF NOT EXISTS idx_spots_name ON spots USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_spots_created_at ON spots(created_at);

-- Marine indexes
CREATE INDEX IF NOT EXISTS idx_marine_name ON marine USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_marine_scientific_name ON marine USING GIN (scientific_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_marine_category ON marine(category);
CREATE INDEX IF NOT EXISTS idx_marine_rarity ON marine(rarity);
CREATE INDEX IF NOT EXISTS idx_marine_habitat ON marine USING GIN (habitat_type);

-- Spot-marine indexes
CREATE INDEX IF NOT EXISTS idx_spot_marine_spot_id ON spot_marine(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_marine_marine_id ON spot_marine(marine_id);

-- Collections indexes
CREATE INDEX IF NOT EXISTS idx_collections_device_id ON collections(device_id);
CREATE INDEX IF NOT EXISTS idx_collections_marine_id ON collections(marine_id);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);
CREATE INDEX IF NOT EXISTS idx_collections_first_seen ON collections(first_seen);

-- Collection photos indexes
CREATE INDEX IF NOT EXISTS idx_collection_photos_collection_id ON collection_photos(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_photos_date_found ON collection_photos(date_found);
CREATE INDEX IF NOT EXISTS idx_collection_photos_spot_id ON collection_photos(spot_id);
CREATE INDEX IF NOT EXISTS idx_collection_photos_confidence ON collection_photos(confidence);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_spots_updated_at BEFORE UPDATE ON spots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marine_updated_at BEFORE UPDATE ON marine FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate distance between two points
DROP FUNCTION IF EXISTS calculate_distance(numeric, numeric, numeric, numeric);
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT earth_distance(ll_to_earth(lat1, lng1), ll_to_earth(lat2, lng2)) / 1000.0 -- Convert to kilometers
$$;

-- Function to generate unique filename
CREATE OR REPLACE FUNCTION generate_unique_filename(prefix TEXT, extension TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || 
           (RANDOM() * 1000000)::INTEGER || '.' || extension;
END;
$$ LANGUAGE plpgsql;

-- Function to get storage URL
CREATE OR REPLACE FUNCTION get_storage_url(bucket_name TEXT, file_path TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN 'https://' || bucket_name || '.supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path;
END;
$$ LANGUAGE plpgsql;

-- Function to validate image extension
CREATE OR REPLACE FUNCTION is_valid_image_extension(filename TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(RIGHT(filename, 4)) IN ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp') OR
           LOWER(RIGHT(filename, 5)) IN ('.heic', '.heif');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STORAGE POLICIES (Single bucket approach)
-- =====================================================

-- reefey-photos bucket policies
CREATE POLICY "Public read reefey-photos" ON storage.objects
FOR SELECT USING (bucket_id = 'reefey-photos');

CREATE POLICY "Public upload reefey-photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'reefey-photos');

CREATE POLICY "Public update reefey-photos" ON storage.objects
FOR UPDATE USING (bucket_id = 'reefey-photos');

CREATE POLICY "Public delete reefey-photos" ON storage.objects
FOR DELETE USING (bucket_id = 'reefey-photos');

-- =====================================================
-- SCHEMA SETUP COMPLETE
-- =====================================================
-- Database tables, indexes, triggers, helper functions, and security policies have been created
-- Next: Run Database-Data.sql to insert sample data
-- Then: Get API keys from Settings → API
