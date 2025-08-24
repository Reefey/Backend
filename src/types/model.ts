// Database Types
export interface Spot {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  bestTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Marine {
  id: number;
  name: string;
  scientificName?: string;
  category: 'Fishes' | 'Creatures' | 'Corals';
  rarity: number;
  sizeMinCm?: number;
  sizeMaxCm?: number;
  habitatType?: string[];
  diet?: string;
  behavior?: string;
  danger: 'Low' | 'Medium' | 'High' | 'Extreme';
  venomous: boolean;
  description?: string;
  lifeSpan?: string;
  reproduction?: string;
  migration?: string;
  endangered?: string;
  funFact?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpotMarine {
  id: number;
  spotId: number;
  marineId: number;
  frequency: 'Common' | 'Occasional' | 'Rare';
  seasonality?: string;
  notes?: string;
  createdAt: string;
}

export interface Collection {
  id: number;
  deviceId: string;
  marineId?: number;
  status: 'identified' | 'unknown' | 'pending';
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionPhoto {
  id: number;
  collectionId: number;
  url: string;
  annotatedUrl?: string;
  dateFound: string;
  spotId?: number;
  lat?: number;
  lng?: number;
  confidence?: number;
  boundingBox?: BoundingBox;
  notes?: string;
  storageBucket?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// API Request/Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginationResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Query Parameters
export interface SpotsQueryParams {
  lat?: number;
  lng?: number;
  radius?: number;
  q?: string;
  sort?: 'name' | 'distance' | 'createdAt';
  page?: number;
  size?: number;
}

export interface MarineQueryParams {
  q?: string;
  rarity?: number;
  category?: 'Fishes' | 'Creatures' | 'Corals';
  habitat?: string;
  diet?: string;
  behavior?: string;
  sizeMin?: number;
  sizeMax?: number;
  danger?: 'Low' | 'Medium' | 'High' | 'Extreme';
  venomous?: boolean;
  sort?: 'name' | 'rarity' | 'sizeMin' | 'sizeMax' | 'category';
  page?: number;
  size?: number;
}

export interface CollectionsQueryParams {
  sort?: 'dateDesc' | 'dateAsc' | 'marineName' | 'spot' | 'rarity' | 'category' | 'danger';
  filterMarine?: string;
  filterSpot?: number;
  filterRarity?: number;
  filterCategory?: 'Fishes' | 'Creatures' | 'Corals';
  filterDanger?: 'Low' | 'Medium' | 'High' | 'Extreme';
  filterDateFrom?: string;
  filterDateTo?: string;
  page?: number;
  size?: number;
}

// AI Types
export interface AIDetection {
  species: string;
  scientificName?: string;
  confidence: number;
  wasInDatabase: boolean;
  databaseId?: number;
  instances: AIDetectionInstance[];
}

export interface AIDetectionInstance {
  boundingBox: BoundingBox;
  confidence: number;
}

export interface UnknownSpecies {
  description: string;
  gptResponse?: string;
  confidence: number;
  instances: AIDetectionInstance[];
}

export interface AIAnalysisResponse {
  detections: AIDetection[];
  unknownSpecies: UnknownSpecies[];
  originalPhotoUrl: string;
  annotatedPhotoUrl: string;
  collectionEntries: CollectionEntry[];
}

export interface CollectionEntry {
  id: number;
  marineId?: number;
  name: string;
  status: string;
  photo: {
    url: string;
    annotatedUrl?: string;
    boundingBox?: BoundingBox;
  };
}

// File Upload Types
export interface FileUploadData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Stats Types
export interface SystemStats {
  spots: {
    total: number;
    recentlyAdded: number;
  };
  marine: {
    totalSpecies: number;
    rarityDistribution: Record<string, number>;
    uniqueFamilies: number;
    averageSizeCm: number;
    sizeRange: { min: number; max: number };
  };
  collections: {
    totalFindings: number;
    uniqueUsers: number;
    identificationSuccessRate: number;
  };
  storage: {
    totalFiles: number;
    totalSizeMb: number;
    bucketStats: {
      collections: { files: number; sizeMb: number };
      marine: { files: number; sizeMb: number };
    };
  };
  ai: {
    totalAnalyses: number;
    successRate: number;
    averageConfidence: number;
  };
}

// Error Types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
}
