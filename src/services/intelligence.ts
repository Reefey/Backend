import OpenAI from 'openai';
import { config } from '../config/global';
import { db } from '../utils/database';
import { AIDetection, UnknownSpecies, AIAnalysisResponse, CollectionEntry, BoundingBox, ImageAnalysis, AnnotationMetadata } from '../types/model';

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
      // Convert image to JPEG format first to prevent "Unsupported image type" errors
      const jpegBuffer = await this.convertToJpeg(imageBuffer);

      // Convert JPEG buffer to base64
      const base64Image = jpegBuffer.toString('base64');

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
        collectionEntries,
        // Pass the converted JPEG buffer for consistent annotation
        processedImageBuffer: jpegBuffer,
        // Pass through the new enhanced data
        ...(aiResult.imageAnalysis && { imageAnalysis: aiResult.imageAnalysis }),
        ...(aiResult.annotationMetadata && { annotationMetadata: aiResult.annotationMetadata })
      };

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI analysis failed: ${error.message}`);
      }
      throw new Error('AI analysis failed');
    }
  }

  // Batch analyze multiple images for comprehensive annotation
  async batchAnalyzeImages(
    images: Array<{ buffer: Buffer; filename: string }>,
    deviceId: string,
    spotId?: number,
    lat?: number,
    lng?: number
  ): Promise<{
    results: Array<{
      filename: string;
      analysis: AIAnalysisResponse;
      success: boolean;
      error?: string;
    }>;
    summary: {
      totalImages: number;
      successfulAnalyses: number;
      failedAnalyses: number;
      totalDetections: number;
      averageConfidence: number;
      processingTime: number;
    };
  }> {
    const startTime = Date.now();
    const results = [];
    let totalDetections = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const image of images) {
      try {
        // Check rate limit for each image
        if (!this.checkRateLimit(deviceId)) {
          const info = this.getRateLimitInfo(deviceId);
          throw new Error(`Rate limit exceeded. Daily limit: ${info.limit}, Used: ${info.used}`);
        }

        // Analyze the image
        const analysis = await this.analyzeImage(image.buffer, deviceId, spotId, lat, lng);
        
        // Calculate statistics
        const detections = analysis.detections.length;
        const avgConfidence = analysis.detections.reduce((sum, d) => sum + d.confidence, 0) / Math.max(detections, 1);
        
        totalDetections += detections;
        totalConfidence += avgConfidence;
        confidenceCount++;

        results.push({
          filename: image.filename,
          analysis,
          success: true
        });

      } catch (error) {
        results.push({
          filename: image.filename,
          analysis: {} as AIAnalysisResponse,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const processingTime = Date.now() - startTime;
    const successfulAnalyses = results.filter(r => r.success).length;
    const failedAnalyses = results.filter(r => !r.success).length;

    return {
      results,
      summary: {
        totalImages: images.length,
        successfulAnalyses,
        failedAnalyses,
        totalDetections,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        processingTime
      }
    };
  }

  // Convert image to JPEG format using Sharp
  private async convertToJpeg(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const sharp = require('sharp');
      return await sharp(imageBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (error) {
      console.warn('Failed to convert image to JPEG, using original:', error);
      return imageBuffer; // Fallback to original buffer
    }
  }



  // Create analysis prompt for GPT
  private createAnalysisPrompt(): string {
    return `You are an expert marine biologist and computer vision specialist with advanced annotation capabilities. Your task is to comprehensively analyze underwater photos and provide detailed annotations for both visual elements and structured data.

ANNOTATION CAPABILITIES:
1. VISUAL ANNOTATION: Precise bounding box detection with species location relative to the image
2. JSON ANNOTATION: Structured data extraction and validation
3. BATCH PROCESSING: Handle multiple detections with consistent formatting
4. QUALITY ASSURANCE: Confidence scoring and validation checks

IMPORTANT - RELATIVE COORDINATE SYSTEM:
- Use RELATIVE PERCENTAGE coordinates (0.000 to 1.000) instead of pixels to describe the location of the species in the image
- Origin (0.000, 0.000) is at the TOP-LEFT corner of the image
- X-axis increases from LEFT to RIGHT (0.000 to 1.000)
- Y-axis increases from TOP to BOTTOM (0.000 to 1.000)
- All coordinates are DECIMALS with THREE DECIMAL PLACES (0.000 format)
- Use maximum precision for accurate positioning

BOUNDING BOX REQUIREMENTS:
- x: Relative position from left edge (0.000 to 1.000)
- y: Relative position from top edge (0.000 to 1.000)
- x and y are the top left corner of the bounding box
- width: Relative width of bounding box (0.000 to 1.000)
- height: Relative height of bounding box (0.000 to 1.000)
- All values must be decimals with three decimal places (0.000 format)
- Bounding box must be completely within image boundaries
- x + width must not exceed 1.000
- y + height must not exceed 1.000

