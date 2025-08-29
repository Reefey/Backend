import axios from 'axios';

export interface ResizedImageResponse {
  url: string;
  filename: string;
}

export class ImageResizerService {
  private static readonly RESIZER_BASE_URL = 'https://resizer-main-0tzhof.laravel.cloud/api';

  /**
   * Resize an image using the external resizer service
   * @param originalImageUrl - The original image URL to resize
   * @returns Promise<ResizedImageResponse> - The resized image information
   */
  static async resizeImage(originalImageUrl: string): Promise<ResizedImageResponse> {
    try {
      if (!originalImageUrl) {
        throw new Error('Original image URL is required');
      }

      // Encode the URL parameter
      const encodedUrl = encodeURIComponent(originalImageUrl);
      const resizerUrl = `${this.RESIZER_BASE_URL}?url=${encodedUrl}`;

      console.log(`Resizing image: ${originalImageUrl}`);
      
      const response = await axios.get<ResizedImageResponse>(resizerUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Reefey-Image-Resizer/1.0'
        }
      });

      if (!response.data || !response.data.url) {
        throw new Error('Invalid response from resizer service');
      }

      console.log(`Image resized successfully: ${response.data.url}`);
      return response.data;

    } catch (error) {
      console.error('Error resizing image:', error);
      
      // Return the original URL if resizing fails
      return {
        url: originalImageUrl,
        filename: originalImageUrl.split('/').pop() || 'original.jpg'
      };
    }
  }



  /**
   * Get resized image URL using query parameter
   * @param originalImageUrl - The original image URL
   * @returns Promise<string> - The resized image URL
   */
  static async getResizedImageUrl(originalImageUrl: string): Promise<string> {
    if (!originalImageUrl) {
      return originalImageUrl;
    }

    try {
      const resizedImage = await this.resizeImage(originalImageUrl);
      return resizedImage.url;
    } catch (error) {
      console.error('Failed to resize image, returning original:', error);
      return originalImageUrl;
    }
  }
}
