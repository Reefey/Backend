import OpenAI from 'openai';
import { config } from '../config/global';
import { db } from '../utils/database';
import { AIDetection, UnknownSpecies, AIAnalysisResponse, CollectionEntry, BoundingBox } from '../types/model';

export class AIService {
  private openai: OpenAI;
  private rateLimitMap: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.rateLimitMap = new Map();
  }

  // Check rate limit for device
  private checkRateLimit(deviceId: string): boolean {
    const now = Date.now();
    const deviceLimit = this.rateLimitMap.get(deviceId);

    if (!deviceLimit) {
      this.rateLimitMap.set(deviceId, { count: 1, resetTime: now + 24 * 60 * 60 * 1000 });
      return true;
    }

    // Reset if 24 hours have passed
    if (now > deviceLimit.resetTime) {
      this.rateLimitMap.set(deviceId, { count: 1, resetTime: now + 24 * 60 * 60 * 1000 });
      return true;
    }

    // Check if limit exceeded
    if (deviceLimit.count >= config.ai.rateLimitPerDay) {
      return false;
    }

    // Increment count
    deviceLimit.count++;
    return true;
  }

  // Get rate limit info for device
  getRateLimitInfo(deviceId: string): { used: number; limit: number; resetTime: number } {
    const deviceLimit = this.rateLimitMap.get(deviceId);
    const now = Date.now();

    if (!deviceLimit) {
      return { used: 0, limit: config.ai.rateLimitPerDay, resetTime: now + 24 * 60 * 60 * 1000 };
    }

    return {
      used: deviceLimit.count,
      limit: config.ai.rateLimitPerDay,
      resetTime: deviceLimit.resetTime
    };
  }

  // Analyze image for marine life identification
  async analyzeImage(
    imageBuffer: Buffer,
    deviceId: string,
    spotId?: number,
    lat?: number,
    lng?: number
  ): Promise<AIAnalysisResponse> {
    // Check rate limit
    if (!this.checkRateLimit(deviceId)) {
      const info = this.getRateLimitInfo(deviceId);
      throw new Error(`Rate limit exceeded. Daily limit: ${info.limit}, Used: ${info.used}`);
    }

    try {
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');

      // Create the analysis prompt
      const prompt = this.createAnalysisPrompt();

      // Call OpenAI Vision API
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      // Parse AI response
      const aiResult = this.parseAIResponse(content);

      // Process detections and create collection entries
      const collectionEntries = await this.processDetections(
        aiResult.detections,
        deviceId,
        spotId,
        lat,
        lng
      );

      return {
        detections: aiResult.detections,
        unknownSpecies: aiResult.unknownSpecies,
        originalPhotoUrl: '', // Will be set by storage service
        annotatedPhotoUrl: '', // Will be set by storage service
        collectionEntries
      };

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI analysis failed: ${error.message}`);
      }
      throw new Error('AI analysis failed');
    }
  }

  // Create analysis prompt for GPT
  private createAnalysisPrompt(): string {
    return `You are a marine biologist expert. Analyze this underwater photo and identify all marine species visible.

For each detected species, provide:
1. Common name
2. Scientific name (if known)
3. Confidence level (0.0-1.0)
4. Bounding box coordinates (x, y, width, height)
5. Brief description of distinguishing features

Focus on:
- Fish species (clownfish, tangs, angelfish, etc.)
- Marine creatures (octopuses, turtles, rays, sharks)
- Corals and invertebrates
- Any other marine life visible

If you cannot identify a species, describe its appearance and mark confidence as low (<0.3).

Return response as JSON with this structure:
{
  "detections": [
    {
      "species": "Common Name",
      "scientificName": "Scientific Name",
      "confidence": 0.95,
      "boundingBox": {"x": 100, "y": 150, "width": 80, "height": 60},
      "description": "Brief description"
    }
  ],
  "unknownSpecies": [
    {
      "description": "Appearance description",
      "confidence": 0.2
    }
  ]
}`;
  }

  // Parse AI response
  private parseAIResponse(content: string): {
    detections: AIDetection[];
    unknownSpecies: UnknownSpecies[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Process detections
      const detections: AIDetection[] = (parsed.detections || []).map((detection: any) => ({
        species: detection.species || 'Unknown',
        scientificName: detection.scientificName,
        confidence: Math.max(0, Math.min(1, detection.confidence || 0)),
        wasInDatabase: false, // Will be updated during processing
        databaseId: undefined,
        instances: [{
          boundingBox: this.validateBoundingBox(detection.boundingBox),
          confidence: Math.max(0, Math.min(1, detection.confidence || 0))
        }]
      }));

      // Process unknown species
      const unknownSpecies: UnknownSpecies[] = (parsed.unknownSpecies || []).map((unknown: any) => ({
        description: unknown.description || 'Unknown species',
        gptResponse: content,
        confidence: Math.max(0, Math.min(1, unknown.confidence || 0)),
        instances: [{
          boundingBox: this.validateBoundingBox(unknown.boundingBox),
          confidence: Math.max(0, Math.min(1, unknown.confidence || 0))
        }]
      }));

      return { detections, unknownSpecies };

    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate bounding box coordinates
  private validateBoundingBox(box: any): BoundingBox {
    if (!box || typeof box !== 'object') {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    return {
      x: Math.max(0, Math.round(box.x || 0)),
      y: Math.max(0, Math.round(box.y || 0)),
      width: Math.max(1, Math.round(box.width || 100)),
      height: Math.max(1, Math.round(box.height || 100))
    };
  }

  // Process detections and create collection entries
  private async processDetections(
    detections: AIDetection[],
    deviceId: string,
    _spotId?: number,
    _lat?: number,
    _lng?: number
  ): Promise<CollectionEntry[]> {
    const collectionEntries: CollectionEntry[] = [];

    for (const detection of detections) {
      // Skip low confidence detections
      if (detection.confidence < config.ai.confidenceThreshold) {
        continue;
      }

      // Search for marine species in database
      const marineResult = await db.getMarine({ q: detection.species });
      const existingMarine = marineResult.data.find((m: any) => 
        m.name.toLowerCase() === detection.species.toLowerCase() ||
        m.scientificName?.toLowerCase() === detection.scientificName?.toLowerCase()
      );

      if (existingMarine) {
        // Use existing marine species
        detection.wasInDatabase = true;
        detection.databaseId = existingMarine.id;

        // Create collection entry
        const collection = await db.createCollection({
          deviceId,
          marineId: existingMarine.id,
          status: 'identified',
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });

        collectionEntries.push({
          id: collection.id,
          marineId: existingMarine.id,
          name: detection.species,
          status: 'identified',
          photo: {
            url: '', // Will be set by storage service
            annotatedUrl: '', // Will be set by storage service
            boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
          }
        });

      } else {
        // Create new marine species if confidence is high enough
        if (detection.confidence >= 0.8 && detection.scientificName) {
          try {
            const newMarine = await db.createMarine({
              name: detection.species,
              scientificName: detection.scientificName,
              category: 'Fishes', // Default, could be improved with AI
              rarity: 3, // Default
              danger: 'Low', // Default
              venomous: false, // Default
              description: `Identified as ${detection.species}`
            });

            detection.wasInDatabase = true;
            detection.databaseId = newMarine.id;

            // Create collection entry
            const collection = await db.createCollection({
              deviceId,
              marineId: newMarine.id,
              status: 'identified',
              firstSeen: new Date().toISOString(),
              lastSeen: new Date().toISOString()
            });

            collectionEntries.push({
              id: collection.id,
              marineId: newMarine.id,
              name: detection.species,
              status: 'identified',
              photo: {
                url: '', // Will be set by storage service
                annotatedUrl: '', // Will be set by storage service
                boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
              }
            });

          } catch (error) {
            // If creation fails, mark as unknown
            detection.wasInDatabase = false;
          }
        } else {
          // Mark as unknown
          detection.wasInDatabase = false;
        }
      }
    }

    return collectionEntries;
  }

  // Get detailed species information from AI
  async getSpeciesDetails(speciesName: string): Promise<any> {
    try {
      const prompt = `You are a marine biology expert. Provide detailed information about this marine species: ${speciesName}

Please provide:
1. Scientific name
2. Category (Fishes, Creatures, Corals)
3. Typical size range (min-max cm)
4. Habitat types
5. Diet
6. Behavior patterns
7. Danger level (Low/Medium/High/Extreme)
8. Venomous status (true/false)
9. Life span
10. Reproduction method
11. Migration patterns
12. Conservation status
13. Interesting facts

Return as JSON structure matching our database schema.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      // Parse response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      throw new Error(`Failed to get species details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const aiService = new AIService();
