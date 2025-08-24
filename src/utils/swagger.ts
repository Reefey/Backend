import { config } from '../config/global';

// Swagger configuration
export const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Reefey API',
        version: '1.0.0',
        description: 'Marine life identification API',
        contact: {
          name: 'Reefey Team',
          email: 'support@reefey.com'
        }
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server'
        }
      ],
      components: {
        schemas: {
          Spot: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
              description: { type: 'string' },
              difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
              bestTime: { type: 'string' },
              marineSpecies: { type: 'array', items: { type: 'string' } },
              distance: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Marine: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              scientificName: { type: 'string' },
              category: { type: 'string', enum: ['Fishes', 'Creatures', 'Corals'] },
              rarity: { type: 'integer', minimum: 1, maximum: 5 },
              sizeMinCm: { type: 'number' },
              sizeMaxCm: { type: 'number' },
              habitatType: { type: 'array', items: { type: 'string' } },
              diet: { type: 'string' },
              behavior: { type: 'string' },
              danger: { type: 'string', enum: ['Low', 'Medium', 'High', 'Extreme'] },
              venomous: { type: 'boolean' },
              description: { type: 'string' },
              imageUrl: { type: 'string' },
              lifeSpan: { type: 'string' },
              reproduction: { type: 'string' },
              migration: { type: 'string' },
              endangered: { type: 'string' },
              funFact: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          Collection: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              deviceId: { type: 'string' },
              marineId: { type: 'integer' },
              species: { type: 'string' },
              scientificName: { type: 'string' },
              rarity: { type: 'integer' },
              sizeMinCm: { type: 'number' },
              sizeMaxCm: { type: 'number' },
              habitatType: { type: 'array', items: { type: 'string' } },
              diet: { type: 'string' },
              behavior: { type: 'string' },
              description: { type: 'string' },
              marineImageUrl: { type: 'string' },
              photos: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CollectionPhoto'
                }
              },
              totalPhotos: { type: 'integer' },
              firstSeen: { type: 'string', format: 'date-time' },
              lastSeen: { type: 'string', format: 'date-time' },
              status: { type: 'string', enum: ['identified', 'unknown', 'pending'] }
            }
          },
          AIAnalysisResponse: {
            type: 'object',
            properties: {
              detections: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/AIDetection'
                }
              },
              unknownSpecies: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/UnknownSpecies'
                }
              },
              originalPhotoUrl: { type: 'string' },
              annotatedPhotoUrl: { type: 'string' },

              collectionEntries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    marineId: { type: 'integer' },
                    name: { type: 'string' },
                    status: { type: 'string' },
                    photo: {
                      type: 'object',
                      properties: {
                        url: { type: 'string' },
                        annotatedUrl: { type: 'string' },
                        boundingBox: {
                          type: 'object',
                          properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            width: { type: 'number' },
                            height: { type: 'number' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          SystemStats: {
            type: 'object',
            properties: {
              spots: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  recentlyAdded: { type: 'integer' }
                }
              },
              marine: {
                type: 'object',
                properties: {
                  totalSpecies: { type: 'integer' },
                  rarityDistribution: { type: 'object' },
                  uniqueFamilies: { type: 'integer' },
                  averageSizeCm: { type: 'number' },
                  sizeRange: {
                    type: 'object',
                    properties: {
                      min: { type: 'number' },
                      max: { type: 'number' }
                    }
                  }
                }
              },
              collections: {
                type: 'object',
                properties: {
                  totalFindings: { type: 'integer' },
                  uniqueUsers: { type: 'integer' },
                  identificationSuccessRate: { type: 'number' }
                }
              },
              storage: {
                type: 'object',
                properties: {
                  totalFiles: { type: 'integer' },
                  totalSizeMb: { type: 'number' },
                  bucketStats: {
                    type: 'object',
                    properties: {
                      collections: {
                        type: 'object',
                        properties: {
                          files: { type: 'integer' },
                          sizeMb: { type: 'number' }
                        }
                      },
                      marine: {
                        type: 'object',
                        properties: {
                          files: { type: 'integer' },
                          sizeMb: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              },
              ai: {
                type: 'object',
                properties: {
                  totalAnalyses: { type: 'integer' },
                  successRate: { type: 'number' },
                  averageConfidence: { type: 'number' }
                }
              }
            }
          },
          Pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              size: { type: 'integer' },
              totalPages: { type: 'integer' },
              hasNext: { type: 'boolean' },
              hasPrevious: { type: 'boolean' }
            }
          },
          CreateSpotRequest: {
            type: 'object',
            required: ['name', 'lat', 'lng'],
            properties: {
              name: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
              description: { type: 'string' },
              difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
              bestTime: { type: 'string' },
              marineSpecies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    marineId: { type: 'integer' },
                    frequency: { type: 'string', enum: ['Common', 'Occasional', 'Rare'] },
                    seasonality: { type: 'string' },
                    notes: { type: 'string' }
                  }
                }
              }
            }
          },
          CreateMarineRequest: {
            type: 'object',
            required: ['name', 'category', 'rarity', 'danger'],
            properties: {
              name: { type: 'string' },
              scientificName: { type: 'string' },
              category: { type: 'string', enum: ['Fishes', 'Creatures', 'Corals'] },
              rarity: { type: 'integer', minimum: 1, maximum: 5 },
              sizeMinCm: { type: 'number' },
              sizeMaxCm: { type: 'number' },
              habitatType: { type: 'array', items: { type: 'string' } },
              diet: { type: 'string' },
              behavior: { type: 'string' },
              danger: { type: 'string', enum: ['Low', 'Medium', 'High', 'Extreme'] },
              venomous: { type: 'boolean' },
              description: { type: 'string' },
              lifeSpan: { type: 'string' },
              reproduction: { type: 'string' },
              migration: { type: 'string' },
              endangered: { type: 'string' },
              funFact: { type: 'string' }
            }
          },
          CollectionEntry: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              deviceId: { type: 'string' },
              marineId: { type: 'integer' },
              species: { type: 'string' },
              scientificName: { type: 'string' },
              photo: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  url: { type: 'string' },

                  annotatedUrl: { type: 'string' },
                  dateFound: { type: 'string', format: 'date-time' },
                  spotId: { type: 'integer' },
                  confidence: { type: 'number' },
                  boundingBox: {
                    type: 'object',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' }
                    }
                  }
                }
              },
              totalPhotos: { type: 'integer' },
              firstSeen: { type: 'string', format: 'date-time' },
              lastSeen: { type: 'string', format: 'date-time' },
              status: { type: 'string' }
            }
          },
          CollectionPhotoAdded: {
            type: 'object',
            properties: {
              collectionId: { type: 'integer' },
              marineId: { type: 'integer' },
              species: { type: 'string' },
              scientificName: { type: 'string' },
              newPhoto: {
                $ref: '#/components/schemas/CollectionPhoto'
              }
            }
          },
          // Missing schema definitions
          SpotDetail: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
              description: { type: 'string' },
              difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
              bestTime: { type: 'string' },
              marineSpecies: { type: 'array', items: { type: 'string' } },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          MarineDetail: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              scientificName: { type: 'string' },
              category: { type: 'string', enum: ['Fishes', 'Creatures', 'Corals'] },
              rarity: { type: 'integer', minimum: 1, maximum: 5 },
              sizeMinCm: { type: 'number' },
              sizeMaxCm: { type: 'number' },
              habitatType: { type: 'array', items: { type: 'string' } },
              diet: { type: 'string' },
              behavior: { type: 'string' },
              danger: { type: 'string', enum: ['Low', 'Medium', 'High', 'Extreme'] },
              venomous: { type: 'boolean' },
              description: { type: 'string' },
              imageUrl: { type: 'string' },
              lifeSpan: { type: 'string' },
              reproduction: { type: 'string' },
              migration: { type: 'string' },
              endangered: { type: 'string' },
              funFact: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          AIDetection: {
            type: 'object',
            properties: {
              species: { type: 'string' },
              scientificName: { type: 'string' },
              confidence: { type: 'number' },
              wasInDatabase: { type: 'boolean' },
              databaseId: { type: 'integer' },
              instances: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    boundingBox: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' }
                      }
                    },
                    confidence: { type: 'number' }
                  }
                }
              }
            }
          },
          UnknownSpecies: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              gptResponse: { type: 'string' },
              confidence: { type: 'number' },
              instances: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    boundingBox: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' }
                      }
                    },
                    confidence: { type: 'number' }
                  }
                }
              }
            }
          },
          CollectionPhoto: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              url: { type: 'string' },

              annotatedUrl: { type: 'string' },
              dateFound: { type: 'string', format: 'date-time' },
              spotId: { type: 'integer' },
              confidence: { type: 'number' },
              boundingBox: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              },
              spots: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  lat: { type: 'number' },
                  lng: { type: 'number' }
                }
              }
            }
          },
          // Additional schemas for API consistency
          SpotMarineSpecies: {
            type: 'object',
            properties: {
              marineId: { type: 'integer' },
              name: { type: 'string' },
              scientificName: { type: 'string' },
              rarity: { type: 'integer' },
              frequency: { type: 'string', enum: ['Common', 'Occasional', 'Rare'] },
              seasonality: { type: 'string' },
              notes: { type: 'string' }
            }
          },
          MarineSpotInfo: {
            type: 'object',
            properties: {
              spotId: { type: 'integer' },
              spotName: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
              frequency: { type: 'string', enum: ['Common', 'Occasional', 'Rare'] },
              seasonality: { type: 'string' },
              notes: { type: 'string' }
            }
          },
  
        }
      }
    },
    apis: ['./src/routes/*.ts']
  };