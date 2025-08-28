import OpenAI from 'openai';
import { config } from '../config/global';
import { db } from '../utils/database';
import { AIDetection, UnknownSpecies, AIAnalysisResponse, CollectionEntry, BoundingBox, ImageAnalysis, AnnotationMetadata } from '../types/model';

export class AIService {
  private openai: OpenAI;
  private rateLimitMap: Map<string, { count: number; resetTime: number }>;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // 1 second

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

  // Retry mechanism with exponential backoff
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.retryAttempts,
    baseDelay: number = this.retryDelay
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`AI operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Fallback analysis when AI fails
  private async fallbackAnalysis(
    imageBuffer: Buffer,
    _deviceId: string,
    _spotId?: number,
    _lat?: number,
    _lng?: number
  ): Promise<AIAnalysisResponse> {
    console.log('🔄 Using fallback analysis - AI service unavailable or refused analysis');
    
    try {
      // Try to extract basic image information
      await this.extractBasicImageInfo(imageBuffer);
      
      // Create a basic fallback response
      const fallbackDetection: AIDetection = {
        species: 'Unknown Marine Life',
        scientificName: undefined,
        confidence: 0.1,
        confidenceReasoning: 'Fallback analysis - AI service unavailable',
        wasInDatabase: false,
        databaseId: undefined,
        description: 'Unable to identify species due to AI service unavailability',
        behavioralNotes: 'No behavioral observations available',
        sizeEstimate: 'Unknown',
        habitatContext: 'Underwater environment',
        interactions: 'No interaction data available',
        imageQuality: 'unknown',
        instances: [{
          boundingBox: { x: 0.250, y: 0.250, width: 0.500, height: 0.500 },
          confidence: 0.1
        }]
      };

      const fallbackUnknownSpecies: UnknownSpecies = {
        description: 'Marine life detected but unable to identify due to service limitations',
        behavioralNotes: 'No behavioral data available',
        sizeCharacteristics: 'Size cannot be determined',
        colorPatterns: 'Color analysis unavailable',
        habitatPosition: 'Underwater environment',
        similarSpecies: [],
        gptResponse: 'Fallback analysis used',
        confidence: 0.1,
        confidenceReasoning: 'Limited analysis due to AI service unavailability',
        instances: [{
          boundingBox: { x: 0.250, y: 0.250, width: 0.500, height: 0.500 },
          confidence: 0.1
        }]
      };

      const fallbackImageAnalysis: ImageAnalysis = {
        overallQuality: 'unknown',
        lightingConditions: 'unknown',
        waterClarity: 'unknown',
        depthEstimate: 'unknown',
        habitatType: 'unknown'
      };

      const fallbackMetadata: AnnotationMetadata = {
        totalDetections: 1,
        identifiedSpecies: 0,
        unknownSpecies: 1,
        averageConfidence: 0.1,
        annotationQuality: 'low',
        processingNotes: 'Fallback analysis used due to AI service unavailability'
      };

      return {
        detections: [fallbackDetection],
        unknownSpecies: [fallbackUnknownSpecies],
        originalPhotoUrl: '',
        annotatedPhotoUrl: '',
        collectionEntries: [],
        processedImageBuffer: imageBuffer,
        imageAnalysis: fallbackImageAnalysis,
        annotationMetadata: fallbackMetadata
      };

    } catch (error) {
      console.error('Fallback analysis also failed:', error);
      
      // Ultimate fallback - return minimal response
      return {
        detections: [],
        unknownSpecies: [],
        originalPhotoUrl: '',
        annotatedPhotoUrl: '',
        collectionEntries: [],
        processedImageBuffer: imageBuffer,
        imageAnalysis: {
          overallQuality: 'unknown',
          lightingConditions: 'unknown',
          waterClarity: 'unknown',
          depthEstimate: 'unknown',
          habitatType: 'unknown'
        },
        annotationMetadata: {
          totalDetections: 0,
          identifiedSpecies: 0,
          unknownSpecies: 0,
          averageConfidence: 0,
          annotationQuality: 'failed',
          processingNotes: 'Complete analysis failure - unable to process image'
        }
      };
    }
  }

  // Extract basic image information without AI
  private async extractBasicImageInfo(imageBuffer: Buffer): Promise<any> {
    try {
      const sharp = require('sharp');
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length,
        hasAlpha: metadata.hasAlpha
      };
    } catch (error) {
      console.warn('Failed to extract image metadata:', error);
      return {
        size: imageBuffer.length,
        format: 'unknown'
      };
    }
  }

  // Analyze image for marine life identification with comprehensive fallback
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

      // Call OpenAI Vision API with retry mechanism
      const response = await this.retryOperation(async () => {
        return await this.openai.chat.completions.create({
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
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      // Parse AI response with fallback
      const aiResult = await this.parseAIResponseWithFallback(content);

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
      console.error('AI analysis failed, using fallback:', error);
      
      // Use fallback analysis
      return await this.fallbackAnalysis(imageBuffer, deviceId, spotId, lat, lng);
    }
  }

  // Parse AI response with fallback for malformed responses
  private async parseAIResponseWithFallback(content: string): Promise<{
    detections: AIDetection[];
    unknownSpecies: UnknownSpecies[];
    imageAnalysis?: ImageAnalysis;
    annotationMetadata?: AnnotationMetadata;
  }> {
    try {
      return this.parseAIResponse(content);
    } catch (error) {
      console.warn('Failed to parse AI response, attempting recovery:', error);
      
      // Try to extract partial information from the response
      return this.recoverPartialResponse(content);
    }
  }

  // Recover partial information from malformed AI response
  private recoverPartialResponse(content: string): {
    detections: AIDetection[];
    unknownSpecies: UnknownSpecies[];
    imageAnalysis?: ImageAnalysis;
    annotationMetadata?: AnnotationMetadata;
  } {
    console.log('🔄 Attempting to recover partial response from AI');
    
    const detections: AIDetection[] = [];
    const unknownSpecies: UnknownSpecies[] = [];
    
    // Try to extract species names from the text
    const speciesPatterns = [
      /"species":\s*"([^"]+)"/gi,
      /species[:\s]+([A-Za-z\s]+)/gi,
      /([A-Za-z]+fish|shark|ray|turtle|octopus|coral|anemone)/gi
    ];
    
    const foundSpecies = new Set<string>();
    
    for (const pattern of speciesPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const species = match.replace(/["{}:,\s]/g, '').trim();
          if (species && species.length > 2) {
            foundSpecies.add(species);
          }
        });
      }
    }
    
    // Create basic detections from found species
    foundSpecies.forEach(species => {
      detections.push({
        species: species,
        scientificName: undefined,
        confidence: 0.3,
        confidenceReasoning: 'Recovered from partial AI response',
        wasInDatabase: false,
        databaseId: undefined,
        description: `Recovered species: ${species}`,
        behavioralNotes: 'No behavioral data available',
        sizeEstimate: 'Unknown',
        habitatContext: 'Underwater environment',
        interactions: 'No interaction data available',
        imageQuality: 'unknown',
        instances: [{
          boundingBox: { x: 0.250, y: 0.250, width: 0.500, height: 0.500 },
          confidence: 0.3
        }]
      });
    });
    
    // If no species found, create a generic unknown species
    if (detections.length === 0) {
      unknownSpecies.push({
        description: 'Marine life detected but identification failed',
        behavioralNotes: 'No behavioral data available',
        sizeCharacteristics: 'Size cannot be determined',
        colorPatterns: 'Color analysis unavailable',
        habitatPosition: 'Underwater environment',
        similarSpecies: [],
        gptResponse: content,
        confidence: 0.2,
        confidenceReasoning: 'Partial response recovery',
        instances: [{
          boundingBox: { x: 0.250, y: 0.250, width: 0.500, height: 0.500 },
          confidence: 0.2
        }]
      });
    }
    
    return {
      detections,
      unknownSpecies,
      imageAnalysis: {
        overallQuality: 'unknown',
        lightingConditions: 'unknown',
        waterClarity: 'unknown',
        depthEstimate: 'unknown',
        habitatType: 'unknown'
      },
      annotationMetadata: {
        totalDetections: detections.length + unknownSpecies.length,
        identifiedSpecies: detections.length,
        unknownSpecies: unknownSpecies.length,
        averageConfidence: detections.length > 0 ? 0.3 : 0.2,
        annotationQuality: 'low',
        processingNotes: 'Recovered from partial AI response'
      }
    };
  }

  // Batch analyze multiple images for comprehensive annotation with fallback
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

        // Analyze the image with fallback
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
        console.error(`Failed to analyze image ${image.filename}:`, error);
        
        // Use fallback for this specific image
        try {
          const fallbackAnalysis = await this.fallbackAnalysis(image.buffer, deviceId, spotId, lat, lng);
          
          results.push({
            filename: image.filename,
            analysis: fallbackAnalysis,
            success: true // Mark as success since we have a fallback result
          });
          
          // Update statistics for fallback
          const detections = fallbackAnalysis.detections.length;
          const avgConfidence = fallbackAnalysis.detections.reduce((sum, d) => sum + d.confidence, 0) / Math.max(detections, 1);
          
          totalDetections += detections;
          totalConfidence += avgConfidence;
          confidenceCount++;
          
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${image.filename}:`, fallbackError);
          
          results.push({
            filename: image.filename,
            analysis: {} as AIAnalysisResponse,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
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

MARINE LIFE CHARACTERISTICS TO IDENTIFY:
- Category: Fishes, Creatures, or Corals
- Size range estimation (small/medium/large with approximate cm)
- Habitat type (reef, sand, seagrass, deep water, etc.)
- Diet type (carnivore, herbivore, omnivore, filter feeder, etc.)
- Behavior patterns (social, solitary, territorial, migratory, etc.)
- Danger level assessment (Low/Medium/High/Extreme)
- Venomous/toxic characteristics (spines, stinging cells, venomous bites, etc.)
- Conservation status indicators (common, rare, endangered, etc.)

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
      "imageQuality": "excellent|good|fair|poor for this detection",
      "estimatedCharacteristics": {
        "category": "Fishes|Creatures|Corals",
        "sizeRange": "small|medium|large",
        "habitatType": ["reef", "sand", "seagrass"],
        "diet": "carnivore|herbivore|omnivore|filter feeder",
        "behavior": "social|solitary|territorial|migratory",
        "dangerLevel": "Low|Medium|High|Extreme",
        "venomous": true|false,
        "conservationStatus": "common|rare|endangered"
      }
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
7. Focus on accuracy over quantity - better to have fewer high-confidence detections than many uncertain ones
8. Include estimated characteristics for each detected species to help with database matching`;
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
        estimatedCharacteristics: detection.estimatedCharacteristics, // New field for AI-estimated characteristics
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

        // Enhance detection with marine species data
        detection.marineData = {
          id: existingMarine.id,
          name: existingMarine.name,
          scientificName: existingMarine.scientificName,
          category: existingMarine.category,
          rarity: existingMarine.rarity,
          sizeMinCm: existingMarine.sizeMinCm,
          sizeMaxCm: existingMarine.sizeMaxCm,
          habitatType: existingMarine.habitatType,
          diet: existingMarine.diet,
          behavior: existingMarine.behavior,
          danger: existingMarine.danger,
          venomous: existingMarine.venomous,
          edibility: existingMarine.edibility,
          poisonous: existingMarine.poisonous,
          endangeredd: existingMarine.endangeredd,
          description: existingMarine.description,
          lifeSpan: existingMarine.lifeSpan,
          reproduction: existingMarine.reproduction,
          migration: existingMarine.migration,
          endangered: existingMarine.endangered,
          funFact: existingMarine.funFact,
          imageUrl: existingMarine.imageUrl,
          createdAt: existingMarine.createdAt,
          updatedAt: existingMarine.updatedAt
        };

        // Check if collection already exists for this marine species and device
        const existingCollection = await db.findCollectionByMarineAndDevice(existingMarine.id, deviceId);

        if (existingCollection) {
          // Use existing collection and update last seen timestamp
          await db.updateCollectionLastSeen(existingCollection.id, deviceId);
          
          collectionEntries.push({
            id: existingCollection.id,
            marineId: existingMarine.id,
            name: detection.species,
            status: 'identified',
            ...(detection.marineData && { marineData: detection.marineData }),
            photo: {
              url: '', // Will be set by storage service
              annotatedUrl: '', // Will be set by storage service
              boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
            }
          });
        } else {
          // Create new collection entry
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
            ...(detection.marineData && { marineData: detection.marineData }),
            photo: {
              url: '', // Will be set by storage service
              annotatedUrl: '', // Will be set by storage service
              boundingBox: detection.instances[0]?.boundingBox || { x: 0, y: 0, width: 100, height: 100 }
            }
          });
        }

      } else {
        // Create new marine species if confidence is high enough
        if (detection.confidence >= 0.8 && detection.scientificName) {
          try {
            // Get detailed species information including image URL
            let speciesDetails;
            try {
              speciesDetails = await this.getSpeciesDetails(detection.species);
            } catch (error) {
              console.warn(`Failed to get detailed species info for ${detection.species}:`, error);
              // Fallback to basic creation
              speciesDetails = {
                name: detection.species,
                scientificName: detection.scientificName,
                category: 'Fishes',
                rarity: 3,
                sizeMinCm: 0,
                sizeMaxCm: 10,
                habitatType: ['Unknown'],
                diet: 'Unknown',
                behavior: 'Unknown',
                danger: 'Low',
                venomous: false,
                edibility: false,
                poisonous: false,
                endangeredd: false,
                description: `Identified as ${detection.species}`,
                lifeSpan: 'Unknown',
                reproduction: 'Unknown',
                migration: 'Unknown',
                endangered: 'Unknown',
                funFact: 'Species identified through AI analysis',
                imageUrl: null
              };
            }

            // If no image URL was provided, try to search for one
            if (!speciesDetails.imageUrl) {
              try {
                speciesDetails.imageUrl = await this.searchMarineImage(detection.species, detection.scientificName);
              } catch (error) {
                console.warn(`Failed to search for image for ${detection.species}:`, error);
              }
            }

            const newMarine = await db.createMarine({
              name: speciesDetails.name,
              scientificName: speciesDetails.scientificName,
              category: speciesDetails.category,
              rarity: speciesDetails.rarity,
              sizeMinCm: speciesDetails.sizeMinCm,
              sizeMaxCm: speciesDetails.sizeMaxCm,
              habitatType: speciesDetails.habitatType,
              diet: speciesDetails.diet,
              behavior: speciesDetails.behavior,
              danger: speciesDetails.danger,
              venomous: speciesDetails.venomous,
              edibility: speciesDetails.edibility,
              poisonous: speciesDetails.poisonous,
              endangeredd: speciesDetails.endangeredd,
              description: speciesDetails.description,
              lifeSpan: speciesDetails.lifeSpan,
              reproduction: speciesDetails.reproduction,
              migration: speciesDetails.migration,
              endangered: speciesDetails.endangered,
              funFact: speciesDetails.funFact,
              imageUrl: speciesDetails.imageUrl
            });

            detection.wasInDatabase = true;
            detection.databaseId = newMarine.id;

            // Add marine data to detection
            detection.marineData = {
              id: newMarine.id,
              name: newMarine.name,
              scientificName: newMarine.scientificName,
              category: newMarine.category,
              rarity: newMarine.rarity,
              sizeMinCm: newMarine.sizeMinCm,
              sizeMaxCm: newMarine.sizeMaxCm,
              habitatType: newMarine.habitatType,
              diet: newMarine.diet,
              behavior: newMarine.behavior,
              danger: newMarine.danger,
              venomous: newMarine.venomous,
              edibility: newMarine.edibility,
              poisonous: newMarine.poisonous,
              endangeredd: newMarine.endangeredd,
              description: newMarine.description,
              lifeSpan: newMarine.lifeSpan,
              reproduction: newMarine.reproduction,
              migration: newMarine.migration,
              endangered: newMarine.endangered,
              funFact: newMarine.funFact,
              imageUrl: newMarine.imageUrl,
              createdAt: newMarine.createdAt,
              updatedAt: newMarine.updatedAt
            };

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
              ...(detection.marineData && { marineData: detection.marineData }),
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
      const prompt = `You are a marine biology expert specializing in Indo-Pacific marine life, particularly around Bali and Indonesia. Provide comprehensive information about this marine species: ${speciesName}

COMPREHENSIVE DATA REQUIREMENTS:

Return a JSON object with EXACTLY these fields to match our database schema:

{
  "name": "Common name (standardized)",
  "scientificName": "Scientific name with proper formatting",
  "category": "Fishes|Creatures|Corals",
  "rarity": 1-5 (1=extremely rare, 5=very common),
  "sizeMinCm": number (minimum size in cm),
  "sizeMaxCm": number (maximum size in cm),
  "habitatType": ["array", "of", "habitat", "types"],
  "diet": "Detailed diet description",
  "behavior": "Behavioral patterns and characteristics",
  "danger": "Low|Medium|High|Extreme",
  "venomous": boolean,
  "edibility": boolean,
  "poisonous": boolean,
  "endangeredd": boolean,
  "description": "Comprehensive species description",
  "lifeSpan": "Life span description",
  "reproduction": "Reproduction method and details",
  "migration": "Migration patterns and movement",
  "endangered": "Conservation status (e.g., 'Least Concern', 'Vulnerable', 'Endangered')",
  "funFact": "Interesting or unique fact about the species",
  "imageUrl": "High-quality image URL from reliable sources (Wikipedia, FishBase, etc.)"
}

DETAILED FIELD REQUIREMENTS:

1. **name**: Standardized common name
2. **scientificName**: Properly formatted scientific name (Genus species)
3. **category**: Must be exactly "Fishes", "Creatures", or "Corals"
4. **rarity**: Integer 1-5 based on frequency in Bali/Indonesia waters
   - 1: Extremely rare (sperm whale, saltwater crocodile)
   - 2: Rare (manta rays, some sharks)
   - 3: Uncommon (many reef fish, octopuses)
   - 4: Common (clownfish, tangs, common reef fish)
   - 5: Very common (damselfish, cleaner shrimp)
5. **sizeMinCm/sizeMaxCm**: Numeric values in centimeters
6. **habitatType**: Array of specific habitats (e.g., ["Coral Reefs", "Anemones", "Shallow reefs"])
7. **diet**: Specific diet description (e.g., "Omnivore", "Carnivore", "Herbivore", "Zooplankton")
8. **behavior**: Behavioral characteristics (e.g., "Social", "Solitary", "Nocturnal", "Territorial")
9. **danger**: Must be exactly "Low", "Medium", "High", or "Extreme"
10. **venomous**: Boolean (true/false)
11. **edibility**: Boolean (true/false) - whether the species is edible for humans
12. **poisonous**: Boolean (true/false) - whether the species is poisonous if consumed
13. **endangeredd**: Boolean (true/false) - whether the species is endangered (note: different from "endangered" field)
14. **description**: 2-3 sentence comprehensive description
15. **lifeSpan**: Life span description (e.g., "6-10 years", "Decades", "1-2 years")
16. **reproduction**: Reproduction details (e.g., "Egg laying", "Live birth", "Broadcast spawner")
17. **migration**: Movement patterns (e.g., "Site-attached", "Local movements", "Long-distance")
18. **endangered**: IUCN conservation status or similar
19. **funFact**: One interesting fact about the species
20. **imageUrl**: High-quality image URL from reliable sources. Prefer:
    - Wikipedia Commons (https://upload.wikimedia.org/wikipedia/commons/...)
    - FishBase (https://www.fishbase.se/images/...)
    - Marine species databases
    - High-resolution, clear images showing the species clearly
    - If no specific image found, use a placeholder or null

SPECIES-SPECIFIC GUIDELINES:

- For fish: Include swimming patterns, social behavior, feeding habits
- For creatures (octopuses, turtles, etc.): Include intelligence, movement, habitat preferences
- For corals: Include growth patterns, symbiotic relationships, environmental requirements
- For venomous species: Clearly indicate venomous status and danger level
- For endangered species: Include conservation context
- For Bali-specific species: Include local context and diving locations

BOOLEAN FIELD GUIDELINES:

- **venomous**: true if species has venomous spines, stings, or bites (e.g., lionfish, stonefish, sea snakes)
- **edibility**: true if commonly consumed by humans (e.g., tuna, grouper, some reef fish)
- **poisonous**: true if toxic when consumed (e.g., pufferfish, some sea cucumbers, toxic corals)
- **endangeredd**: true if species is listed as endangered, vulnerable, or critically endangered by IUCN

ACCURACY REQUIREMENTS:
- Use scientific accuracy and current taxonomy
- Base rarity on Indo-Pacific/Bali region frequency
- Provide realistic size ranges based on actual species data
- Include specific habitat types found in the region
- Ensure all boolean fields are true/false, not strings
- Ensure all numeric fields are numbers, not strings
- For imageUrl: Provide direct links to high-quality images, prefer Wikipedia Commons URLs

Return ONLY the JSON object, no additional text or explanations.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
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

      const parsedData = JSON.parse(jsonMatch[0]);

      // Validate and ensure all required fields are present
      const requiredFields = [
        'name', 'scientificName', 'category', 'rarity', 'sizeMinCm', 'sizeMaxCm',
        'habitatType', 'diet', 'behavior', 'danger', 'venomous', 'edibility', 
        'poisonous', 'endangeredd', 'description', 'lifeSpan', 'reproduction', 
        'migration', 'endangered', 'funFact', 'imageUrl'
      ];

      for (const field of requiredFields) {
        if (!(field in parsedData)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Ensure proper data types
      if (typeof parsedData.rarity !== 'number' || parsedData.rarity < 1 || parsedData.rarity > 5) {
        parsedData.rarity = 3; // Default to uncommon if invalid
      }

      if (typeof parsedData.sizeMinCm !== 'number' || parsedData.sizeMinCm < 0) {
        parsedData.sizeMinCm = 0;
      }

      if (typeof parsedData.sizeMaxCm !== 'number' || parsedData.sizeMaxCm < parsedData.sizeMinCm) {
        parsedData.sizeMaxCm = parsedData.sizeMinCm + 10; // Default range
      }

      if (!Array.isArray(parsedData.habitatType)) {
        parsedData.habitatType = [parsedData.habitatType || 'Unknown'];
      }

      if (typeof parsedData.venomous !== 'boolean') {
        parsedData.venomous = false; // Default to non-venomous
      }

      if (typeof parsedData.edibility !== 'boolean') {
        parsedData.edibility = false; // Default to non-edible
      }

      if (typeof parsedData.poisonous !== 'boolean') {
        parsedData.poisonous = false; // Default to non-poisonous
      }

      if (typeof parsedData.endangeredd !== 'boolean') {
        parsedData.endangeredd = false; // Default to not endangered
      }

      // Validate imageUrl
      if (typeof parsedData.imageUrl !== 'string' || !parsedData.imageUrl.trim()) {
        parsedData.imageUrl = null;
      }

      return parsedData;

    } catch (error) {
      throw new Error(`Failed to get species details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Search for marine species image online
  async searchMarineImage(speciesName: string, scientificName?: string): Promise<string | null> {
    try {
      const searchTerms = scientificName ? `${speciesName} ${scientificName}` : speciesName;
      
      const prompt = `Find a high-quality image URL for the marine species: ${searchTerms}

Requirements:
- Must be a direct link to an image file (ending in .jpg, .jpeg, .png, .webp)
- Prefer Wikipedia Commons URLs (https://upload.wikimedia.org/wikipedia/commons/...)
- Image should be clear and show the species well
- Must be publicly accessible and free to use
- Avoid watermarked or low-quality images

Return ONLY the image URL as a string, or "null" if no suitable image found.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content || content === 'null' || content === 'null.') {
        return null;
      }

      // Validate URL format
      try {
        const url = new URL(content);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return content;
        }
      } catch {
        return null;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to search for image for ${speciesName}:`, error);
      return null;
    }
  }
}

export const aiService = new AIService();
