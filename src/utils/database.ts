import { createClient } from '@supabase/supabase-js';
import { config } from '../config/global';

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// Create read-only client for public data
export const supabasePublic = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Database utility functions
export class DatabaseService {
  private client: any; // Changed from SupabaseClient to any as SupabaseClient is removed

  constructor(client: any = supabase) { // Changed from SupabaseClient to any
    this.client = client;
  }

  // Get spots with filtering and pagination
  async getSpots(params: {
    lat?: number;
    lng?: number;
    radius?: number;
    q?: string;
    sort?: string;
    page?: number;
    size?: number;
  }) {
    const { lat, lng, radius = 10, q, sort = 'name', page = 1, size = 50 } = params;
    const offset = (page - 1) * size;

    let query = this.client
      .from('spots')
      .select('*', { count: 'exact' });

    // Location-based filtering
    if (lat && lng) {
      query = query.filter('lat', 'gte', lat - radius / 111)
                   .filter('lat', 'lte', lat + radius / 111)
                   .filter('lng', 'gte', lng - radius / 111)
                   .filter('lng', 'lte', lng + radius / 111);
    }

    // Text search
    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Sorting
    switch (sort) {
      case 'distance':
        if (lat && lng) {
          query = query.order('lat', { ascending: true });
        } else {
          query = query.order('name', { ascending: true });
        }
        break;
      case 'createdAt':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('name', { ascending: true });
    }

    // Pagination
    query = query.range(offset, offset + size - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // Transform snake_case to camelCase
    const transformedData = data?.map((spot: any) => ({
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      description: spot.description,
      difficulty: spot.difficulty,
      bestTime: spot.best_time,
      createdAt: spot.created_at,
      updatedAt: spot.updated_at
    })) || [];

    const total = count || 0;
    const totalPages = Math.ceil(total / size);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      data: transformedData,
      total,
      page,
      size,
      totalPages,
      hasNext,
      hasPrevious
    };
  }

