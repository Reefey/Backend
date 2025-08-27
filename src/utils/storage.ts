import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import { config } from '../config/global';
import { BoundingBox } from '../types/model';

// Create Supabase client for storage
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Storage utility functions
export class StorageService {
  // Generate unique filename
  generateFilename(originalName: string, prefix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop() || 'jpg';
    return `${prefix}${timestamp}_${random}.${extension}`;
  }

  // Process image from either binary buffer or base64 string
  async processImageInput(imageInput: Buffer | string, originalName: string = 'image.jpg'): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
    size: number;
  }> {
    let buffer: Buffer;
    let mimeType: string = 'image/jpeg';
    let filename: string = originalName;

    if (typeof imageInput === 'string') {
      // Handle base64 input
      if (imageInput.startsWith('data:image/')) {
        // Data URL format: data:image/jpeg;base64,/9j/4AAQ...
        const matches = imageInput.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          throw new Error('Invalid data URL format');
        }
        
        mimeType = matches[1] || 'image/jpeg';
        const base64Data = matches[2];
        if (!base64Data) {
          throw new Error('Invalid data URL format: missing base64 data');
        }
        buffer = Buffer.from(base64Data, 'base64');
        
        // Extract filename from mime type
        const extension = mimeType.split('/')[1] || 'jpg';
        filename = `base64_image.${extension}`;
      } else {
        // Plain base64 string
        try {
          buffer = Buffer.from(imageInput, 'base64');
          // Try to detect mime type from buffer
          const fileSignature = buffer.slice(0, 4).toString('hex').toUpperCase();
          if (fileSignature.startsWith('FFD8')) {
            mimeType = 'image/jpeg';
            filename = 'base64_image.jpg';
          } else if (fileSignature.startsWith('89504E47')) {
            mimeType = 'image/png';
            filename = 'base64_image.png';
          } else if (fileSignature.startsWith('47494638')) {
            mimeType = 'image/gif';
            filename = 'base64_image.gif';
          } else if (fileSignature.startsWith('52494646')) {
            mimeType = 'image/webp';
            filename = 'base64_image.webp';
          } else {
            // Default to JPEG
            mimeType = 'image/jpeg';
            filename = 'base64_image.jpg';
          }
        } catch (error) {
          throw new Error('Invalid base64 string');
        }
      }
    } else {
      // Handle binary buffer input
      buffer = imageInput;
      // For binary input, we'll use the original filename and detect mime type
      const fileSignature = buffer.slice(0, 4).toString('hex').toUpperCase();
      if (fileSignature.startsWith('FFD8')) {
        mimeType = 'image/jpeg';
      } else if (fileSignature.startsWith('89504E47')) {
        mimeType = 'image/png';
      } else if (fileSignature.startsWith('47494638')) {
        mimeType = 'image/gif';
      } else if (fileSignature.startsWith('52494646')) {
        mimeType = 'image/webp';
      }
    }

    // Validate and convert image to JPEG
    try {
      const { buffer: validatedBuffer } = await this.validateAndConvertImage(buffer);
      return {
        buffer: validatedBuffer,
        mimeType: 'image/jpeg',
        filename: filename.replace(/\.[^/.]+$/, '.jpg'),
        size: validatedBuffer.length
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Convert image format (e.g., HEIC to JPEG)
  async convertImage(buffer: Buffer, format: 'jpeg' | 'png' | 'webp' = 'jpeg'): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .toFormat(format)
        .toBuffer();
    } catch (error) {
      console.error('Image conversion failed:', error);
      throw new Error(`Failed to convert image to ${format}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate image format and convert if needed
  async validateAndConvertImage(buffer: Buffer): Promise<{ buffer: Buffer; format: string }> {
    try {
      // Try to get image metadata to validate format
      const metadata = await sharp(buffer).metadata();
      const format = metadata.format?.toLowerCase();
      
      // Convert to JPEG if not already JPEG
      if (format !== 'jpeg') {
        console.log(`Converting image from ${format} to jpeg`);
        const jpegBuffer = await this.convertImage(buffer, 'jpeg');
        return { buffer: jpegBuffer, format: 'jpeg' };
      }
      
      return { buffer, format: 'jpeg' };
    } catch (error) {
      console.error('Image validation failed:', error);
      throw new Error(`Invalid or unsupported image format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create annotated image with bounding boxes
  async createAnnotatedImage(
    imageBuffer: Buffer,
    detections: Array<{
      species: string;
      confidence: number;
      instances: Array<{ boundingBox: BoundingBox; confidence: number }>;
    }>,
    useProcessedBuffer: boolean = false
  ): Promise<Buffer> {
    try {
      let jpegBuffer: Buffer;
      
      if (useProcessedBuffer) {
        // Use the already processed JPEG buffer (from AI analysis)
        jpegBuffer = imageBuffer;
      } else {
        // Validate and convert image to JPEG first to prevent "Unsupported image type" errors
        const { buffer } = await this.validateAndConvertImage(imageBuffer);
        jpegBuffer = buffer;
      }
      
      const image = await loadImage(jpegBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      // Draw original image
      ctx.drawImage(image, 0, 0);

      // Draw bounding boxes for each detection
      detections.forEach((detection, index) => {
        const colors = ['#00FF00', '#FF0000', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
        const color = colors[index % colors.length] || '#00FF00';

        detection.instances.forEach(instance => {
          // Convert relative coordinates (0.0-1.0) to pixel coordinates
          const pixelX = Math.round(instance.boundingBox.x * image.width);
          const pixelY = Math.round(instance.boundingBox.y * image.height);
          const pixelWidth = Math.round(instance.boundingBox.width * image.width);
          const pixelHeight = Math.round(instance.boundingBox.height * image.height);

          // Draw rectangle
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(pixelX, pixelY, pixelWidth, pixelHeight);

          // Draw label background
          const label = `${detection.species} (${Math.round(instance.confidence * 100)}%)`;
          const labelWidth = ctx.measureText(label).width + 10;
          const labelHeight = 20;

          ctx.fillStyle = color;
          ctx.fillRect(pixelX, pixelY - labelHeight - 5, labelWidth, labelHeight);

          // Draw label text
          ctx.fillStyle = '#000000';
          ctx.font = '14px Arial';
          ctx.fillText(label, pixelX + 5, pixelY - 8);
        });
      });

      return canvas.toBuffer('image/jpeg', { quality: 0.9 });
    } catch (error) {
      console.error('Error creating annotated image:', error);
      throw new Error(`Failed to create annotated image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Upload file to Supabase Storage
  async uploadFile(
    buffer: Buffer,
    bucket: string,
    path: string,
    contentType: string = 'image/jpeg'
  ): Promise<string> {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  // Upload collection photo with annotation
  async uploadCollectionPhoto(
    file: Express.Multer.File,
    deviceId: string,
    species: string,
    _collectionId: number,
    detections?: Array<{
      species: string;
      confidence: number;
      instances: Array<{ boundingBox: BoundingBox; confidence: number }>;
    }>,
    processedImageBuffer?: Buffer
  ): Promise<{
    originalUrl: string;
    annotatedUrl?: string;
    filePath: string;
  }> {
    const filename = this.generateFilename(file.originalname, `${species}_`);
    const filePath = `collections/${deviceId}/${species}/${filename}`;

    // Validate and convert image to JPEG to prevent "Unsupported image type" errors
    let imageBuffer = file.buffer;
    try {
      const { buffer } = await this.validateAndConvertImage(file.buffer);
      imageBuffer = buffer;
    } catch (error) {
      console.error('Failed to validate/convert image:', error);
      throw new Error(`Invalid image format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Upload original image
    const originalUrl = await this.uploadFile(
      imageBuffer,
      config.storage.bucket,
      filePath,
      'image/jpeg'
    );

    let annotatedUrl: string | undefined;

    // Create and upload annotated image if detections are provided
    if (detections && detections.length > 0) {
      try {
        // Use processed image buffer if provided (for consistent annotation)
        const bufferForAnnotation = processedImageBuffer || imageBuffer;
        const useProcessedBuffer = !!processedImageBuffer;
        
        const annotatedBuffer = await this.createAnnotatedImage(
          bufferForAnnotation, 
          detections,
          useProcessedBuffer
        );
        const annotatedPath = filePath.replace(/\.[^/.]+$/, '_annotated.jpg');
        
        annotatedUrl = await this.uploadFile(
          annotatedBuffer,
          config.storage.bucket,
          annotatedPath,
          'image/jpeg'
        );
      } catch (error) {
        console.error('Failed to create annotated image:', error);
        // Don't fail the entire upload if annotation fails
      }
    }

    return {
      originalUrl,
      ...(annotatedUrl && { annotatedUrl }),
      filePath
    };
  }

  // Upload marine species image
  async uploadMarineImage(
    buffer: Buffer,
    marineId: number,
    filename: string
  ): Promise<string> {
    // Validate and convert image to JPEG to prevent "Unsupported image type" errors
    let imageBuffer = buffer;
    try {
      const { buffer: validatedBuffer } = await this.validateAndConvertImage(buffer);
      imageBuffer = validatedBuffer;
    } catch (error) {
      console.error('Failed to validate/convert image:', error);
      throw new Error(`Invalid image format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    const filePath = `marine/${marineId}/${filename}`;
    return this.uploadFile(imageBuffer, config.storage.bucket, filePath, 'image/jpeg');
  }

  // Delete file from storage
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  }

  // Get file info
  async getFileInfo(bucket: string, path: string): Promise<any> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path.split('/').slice(0, -1).join('/'));

    if (error) throw error;
    return data;
  }

  // Check if file exists
  async fileExists(bucket: string, path: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/'));

      if (error) return false;
      
      const filename = path.split('/').pop();
      return data?.some(file => file.name === filename) || false;
    } catch {
      return false;
    }
  }
}

export const storage = new StorageService();
