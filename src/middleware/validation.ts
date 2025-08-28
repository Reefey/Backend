import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CustomError } from './errorHandler';

// Validation middleware
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new CustomError(message, 400, 'VALIDATION_ERROR');
    }
    
    next();
  };
};

// Query validation middleware
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new CustomError(message, 400, 'VALIDATION_ERROR');
    }
    
    next();
  };
};

// Params validation middleware
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new CustomError(message, 400, 'VALIDATION_ERROR');
    }
    
    next();
  };
};

// Validation schemas
export const schemas = {
  // Spots
  createSpot: Joi.object({
    name: Joi.string().required().max(255),
    lat: Joi.number().required().min(-90).max(90),
    lng: Joi.number().required().min(-180).max(180),
    description: Joi.string().optional(),
    difficulty: Joi.string().valid('Easy', 'Medium', 'Hard').optional(),
    bestTime: Joi.string().optional(),
    marineSpecies: Joi.array().items(
      Joi.object({
        marineId: Joi.number().required(),
        frequency: Joi.string().valid('Common', 'Occasional', 'Rare').required(),
        seasonality: Joi.string().optional(),
        notes: Joi.string().optional()
      })
    ).optional()
  }),

  // Marine species
  createMarine: Joi.object({
    name: Joi.string().required().max(255),
    scientificName: Joi.string().optional().max(255),
    category: Joi.string().valid('Fishes', 'Creatures', 'Corals').required(),
    rarity: Joi.number().required().min(1).max(5),
    sizeMinCm: Joi.number().optional().min(0),
    sizeMaxCm: Joi.number().optional().min(0),
    habitatType: Joi.array().items(Joi.string()).optional(),
    diet: Joi.string().optional().max(100),
    behavior: Joi.string().optional().max(100),
    danger: Joi.string().valid('Low', 'Medium', 'High', 'Extreme').required(),
    venomous: Joi.boolean().default(false),
    edibility: Joi.boolean().optional(),
    poisonous: Joi.boolean().optional(),
    endangeredd: Joi.boolean().optional(),
    description: Joi.string().optional(),
    lifeSpan: Joi.string().optional().max(100),
    reproduction: Joi.string().optional().max(200),
    migration: Joi.string().optional().max(100),
    endangered: Joi.string().optional().max(100),
    funFact: Joi.string().optional()
  }),

  // AI analysis
  analyzePhotoUrl: Joi.object({
    deviceId: Joi.string().required(),
    photoUrl: Joi.string().uri().required(),
    spotId: Joi.number().optional(),
    lat: Joi.number().optional().min(-90).max(90),
    lng: Joi.number().optional().min(-180).max(180)
  }),

  // Base64 image upload
  base64ImageUpload: Joi.object({
    deviceId: Joi.string().required(),
    photo: Joi.string().required().custom((value, helpers) => {
      // Validate base64 format
      if (value.startsWith('data:image/')) {
        // Data URL format
        const matches = value.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches || !matches[2]) {
          return helpers.error('any.invalid');
        }
        try {
          Buffer.from(matches[2], 'base64');
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      } else {
        // Plain base64 string
        try {
          Buffer.from(value, 'base64');
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      }
    }, 'base64-image'),
    spotId: Joi.number().optional(),
    lat: Joi.number().optional().min(-90).max(90),
    lng: Joi.number().optional().min(-180).max(180),
    dateFound: Joi.string().isoDate().optional(),
    notes: Joi.string().optional()
  }),

  // Base64 collection photo
  base64CollectionPhoto: Joi.object({
    photo: Joi.string().required().custom((value, helpers) => {
      // Validate base64 format
      if (value.startsWith('data:image/')) {
        // Data URL format
        const matches = value.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches || !matches[2]) {
          return helpers.error('any.invalid');
        }
        try {
          Buffer.from(matches[2], 'base64');
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      } else {
        // Plain base64 string
        try {
          Buffer.from(value, 'base64');
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      }
    }, 'base64-image'),
    spotId: Joi.number().optional(),
    lat: Joi.number().optional().min(-90).max(90),
    lng: Joi.number().optional().min(-180).max(180),
    dateFound: Joi.string().isoDate().optional(),
    notes: Joi.string().optional()
  }),

  // Base64 AI analysis
  base64AIAnalysis: Joi.object({
    deviceId: Joi.string().required(),
    photo: Joi.string().required().custom((value, helpers) => {
      // Validate base64 format
      if (value.startsWith('data:image/')) {
        // Data URL format
        const matches = value.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches || !matches[2]) {
          return helpers.error('any.invalid');
        }
        try {
          Buffer.from(matches[2], 'base64');
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      } else {
        // Plain base64 string
        try {
          Buffer.from(value, 'base64');
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      }
    }, 'base64-image'),
    spotId: Joi.number().optional(),
    lat: Joi.number().optional().min(-90).max(90),
    lng: Joi.number().optional().min(-180).max(180)
  }),

  // Collection photo
  addPhotoToCollection: Joi.object({
    spotId: Joi.number().optional(),
    lat: Joi.number().optional().min(-90).max(90),
    lng: Joi.number().optional().min(-180).max(180),
    dateFound: Joi.string().isoDate().optional(),
    notes: Joi.string().optional()
  }),

  // Query parameters
  spotsQuery: Joi.object({
    lat: Joi.number().optional().min(-90).max(90),
    lng: Joi.number().optional().min(-180).max(180),
    radius: Joi.number().optional().min(0).max(1000),
    q: Joi.string().optional(),
    sort: Joi.string().valid('name', 'distance', 'createdAt').optional(),
    page: Joi.number().optional().min(1),
    size: Joi.number().optional().min(1).max(100)
  }),

  marineQuery: Joi.object({
    q: Joi.string().optional(),
    rarity: Joi.number().optional().min(1).max(5),
    category: Joi.string().valid('Fishes', 'Creatures', 'Corals').optional(),
    habitat: Joi.string().optional(),
    diet: Joi.string().optional(),
    behavior: Joi.string().optional(),
    sizeMin: Joi.number().optional().min(0),
    sizeMax: Joi.number().optional().min(0),
    danger: Joi.string().valid('Low', 'Medium', 'High', 'Extreme').optional(),
    venomous: Joi.boolean().optional(),
    edibility: Joi.boolean().optional(),
    poisonous: Joi.boolean().optional(),
    endangeredd: Joi.boolean().optional(),
    collected: Joi.boolean().optional(),
    deviceId: Joi.string().optional(),
    sort: Joi.string().valid('name', 'rarity', 'sizeMin', 'sizeMax', 'category', 'collected').optional(),
    page: Joi.number().optional().min(1),
    size: Joi.number().optional().min(1).max(100)
  }),

  collectionsQuery: Joi.object({
    sort: Joi.string().valid('dateDesc', 'dateAsc', 'marineName', 'spot', 'rarity', 'category', 'danger').optional(),
    filterMarine: Joi.string().optional(),
    filterSpot: Joi.number().optional(),
    filterRarity: Joi.number().optional().min(1).max(5),
    filterCategory: Joi.string().valid('Fishes', 'Creatures', 'Corals').optional(),
    filterDanger: Joi.string().valid('Low', 'Medium', 'High', 'Extreme').optional(),
    filterDateFrom: Joi.string().isoDate().optional(),
    filterDateTo: Joi.string().isoDate().optional(),
    page: Joi.number().optional().min(1),
    size: Joi.number().optional().min(1).max(100)
  }),

  // Params
  idParam: Joi.object({
    id: Joi.number().required().min(1)
  }),

  deviceIdParam: Joi.object({
    deviceId: Joi.string().required()
  }),

  collectionIdParam: Joi.object({
    collectionId: Joi.number().required().min(1)
  }),

  // Combined params for routes with multiple path parameters
  deviceIdAndCollectionIdParam: Joi.object({
    deviceId: Joi.string().required(),
    collectionId: Joi.number().required().min(1)
  }),

  deviceIdAndMarineIdParam: Joi.object({
    deviceId: Joi.string().required(),
    marineId: Joi.number().required().min(1)
  }),

  deviceIdQuery: Joi.object({
    deviceId: Joi.string().required()
  })
};

// Device ID validation middleware
export const validateDeviceId = (req: Request, _res: Response, next: NextFunction) => {
  const deviceId = req.params['deviceId'] || req.body['deviceId'] || req.query['deviceId'];
  
  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    throw new CustomError('Device ID is required', 400, 'VALIDATION_ERROR');
  }

  // Basic device ID format validation (alphanumeric + hyphens/underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
    throw new CustomError('Invalid device ID format', 400, 'VALIDATION_ERROR');
  }

  next();
};