COMPREHENSIVE ANNOTATION REQUIREMENTS:

For each detected species, provide:
1. Common name (standardized)
2. Scientific name (if known, with proper formatting)
3. Confidence level (0.000-1.000) with detailed reasoning
4. Bounding box relative coordinates (x, y, width, height) - PERCENTAGE POSITIONS WITH THREE DECIMALS
5. Detailed description of distinguishing features
6. Behavioral observations (if visible)
7. Size estimation (relative to known objects in image)
8. Habitat context within the image
9. Interaction with other species (if applicable)
10. Image quality assessment for this detection

SPECIES CATEGORIES TO FOCUS ON:
- Fish species (clownfish, tangs, angelfish, groupers, wrasses, etc.)
- Marine creatures (octopuses, turtles, rays, sharks, eels)
- Corals and invertebrates (hard corals, soft corals, anemones, sponges)
- Crustaceans (crabs, lobsters, shrimp)
- Mollusks (clams, snails, nudibranchs)
- Any other marine life visible

QUALITY ASSESSMENT CRITERIA:
- Image clarity and resolution
- Lighting conditions
- Species visibility and pose
- Background interference
- Multiple species overlap
- Distance and scale factors

CONFIDENCE SCORING GUIDELINES:
- 0.900-1.000: Clear, well-lit, distinctive species with high certainty
- 0.700-0.899: Good visibility with minor uncertainties
- 0.500-0.699: Moderate visibility with some identification challenges
- 0.300-0.499: Poor visibility or partial species view
- 0.100-0.299: Very poor visibility or highly uncertain identification
- 0.000-0.099: Unable to identify with any confidence

For unknown species, provide:
1. Detailed appearance description
2. Behavioral observations
3. Size and shape characteristics
4. Color patterns and markings
5. Habitat position in image
6. Similar species suggestions
7. Confidence level with reasoning

COORDINATE EXAMPLES (THREE DECIMAL PRECISION):
- Top-left corner: {"x": 0.000, "y": 0.000, "width": 0.200, "height": 0.150}
- Center of image: {"x": 0.400, "y": 0.300, "width": 0.250, "height": 0.200}
- Bottom-right area: {"x": 0.700, "y": 0.800, "width": 0.200, "height": 0.150}
- Precise positioning: {"x": 0.125, "y": 0.375, "width": 0.075, "height": 0.050}

Return response as JSON with this enhanced structure:
{
  "imageAnalysis": {
    "overallQuality": "excellent|good|fair|poor",
    "lightingConditions": "bright|moderate|dim|mixed",
    "waterClarity": "clear|moderate|turbid",
    "depthEstimate": "shallow|medium|deep",
    "habitatType": "reef|sand|seagrass|mixed"
  },
  "detections": [
    {
      "species": "Common Name",
      "scientificName": "Scientific Name",
      "confidence": 0.950,
      "confidenceReasoning": "Clear view, distinctive markings, good lighting",
      "boundingBox": {"x": 0.200, "y": 0.300, "width": 0.150, "height": 0.120},
      "description": "Detailed description of appearance and features",
      "behavioralNotes": "Swimming pattern, interaction with environment",
      "sizeEstimate": "Small (5-10cm)|Medium (10-30cm)|Large (30cm+)",
      "habitatContext": "Position in reef structure, depth zone",
      "interactions": "With other species, group behavior",
      "imageQuality": "excellent|good|fair|poor for this detection"
    }
  ],
  "unknownSpecies": [
    {
      "description": "Comprehensive appearance description",
      "behavioralNotes": "Observed behavior patterns",
      "sizeCharacteristics": "Relative size and shape",
      "colorPatterns": "Detailed color and marking description",
      "habitatPosition": "Where in the image it was found",
      "similarSpecies": ["Species A", "Species B"],
      "confidence": 0.200,
      "confidenceReasoning": "Poor visibility, partial view",
      "boundingBox": {"x": 0.500, "y": 0.600, "width": 0.100, "height": 0.080}
    }
  ],
  "annotationMetadata": {
    "totalDetections": 5,
    "identifiedSpecies": 3,
    "unknownSpecies": 2,
    "averageConfidence": 0.750,
    "annotationQuality": "high|medium|low",
    "processingNotes": "Any special considerations or challenges"
  }
}