  // Get spot by ID with marine species
  async getSpotById(id: number) {
    const { data, error } = await this.client
      .from('spots')
      .select(`
        *,
        spot_marine (
          frequency,
          seasonality,
          notes,
          marine (
            id,
            name,
            scientific_name,
            rarity
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      name: data.name,
      lat: data.lat,
      lng: data.lng,
      description: data.description,
      difficulty: data.difficulty,
      bestTime: data.best_time,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      spotMarine: data.spot_marine?.map((sm: any) => ({
        frequency: sm.frequency,
        seasonality: sm.seasonality,
        notes: sm.notes,
        marine: sm.marine ? {
          id: sm.marine.id,
          name: sm.marine.name,
          scientificName: sm.marine.scientific_name,
          rarity: sm.marine.rarity
        } : null
      })) || []
    };
  }

  // Create new spot
  async createSpot(spotData: {
    name: string;
    lat: number;
    lng: number;
    description?: string;
    difficulty?: string;
    bestTime?: string;
  }) {
    const { data, error } = await this.client
      .from('spots')
      .insert({
        name: spotData.name,
        lat: spotData.lat,
        lng: spotData.lng,
        description: spotData.description,
        difficulty: spotData.difficulty,
        best_time: spotData.bestTime
      })
      .select()
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      name: data.name,
      lat: data.lat,
      lng: data.lng,
      description: data.description,
      difficulty: data.difficulty,
      bestTime: data.best_time,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Delete spot
  async deleteSpot(id: number) {
    const { error } = await this.client
      .from('spots')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Create spot-marine relationship
  async createSpotMarineRelationship(spotId: number, marineId: number, frequency: string, seasonality?: string, notes?: string) {
    const { error } = await this.client
      .from('spot_marine')
      .insert({
        spot_id: spotId,
        marine_id: marineId,
        frequency,
        seasonality,
        notes
      });

    if (error) throw error;
  }

  // Get marine species with filtering and pagination
  async getMarine(params: {
    q?: string;
    rarity?: number;
    category?: string;
    habitat?: string;
    diet?: string;
    behavior?: string;
    sizeMin?: number;
    sizeMax?: number;
    danger?: string;
    venomous?: boolean;
    sort?: string;
    page?: number;
    size?: number;
  }) {
    const { q, rarity, category, habitat, diet, behavior, sizeMin, sizeMax, danger, venomous, sort = 'name', page = 1, size = 50 } = params;
    const offset = (page - 1) * size;

    let query = this.client
      .from('marine')
      .select('*', { count: 'exact' });

    // Text search
    if (q) {
      query = query.or(`name.ilike.%${q}%,scientific_name.ilike.%${q}%,category.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Filters
    if (rarity) query = query.eq('rarity', rarity);
    if (category) query = query.eq('category', category);
    if (habitat) query = query.contains('habitat_type', [habitat]);
    if (diet) query = query.ilike('diet', `%${diet}%`);
    if (behavior) query = query.ilike('behavior', `%${behavior}%`);
    if (sizeMin) query = query.gte('size_min_cm', sizeMin);
    if (sizeMax) query = query.lte('size_max_cm', sizeMax);
    if (danger) query = query.eq('danger', danger);
    if (venomous !== undefined) query = query.eq('venomous', venomous);

    // Sorting
    switch (sort) {
      case 'rarity':
        query = query.order('rarity', { ascending: true });
        break;
      case 'sizeMin':
        query = query.order('size_min_cm', { ascending: true });
        break;
      case 'sizeMax':
        query = query.order('size_max_cm', { ascending: true });
        break;
      case 'category':
        query = query.order('category', { ascending: true });
        break;
      default:
        query = query.order('name', { ascending: true });
    }

    // Pagination
    query = query.range(offset, offset + size - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // Transform snake_case to camelCase
    const transformedData = data?.map((marine: any) => ({
      id: marine.id,
      name: marine.name,
      scientificName: marine.scientific_name,
      category: marine.category,
      rarity: marine.rarity,
      sizeMinCm: marine.size_min_cm,
      sizeMaxCm: marine.size_max_cm,
      habitatType: marine.habitat_type,
      diet: marine.diet,
      behavior: marine.behavior,
      danger: marine.danger,
      venomous: marine.venomous,
      description: marine.description,
      lifeSpan: marine.life_span,
      reproduction: marine.reproduction,
      migration: marine.migration,
      endangered: marine.endangered,
      funFact: marine.fun_fact,
      imageUrl: marine.image_url,
      createdAt: marine.created_at,
      updatedAt: marine.updated_at
    })) || [];

    const total = count || 0;
    const totalPages = Math.ceil(total / size);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      data: transformedData,
      total,
      page,
      size,
      totalPages,
      hasNext,
      hasPrevious
    };
  }

  // Get marine species by ID with spots
  async getMarineById(id: number) {
    const { data, error } = await this.client
      .from('marine')
      .select(`
        *,
        spot_marine (
          spot_id,
          frequency,
          seasonality,
          notes
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      name: data.name,
      scientificName: data.scientific_name,
      category: data.category,
      rarity: data.rarity,
      sizeMinCm: data.size_min_cm,
      sizeMaxCm: data.size_max_cm,
      habitatType: data.habitat_type,
      diet: data.diet,
      behavior: data.behavior,
      danger: data.danger,
      venomous: data.venomous,
      description: data.description,
      lifeSpan: data.life_span,
      reproduction: data.reproduction,
      migration: data.migration,
      endangered: data.endangered,
      funFact: data.fun_fact,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      spotMarine: data.spot_marine?.map((sm: any) => ({
        spotId: sm.spot_id,
        frequency: sm.frequency,
        seasonality: sm.seasonality,
        notes: sm.notes
      })) || []
    };
  }

  // Create new marine species
  async createMarine(marineData: {
    name: string;
    scientificName?: string;
    category: string;
    rarity: number;
    sizeMinCm?: number;
    sizeMaxCm?: number;
    habitatType?: string[];
    diet?: string;
    behavior?: string;
    danger: string;
    venomous: boolean;
    description?: string;
    lifeSpan?: string;
    reproduction?: string;
    migration?: string;
    endangered?: string;
    funFact?: string;
  }) {
    const { data, error } = await this.client
      .from('marine')
      .insert({
        name: marineData.name,
        scientific_name: marineData.scientificName,
        category: marineData.category,
        rarity: marineData.rarity,
        size_min_cm: marineData.sizeMinCm,
        size_max_cm: marineData.sizeMaxCm,
        habitat_type: marineData.habitatType,
        diet: marineData.diet,
        behavior: marineData.behavior,
        danger: marineData.danger,
        venomous: marineData.venomous,
        description: marineData.description,
        life_span: marineData.lifeSpan,
        reproduction: marineData.reproduction,
        migration: marineData.migration,
        endangered: marineData.endangered,
        fun_fact: marineData.funFact
      })
      .select()
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      name: data.name,
      scientificName: data.scientific_name,
      category: data.category,
      rarity: data.rarity,
      sizeMinCm: data.size_min_cm,
      sizeMaxCm: data.size_max_cm,
      habitatType: data.habitat_type,
      diet: data.diet,
      behavior: data.behavior,
      danger: data.danger,
      venomous: data.venomous,
      description: data.description,
      lifeSpan: data.life_span,
      reproduction: data.reproduction,
      migration: data.migration,
      endangered: data.endangered,
      funFact: data.fun_fact,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Delete marine species
  async deleteMarine(id: number) {
    const { error } = await this.client
      .from('marine')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Get collections for device
  async getCollections(deviceId: string, params: {
    sort?: string;
    filterMarine?: string;
    filterSpot?: number;
    filterRarity?: number;
    filterCategory?: string;
    filterDanger?: string;
    filterDateFrom?: string;
    filterDateTo?: string;
    page?: number;
    size?: number;
  }) {
    const { sort = 'dateDesc', filterMarine, filterSpot, filterRarity, filterCategory, filterDanger, filterDateFrom, filterDateTo, page = 1, size = 50 } = params;
    const offset = (page - 1) * size;

    let query = this.client
      .from('collections')
      .select(`
        *,
        marine (
          id,
          name,
          scientific_name,
          rarity,
          size_min_cm,
          size_max_cm,
          habitat_type,
          diet,
          behavior,
          description,
          image_url
        ),
        collection_photos (
          id,
          url,
          annotated_url,
          date_found,
          spot_id,
          confidence,
          bounding_box,
          notes
        )
      `, { count: 'exact' })
      .eq('device_id', deviceId);

    // Filters
    if (filterMarine) {
      query = query.eq('marine.name', filterMarine);
    }
    if (filterSpot) {
      query = query.eq('collection_photos.spot_id', filterSpot);
    }
    if (filterRarity) {
      query = query.eq('marine.rarity', filterRarity);
    }
    if (filterCategory) {
      query = query.eq('marine.category', filterCategory);
    }
    if (filterDanger) {
      query = query.eq('marine.danger', filterDanger);
    }
    if (filterDateFrom) {
      query = query.gte('first_seen', filterDateFrom);
    }
    if (filterDateTo) {
      query = query.lte('first_seen', filterDateTo);
    }

    // Sorting
    switch (sort) {
      case 'dateAsc':
        query = query.order('first_seen', { ascending: true });
        break;
      case 'marineName':
        query = query.order('marine.name', { ascending: true });
        break;
      case 'spot':
        query = query.order('collection_photos.spot_id', { ascending: true });
        break;
      case 'rarity':
        query = query.order('marine.rarity', { ascending: true });
        break;
      case 'category':
        query = query.order('marine.category', { ascending: true });
        break;
      case 'danger':
        query = query.order('marine.danger', { ascending: true });
        break;
      default:
        query = query.order('first_seen', { ascending: false });
    }

    // Get all collections first (without pagination) to filter by photos
    const { data, error } = await query;

    if (error) throw error;

    // Transform snake_case to camelCase and filter collections with photos
    const allTransformedData = data?.map((collection: any) => ({
      id: collection.id,
      deviceId: collection.device_id,
      marineId: collection.marine_id,
      status: collection.status,
      firstSeen: collection.first_seen,
      lastSeen: collection.last_seen,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
      marine: collection.marine ? {
        id: collection.marine.id,
        name: collection.marine.name,
        scientificName: collection.marine.scientific_name,
        rarity: collection.marine.rarity,
        sizeMinCm: collection.marine.size_min_cm,
        sizeMaxCm: collection.marine.size_max_cm,
        habitatType: collection.marine.habitat_type,
        diet: collection.marine.diet,
        behavior: collection.marine.behavior,
        description: collection.marine.description,
        imageUrl: collection.marine.image_url
      } : null,
      photos: collection.collection_photos?.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        annotatedUrl: photo.annotated_url,
        dateFound: photo.date_found,
        spotId: photo.spot_id,
        confidence: photo.confidence,
        boundingBox: photo.bounding_box,
        notes: photo.notes
      })) || []
    }))
    .filter((collection: any) => collection.photos && collection.photos.length > 0) || [];

    // Apply pagination to filtered results
    const total = allTransformedData.length;
    const totalPages = Math.ceil(total / size);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;
    const transformedData = allTransformedData.slice(offset, offset + size);

    return {
      data: transformedData,
      total,
      page,
      size,
      totalPages,
      hasNext,
      hasPrevious
    };
  }

  // Get collection by ID (without photo filtering)
  async getCollectionById(collectionId: number, deviceId: string) {
    const { data, error } = await this.client
      .from('collections')
      .select(`
        *,
        marine (
          id,
          name,
          scientific_name,
          rarity,
          size_min_cm,
          size_max_cm,
          habitat_type,
          diet,
          behavior,
          description,
          image_url
        ),
        collection_photos (
          id,
          url,
          annotated_url,
          date_found,
          spot_id,
          confidence,
          bounding_box,
          notes
        )
      `)
      .eq('id', collectionId)
      .eq('device_id', deviceId)
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      deviceId: data.device_id,
      marineId: data.marine_id,
      status: data.status,
      firstSeen: data.first_seen,
      lastSeen: data.last_seen,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      marine: data.marine ? {
        id: data.marine.id,
        name: data.marine.name,
        scientificName: data.marine.scientific_name,
        rarity: data.marine.rarity,
        sizeMinCm: data.marine.size_min_cm,
        sizeMaxCm: data.marine.size_max_cm,
        habitatType: data.marine.habitat_type,
        diet: data.marine.diet,
        behavior: data.marine.behavior,
        description: data.marine.description,
        imageUrl: data.marine.image_url
      } : null,
      photos: data.collection_photos?.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        annotatedUrl: photo.annotated_url,
        dateFound: photo.date_found,
        spotId: photo.spot_id,
        confidence: photo.confidence,
        boundingBox: photo.bounding_box,
        notes: photo.notes
      })) || []
    };
  }

  // Find existing collection by marine species and device
  async findCollectionByMarineAndDevice(marineId: number, deviceId: string) {
    const { data, error } = await this.client
      .from('collections')
      .select(`
        *,
        marine (
          id,
          name,
          scientific_name,
          rarity,
          size_min_cm,
          size_max_cm,
          habitat_type,
          diet,
          behavior,
          description,
          image_url
        ),
        collection_photos (
          id,
          url,
          annotated_url,
          date_found,
          spot_id,
          confidence,
          bounding_box,
          notes
        )
      `)
      .eq('marine_id', marineId)
      .eq('device_id', deviceId)
      .single();

    if (error) {
      // If no collection found, return null
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    // Transform snake_case to camelCase
    return {
      id: data.id,
      deviceId: data.device_id,
      marineId: data.marine_id,
      status: data.status,
      firstSeen: data.first_seen,
      lastSeen: data.last_seen,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      marine: data.marine ? {
        id: data.marine.id,
        name: data.marine.name,
        scientificName: data.marine.scientific_name,
        rarity: data.marine.rarity,
        sizeMinCm: data.marine.size_min_cm,
        sizeMaxCm: data.marine.size_max_cm,
        habitatType: data.marine.habitat_type,
        diet: data.marine.diet,
        behavior: data.marine.behavior,
        description: data.marine.description,
        imageUrl: data.marine.image_url
      } : null,
      photos: data.collection_photos?.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        annotatedUrl: photo.annotated_url,
        dateFound: photo.date_found,
        spotId: photo.spot_id,
        confidence: photo.confidence,
        boundingBox: photo.bounding_box,
        notes: photo.notes
      })) || []
    };
  }

  // Create new collection
  async createCollection(collectionData: {
    deviceId: string;
    marineId?: number;
    status: string;
    firstSeen: string;
    lastSeen: string;
  }) {
    const { data, error } = await this.client
      .from('collections')
      .insert({
        device_id: collectionData.deviceId,
        marine_id: collectionData.marineId,
        status: collectionData.status,
        first_seen: collectionData.firstSeen,
        last_seen: collectionData.lastSeen
      })
      .select()
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      deviceId: data.device_id,
      marineId: data.marine_id,
      status: data.status,
      firstSeen: data.first_seen,
      lastSeen: data.last_seen,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Add photo to collection
  async addPhotoToCollection(photoData: {
    collectionId: number;
    url: string;
    annotatedUrl?: string;
    dateFound: string;
    spotId?: number;
    lat?: number;
    lng?: number;
    confidence?: number;
    boundingBox?: any;
    notes?: string;
    storageBucket?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
  }) {
    const { data, error } = await this.client
      .from('collection_photos')
      .insert({
        collection_id: photoData.collectionId,
        url: photoData.url,
        annotated_url: photoData.annotatedUrl,
        date_found: photoData.dateFound,
        spot_id: photoData.spotId,
        lat: photoData.lat,
        lng: photoData.lng,
        confidence: photoData.confidence,
        bounding_box: photoData.boundingBox,
        notes: photoData.notes,
        storage_bucket: photoData.storageBucket,
        file_path: photoData.filePath,
        file_size: photoData.fileSize,
        mime_type: photoData.mimeType
      })
      .select()
      .single();

    if (error) throw error;

    // Transform snake_case to camelCase
    return {
      id: data.id,
      collectionId: data.collection_id,
      url: data.url,
      annotatedUrl: data.annotated_url,
      dateFound: data.date_found,
      spotId: data.spot_id,
      lat: data.lat,
      lng: data.lng,
      confidence: data.confidence,
      boundingBox: data.bounding_box,
      notes: data.notes,
      storageBucket: data.storage_bucket,
      filePath: data.file_path,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      createdAt: data.created_at
    };
  }

  // Update collection last seen timestamp
  async updateCollectionLastSeen(id: number, deviceId: string) {
    const { error } = await this.client
      .from('collections')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', id)
      .eq('device_id', deviceId);

    if (error) throw error;
  }

  // Delete collection
  async deleteCollection(id: number, deviceId: string) {
    const { error } = await this.client
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('device_id', deviceId);

    if (error) throw error;
  }

  // Get system statistics
  async getSystemStats() {
    // Get spots stats
    const { count: spotsTotal } = await this.client
      .from('spots')
      .select('*', { count: 'exact', head: true });

    const { count: spotsRecent } = await this.client
      .from('spots')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Get marine stats
    const { count: marineTotal } = await this.client
      .from('marine')
      .select('*', { count: 'exact', head: true });

    const { data: rarityDistribution } = await this.client
      .from('marine')
      .select('rarity');

    const { data: averageSize } = await this.client
      .from('marine')
      .select('AVG(size_min_cm) as avg_size_min_cm, AVG(size_max_cm) as avg_size_max_cm');

    const { data: minSize } = await this.client
      .from('marine')
      .select('MIN(size_min_cm) as min_size_min_cm');

    const { data: maxSize } = await this.client
      .from('marine')
      .select('MAX(size_max_cm) as max_size_max_cm');

    // Get collections stats
    const { count: collectionsTotal } = await this.client
      .from('collections')
      .select('*', { count: 'exact', head: true });

    const { data: uniqueUsers } = await this.client
      .from('collections')
      .select('device_id');

    const { data: successRate } = await this.client
      .from('collection_photos')
      .select('AVG(confidence) as avg_confidence');

    return {
      spots: {
        total: spotsTotal || 0,
        recentlyAdded: spotsRecent || 0
      },
      marine: {
        totalSpecies: marineTotal || 0,
        rarityDistribution: rarityDistribution?.reduce((acc: any, item: any) => {
          acc[item.rarity] = (acc[item.rarity] || 0) + 1;
          return acc;
        }, {}) || {},
        uniqueFamilies: 0, // Family field not implemented in schema
        averageSizeCm: averageSize || 0,
        sizeRange: {
          min: minSize || 0,
          max: maxSize || 0
        }
      },
      collections: {
        totalFindings: collectionsTotal || 0,
        uniqueUsers: new Set(uniqueUsers?.map((u: any) => u.device_id) || []).size,
        identificationSuccessRate: successRate || 0
      },
      storage: {
        totalFiles: collectionsTotal || 0,
        totalSizeMb: 0, // Would need calculation
        bucketStats: {
          collections: { files: collectionsTotal || 0, sizeMb: 0 },
          marine: { files: 0, sizeMb: 0 }
        }
      },
      ai: {
        totalAnalyses: collectionsTotal || 0,
        successRate: successRate || 0,
        averageConfidence: successRate || 0
      }
    };
  }
}

export const db = new DatabaseService();
