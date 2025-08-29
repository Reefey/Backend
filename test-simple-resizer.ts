import { ImageResizerService } from './src/utils/imageResizer';

async function testSimpleResizer() {
  console.log('Testing Simplified Image Resizer...\n');

  const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Black_damsel_%28Neoglyphidodon_melas%29_%2846091586424%29.jpg/500px-Black_damsel_%28Neoglyphidodon_melas%29_%2846091586424%29.jpg';

  try {
    console.log('Original URL:', testImageUrl);
    console.log('Getting resized URL...\n');

    const resizedUrl = await ImageResizerService.getResizedImageUrl(testImageUrl);
    
    console.log('✅ Success!');
    console.log('Resized URL:', resizedUrl);
    console.log('\n🎉 Simple resizer works perfectly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSimpleResizer();