CRITICAL REQUIREMENTS:
1. Use relative percentage coordinates (0.000-1.000) with THREE DECIMAL PRECISION for all bounding boxes
2. Ensure x+width ≤ 1.000 and y+height ≤ 1.000
3. Provide detailed reasoning for all confidence scores
4. Include comprehensive behavioral and habitat observations
5. Assess image quality for each detection individually
6. Maintain consistent formatting and precision throughout
7. Focus on accuracy over quantity - better to have fewer high-confidence detections than many uncertain ones`;
  }

  // Parse AI response
  private parseAIResponse(content: string): {
    detections: AIDetection[];
    unknownSpecies: UnknownSpecies[];
    imageAnalysis?: ImageAnalysis;
    annotationMetadata?: AnnotationMetadata;
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
        confidenceReasoning: detection.confidenceReasoning,
        wasInDatabase: false, // Will be updated during processing
        databaseId: undefined,
        description: detection.description,
        behavioralNotes: detection.behavioralNotes,
        sizeEstimate: detection.sizeEstimate,
        habitatContext: detection.habitatContext,
        interactions: detection.interactions,
        imageQuality: detection.imageQuality,
        instances: [{
          boundingBox: this.validateBoundingBox(detection.boundingBox),
          confidence: Math.max(0, Math.min(1, detection.confidence || 0))
        }]
      }));

      // Process unknown species
      const unknownSpecies: UnknownSpecies[] = (parsed.unknownSpecies || []).map((unknown: any) => ({
        description: unknown.description || 'Unknown species',
        behavioralNotes: unknown.behavioralNotes,
        sizeCharacteristics: unknown.sizeCharacteristics,
        colorPatterns: unknown.colorPatterns,
        habitatPosition: unknown.habitatPosition,
        similarSpecies: unknown.similarSpecies || [],
        gptResponse: content,
        confidence: Math.max(0, Math.min(1, unknown.confidence || 0)),
        confidenceReasoning: unknown.confidenceReasoning,
        instances: [{
          boundingBox: this.validateBoundingBox(unknown.boundingBox),
          confidence: Math.max(0, Math.min(1, unknown.confidence || 0))
        }]
      }));

      // Process image analysis
      const imageAnalysis: ImageAnalysis | undefined = parsed.imageAnalysis ? {
        overallQuality: parsed.imageAnalysis.overallQuality || 'fair',
        lightingConditions: parsed.imageAnalysis.lightingConditions || 'moderate',
        waterClarity: parsed.imageAnalysis.waterClarity || 'moderate',
        depthEstimate: parsed.imageAnalysis.depthEstimate || 'medium',
        habitatType: parsed.imageAnalysis.habitatType || 'mixed'
      } : undefined;

      // Process annotation metadata
      const annotationMetadata: AnnotationMetadata | undefined = parsed.annotationMetadata ? {
        totalDetections: parsed.annotationMetadata.totalDetections || 0,
        identifiedSpecies: parsed.annotationMetadata.identifiedSpecies || 0,
        unknownSpecies: parsed.annotationMetadata.unknownSpecies || 0,
        averageConfidence: parsed.annotationMetadata.averageConfidence || 0,
        annotationQuality: parsed.annotationMetadata.annotationQuality || 'medium',
        processingNotes: parsed.annotationMetadata.processingNotes
      } : undefined;

      return { 
        detections, 
        unknownSpecies, 
        ...(imageAnalysis && { imageAnalysis }), 
        ...(annotationMetadata && { annotationMetadata }) 
      };

    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate bounding box coordinates (relative percentages with three decimal precision)
  private validateBoundingBox(box: any): BoundingBox {
    if (!box || typeof box !== 'object') {
      console.warn('Invalid bounding box provided, using default');
      return { x: 0.000, y: 0.000, width: 0.100, height: 0.100 };
    }

    // Ensure all values are numbers between 0.000 and 1.000 with three decimal precision
    const x = Math.max(0.000, Math.min(1.000, Number(box.x) || 0.000));
    const y = Math.max(0.000, Math.min(1.000, Number(box.y) || 0.000));
    const width = Math.max(0.001, Math.min(1.000, Number(box.width) || 0.100));
    const height = Math.max(0.001, Math.min(1.000, Number(box.height) || 0.100));

    // Validate coordinates are within image boundaries
    const validatedBox = {
      x: Math.round(x * 1000) / 1000, // Round to three decimal places
      y: Math.round(y * 1000) / 1000, // Round to three decimal places
      width: Math.round(Math.min(width, 1.000 - x) * 1000) / 1000, // Round to three decimal places
      height: Math.round(Math.min(height, 1.000 - y) * 1000) / 1000 // Round to three decimal places
    };

    // Log validation warnings
    if (x !== validatedBox.x || y !== validatedBox.y || width !== validatedBox.width || height !== validatedBox.height) {
      console.warn(`Bounding box coordinates adjusted: original=${JSON.stringify(box)}, validated=${JSON.stringify(validatedBox)}`);
    }

    return validatedBox;
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
