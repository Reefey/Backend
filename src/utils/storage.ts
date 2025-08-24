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

  // Convert image format (e.g., HEIC to JPEG)
  async convertImage(buffer: Buffer, format: 'jpeg' | 'png' | 'webp' = 'jpeg'): Promise<Buffer> {
    return sharp(buffer)
      .toFormat(format)
      .toBuffer();
  }

  // Create annotated image with bounding boxes
  async createAnnotatedImage(
    imageBuffer: Buffer,
    detections: Array<{
      species: string;
      confidence: number;
      instances: Array<{ boundingBox: BoundingBox; confidence: number }>;
    }>
  ): Promise<Buffer> {
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Draw bounding boxes for each detection
    detections.forEach((detection, index) => {
      const colors = ['#00FF00', '#FF0000', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
      const color = colors[index % colors.length] || '#00FF00';

      detection.instances.forEach(instance => {
        const { x, y, width, height } = instance.boundingBox;

        // Draw rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        const label = `${detection.species} (${Math.round(instance.confidence * 100)}%)`;
        const labelWidth = ctx.measureText(label).width + 10;
        const labelHeight = 20;

        ctx.fillStyle = color;
        ctx.fillRect(x, y - labelHeight - 5, labelWidth, labelHeight);

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        ctx.fillText(label, x + 5, y - 8);
      });
    });

    return canvas.toBuffer('image/jpeg', { quality: 0.9 });
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
    }>
  ): Promise<{
    originalUrl: string;
    annotatedUrl?: string;
    filePath: string;
  }> {
    const filename = this.generateFilename(file.originalname, `${species}_`);
    const filePath = `collections/${deviceId}/${species}/${filename}`;

    // Convert image if needed
    let imageBuffer = file.buffer;
    if (file.mimetype.includes('heic') || file.mimetype.includes('heif')) {
      imageBuffer = await this.convertImage(file.buffer, 'jpeg');
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
        const annotatedBuffer = await this.createAnnotatedImage(imageBuffer, detections);
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
    const filePath = `marine/${marineId}/${filename}`;
    return this.uploadFile(buffer, config.storage.bucket, filePath);
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
