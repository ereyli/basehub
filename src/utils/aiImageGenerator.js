import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_NFT_CONFIG } from '../config/aiNFT';

// Google Studio API configuration
const genAI = new GoogleGenerativeAI(AI_NFT_CONFIG.GOOGLE_STUDIO_API_KEY);

/**
 * Generate image using MiniMax Image Generation API
 * @param {string} prompt - Text prompt for image generation
 * @returns {Promise<string>} - Base64 encoded image data
 */
async function generateWithMiniMax(prompt) {
  const apiKey = AI_NFT_CONFIG.MINIMAX_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_MINIMAX_API_KEY') {
    throw new Error('MiniMax API key not configured');
  }
  
  console.log('🎨 Generating image with MiniMax Image Generation API...');
  
  try {
    const response = await fetch('https://api.minimax.io/v1/image_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt: prompt,
        aspect_ratio: '1:1', // Square for NFT
        response_format: 'base64'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.data && result.data.image_base64 && result.data.image_base64.length > 0) {
      const base64Image = result.data.image_base64[0];
      const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      console.log('✅ Image generated with MiniMax!');
      return imageDataUrl;
    } else {
      throw new Error('No image data in MiniMax response');
    }
  } catch (error) {
    console.error('❌ MiniMax API error:', error.message);
    throw error;
  }
}

/**
 * Enhance uploaded image with AI processing
 * @param {string} uploadedImage - Base64 encoded uploaded image
 * @param {string} enhancementPrompt - Enhancement instructions
 * @returns {Promise<string>} - Enhanced base64 image
 */
async function enhanceUploadedImage(uploadedImage, enhancementPrompt) {
  try {
    console.log('🖼️ Processing uploaded image...');
    console.log('📝 Enhancement prompt:', enhancementPrompt || 'None provided');
    
    // Always process the image, even without enhancement prompt
    // This allows for basic optimization and resizing
    return createEnhancedImageFromUpload(uploadedImage, enhancementPrompt);
    
  } catch (error) {
    console.error('❌ Error processing uploaded image:', error);
    // Fallback to original image
    return uploadedImage;
  }
}

/**
 * Create enhanced image from uploaded image using canvas
 * @param {string} uploadedImage - Base64 uploaded image
 * @param {string} enhancementPrompt - Enhancement instructions
 * @returns {string} - Enhanced base64 image
 */
function createEnhancedImageFromUpload(uploadedImage, enhancementPrompt) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log('🖼️ Image loaded, starting enhancement process...');
      console.log('📝 Enhancement prompt received:', enhancementPrompt);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Set canvas size
      canvas.width = AI_NFT_CONFIG.IMAGE_SIZE.width;
      canvas.height = AI_NFT_CONFIG.IMAGE_SIZE.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      console.log('📐 Canvas created and image drawn');
      
      // Apply enhancements based on prompt
      console.log('🎨 Calling applyImageEnhancements...');
      applyImageEnhancements(ctx, enhancementPrompt, canvas.width, canvas.height);
      
      // No automatic label - keep image clean
      
      // Convert to optimized base64
      const enhancedBase64 = canvas.toDataURL(
        `image/${AI_NFT_CONFIG.IMAGE_OPTIMIZATION.format}`,
        AI_NFT_CONFIG.IMAGE_OPTIMIZATION.quality
      );
      
      console.log('✅ Image enhancement completed successfully');
      resolve(enhancedBase64);
    };
    
    img.onerror = () => {
      console.warn('⚠️ Failed to load uploaded image, using original');
      resolve(uploadedImage);
    };
    
    img.src = uploadedImage;
  });
}

/**
 * Apply visual enhancements to canvas based on prompt
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} prompt - Enhancement prompt
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function applyImageEnhancements(ctx, prompt, width, height) {
  if (!prompt || !prompt.trim()) {
    console.log('📸 No enhancement prompt - applying basic optimization only');
    return;
  }
  
  const lowerPrompt = prompt.toLowerCase();
  console.log('🎨 Applying enhancements based on prompt:', prompt);
  
  let enhancementsApplied = 0;
  
  // Apply filters based on prompt keywords
  if (lowerPrompt.includes('artistic') || lowerPrompt.includes('painting') || lowerPrompt.includes('art')) {
    console.log('🎨 Applying artistic filter');
    applyArtisticFilter(ctx, width, height);
    enhancementsApplied++;
  }
  
  if (lowerPrompt.includes('fantasy') || lowerPrompt.includes('magical') || lowerPrompt.includes('magic')) {
    console.log('✨ Applying fantasy filter');
    applyFantasyFilter(ctx, width, height);
    enhancementsApplied++;
  }
  
  if (lowerPrompt.includes('vintage') || lowerPrompt.includes('retro') || lowerPrompt.includes('old')) {
    console.log('📸 Applying vintage filter');
    applyVintageFilter(ctx, width, height);
    enhancementsApplied++;
  }
  
  if (lowerPrompt.includes('bright') || lowerPrompt.includes('vibrant') || lowerPrompt.includes('colorful')) {
    console.log('☀️ Applying brightness filter');
    applyBrightnessFilter(ctx, width, height);
    enhancementsApplied++;
  }
  
  if (lowerPrompt.includes('dark') || lowerPrompt.includes('moody') || lowerPrompt.includes('shadow')) {
    console.log('🌙 Applying dark filter');
    applyDarkFilter(ctx, width, height);
    enhancementsApplied++;
  }
  
  if (lowerPrompt.includes('blur') || lowerPrompt.includes('soft') || lowerPrompt.includes('smooth')) {
    console.log('🌫️ Applying blur filter');
    applyBlurFilter(ctx, width, height);
    enhancementsApplied++;
  }
  
  if (enhancementsApplied === 0) {
    console.log('⚠️ No specific enhancements found, applying general improvement');
    applyGeneralEnhancement(ctx, width, height);
  } else {
    console.log(`✅ Applied ${enhancementsApplied} enhancement(s)`);
  }
  
  // Always apply a visible test enhancement to verify it's working
  console.log('🧪 Applying test enhancement (red tint) to verify processing...');
  applyTestEnhancement(ctx, width, height);
}

/**
 * Apply artistic filter to canvas
 */
function applyArtisticFilter(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Strong contrast and saturation boost for artistic effect
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.5 + 128));     // Red
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.3 + 128)); // Green
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.4 + 128)); // Blue
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply fantasy filter to canvas
 */
function applyFantasyFilter(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Strong magical glow effect
    data[i] = Math.min(255, data[i] + 40);     // Red
    data[i + 1] = Math.min(255, data[i + 1] + 20); // Green
    data[i + 2] = Math.min(255, data[i + 2] + 50); // Blue
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply vintage filter to canvas
 */
function applyVintageFilter(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply sepia-like effect
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply brightness filter to canvas
 */
function applyBrightnessFilter(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * 1.5);     // Red
    data[i + 1] = Math.min(255, data[i + 1] * 1.5); // Green
    data[i + 2] = Math.min(255, data[i + 2] * 1.5); // Blue
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply dark/moody filter to canvas
 */
function applyDarkFilter(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, data[i] * 0.7);     // Red
    data[i + 1] = Math.max(0, data[i + 1] * 0.7); // Green
    data[i + 2] = Math.max(0, data[i + 2] * 0.7); // Blue
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply blur filter to canvas
 */
function applyBlurFilter(ctx, width, height) {
  // Simple blur effect by averaging nearby pixels
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const blurredData = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Average with surrounding pixels
      let r = 0, g = 0, b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
          r += data[neighborIdx];
          g += data[neighborIdx + 1];
          b += data[neighborIdx + 2];
        }
      }
      
      blurredData[idx] = r / 9;
      blurredData[idx + 1] = g / 9;
      blurredData[idx + 2] = b / 9;
    }
  }
  
  const blurredImageData = new ImageData(blurredData, width, height);
  ctx.putImageData(blurredImageData, 0, 0);
}

/**
 * Apply general enhancement to canvas
 */
function applyGeneralEnhancement(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Slight contrast and saturation boost
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.1 + 128));     // Red
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.1 + 128)); // Green
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.1 + 128)); // Blue
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply test enhancement to verify processing is working
 */
function applyTestEnhancement(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Add a visible red tint to verify processing
    data[i] = Math.min(255, data[i] + 30);     // Red
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Optimize image size by compressing and resizing if needed
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<string>} - Optimized base64 image
 */
async function optimizeImageSize(base64Image) {
  try {
    if (!AI_NFT_CONFIG.IMAGE_OPTIMIZATION.enableCompression) {
      return base64Image;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to target dimensions
        canvas.width = AI_NFT_CONFIG.IMAGE_SIZE.width;
        canvas.height = AI_NFT_CONFIG.IMAGE_SIZE.height;
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to JPEG with quality compression
        const optimizedBase64 = canvas.toDataURL(
          `image/${AI_NFT_CONFIG.IMAGE_OPTIMIZATION.format}`,
          AI_NFT_CONFIG.IMAGE_OPTIMIZATION.quality
        );
        
        // Check file size
        const sizeInBytes = (optimizedBase64.length * 3) / 4;
        const sizeInKB = sizeInBytes / 1024;
        const sizeInMB = sizeInKB / 1024;
        
        console.log(`📊 Image optimization: ${sizeInKB.toFixed(1)}KB (${sizeInMB.toFixed(2)}MB)`);
        
        if (sizeInMB > 1) {
          console.warn(`⚠️ Large image (${sizeInMB.toFixed(2)}MB) - may upload slowly to Pinata`);
        }
        
        resolve(optimizedBase64);
      };
      
      img.onerror = () => {
        console.warn('⚠️ Image optimization failed, using original');
        resolve(base64Image);
      };
      
      img.src = base64Image;
    });
  } catch (error) {
    console.warn('⚠️ Image optimization error:', error);
    return base64Image;
  }
}

/**
 * Generate AI image using Google Studio API for enhanced prompts
 * @param {string} prompt - Text prompt for image generation
 * @param {string} uploadedImage - Optional uploaded image base64
 * @returns {Promise<string>} - Base64 encoded image data
 */
export async function generateAIImage(prompt, uploadedImage = null) {
  try {
    if (uploadedImage) {
      console.log('📸 Using uploaded image directly (no AI enhancement)');
      return uploadedImage;
    }
    
    // Check which AI provider to use
    const provider = AI_NFT_CONFIG.AI_PROVIDER || 'minimax';
    
    // Try MiniMax first (default, cheaper, better quotas)
    if (provider === 'minimax' || provider === 'auto') {
      try {
        return await generateWithMiniMax(prompt);
      } catch (minimaxError) {
        console.warn('⚠️ MiniMax API failed, trying Gemini...', minimaxError.message);
        // Fall through to Gemini
      }
    }
    
    // Try Gemini if MiniMax failed or provider is 'gemini'
    if (provider === 'gemini' || provider === 'auto') {
      console.log('🎨 Generating REAL AI image with Google Gemini Image Generation...');
      
      // Use Gemini 2.5 Flash Image model for REAL image generation
      console.log('🖼️ Using Gemini 2.5 Flash Image model...');
      const imageModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
      
      // Generate image directly from prompt
      const result = await imageModel.generateContent(prompt);
      
      console.log('✅ Response received from Gemini Image API');
      
      // Extract image from response
      if (result.response?.candidates?.[0]?.content?.parts) {
        const parts = result.response.candidates[0].content.parts;
        
        // Find the image part (inline_data)
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            
            console.log('✅ REAL AI IMAGE GENERATED with Gemini 2.5 Flash Image!');
            console.log('📊 Original image size:', imageData.length, 'chars');
            
            // Optimize image for smaller file size
            const optimizedImage = await optimizeImageSize(`data:${mimeType};base64,${imageData}`);
            console.log('📊 Optimized image size:', optimizedImage.length, 'chars');
            
            return optimizedImage;
          }
        }
      }
      
      console.warn('⚠️ No image found in Gemini response, falling back...');
      throw new Error('No image data in response');
    }
    
    // If no provider worked, throw error to trigger canvas fallback
    throw new Error('No AI provider available');
    
  } catch (error) {
    const errorMessage = error.message || '';
    const isQuotaError = errorMessage.includes('quota') || 
                        errorMessage.includes('429') || 
                        errorMessage.includes('rate limit') ||
                        errorMessage.includes('Quota exceeded');
    
    if (isQuotaError) {
      console.warn('⚠️ Gemini API quota exceeded. Using canvas-based image generation...');
      console.log('💡 Tip: Upgrade your Gemini API plan or wait for quota reset');
      // Direct fallback to canvas - don't try text model if quota is exceeded
      return createEnhancedVisualImage(prompt, prompt);
    }
    
    console.error('❌ Error generating with Gemini Image:', error.message);
    console.log('🔄 Falling back to enhanced canvas visualization...');
    
    // Fallback: Try text model to enhance prompt, then canvas
    try {
      const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const enhancedPromptResult = await textModel.generateContent(
        `Transform this short prompt into a detailed, professional art description: "${prompt}"

        Requirements:
        - Make it at least 50 words long
        - Include specific visual elements, composition, and perspective
        - Add detailed color palette, lighting, and mood
        - Specify artistic style (photorealistic, digital art, oil painting, etc.)
        - Include textures, materials, and environmental details
        - Make it vivid and descriptive for AI image generation
        
        Respond ONLY with the enhanced description in English.`
      );
      const enhancedPrompt = enhancedPromptResult.response.text().trim();
      console.log('✨ Enhanced with text model:', enhancedPrompt.substring(0, 100) + '...');
      return createEnhancedVisualImage(prompt, enhancedPrompt);
    } catch (fallbackError) {
      const fallbackErrorMessage = fallbackError.message || '';
      const isFallbackQuotaError = fallbackErrorMessage.includes('quota') || 
                                   fallbackErrorMessage.includes('429') || 
                                   fallbackErrorMessage.includes('rate limit');
      
      if (isFallbackQuotaError) {
        console.warn('⚠️ Text model also quota exceeded. Using basic canvas generation...');
      } else {
        console.error('❌ Fallback also failed:', fallbackError.message);
      }
      return createEnhancedVisualImage(prompt, prompt);
    }
  }
}

/**
 * Create an enhanced visual image based on the prompt
 * @param {string} originalPrompt - Original user prompt
 * @param {string} enhancedPrompt - AI-enhanced prompt
 * @returns {string} - Base64 encoded image
 */
function createEnhancedVisualImage(originalPrompt, enhancedPrompt) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = AI_NFT_CONFIG.IMAGE_SIZE.width;
  canvas.height = AI_NFT_CONFIG.IMAGE_SIZE.height;
  
  // Analyze prompt for colors and style
  const colors = extractColorsFromPrompt(enhancedPrompt);
  const style = extractStyleFromPrompt(enhancedPrompt);
  
  // Create dynamic background based on prompt
  createDynamicBackground(ctx, colors, style);
  
  // Add visual elements based on prompt content
  addVisualElements(ctx, enhancedPrompt, colors);
  
  // Add artistic text representation
  addArtisticText(ctx, originalPrompt, colors);
  
      // No automatic label - keep image clean
  
  // Convert to base64 (keep the data:image/png;base64, prefix for <img> tag)
  return canvas.toDataURL('image/png');
}

/**
 * Extract colors from prompt text
 * @param {string} prompt - Enhanced prompt
 * @returns {Array} - Array of color objects
 */
function extractColorsFromPrompt(prompt) {
  const colorKeywords = {
    'red': '#ef4444', 'blue': '#3b82f6', 'green': '#10b981', 'yellow': '#f59e0b',
    'purple': '#8b5cf6', 'pink': '#ec4899', 'orange': '#f97316', 'black': '#1f2937',
    'white': '#ffffff', 'gray': '#6b7280', 'brown': '#92400e', 'gold': '#fbbf24',
    'silver': '#9ca3af', 'cyan': '#06b6d4', 'magenta': '#d946ef', 'lime': '#84cc16'
  };
  
  const colors = [];
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [color, hex] of Object.entries(colorKeywords)) {
    if (lowerPrompt.includes(color)) {
      colors.push({ name: color, hex: hex });
    }
  }
  
  // Default colors if none found
  if (colors.length === 0) {
    colors.push(
      { name: 'blue', hex: '#3b82f6' },
      { name: 'purple', hex: '#8b5cf6' },
      { name: 'pink', hex: '#ec4899' }
    );
  }
  
  return colors;
}

/**
 * Extract style from prompt text
 * @param {string} prompt - Enhanced prompt
 * @returns {string} - Style type
 */
function extractStyleFromPrompt(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('abstract') || lowerPrompt.includes('modern')) return 'abstract';
  if (lowerPrompt.includes('realistic') || lowerPrompt.includes('photorealistic')) return 'realistic';
  if (lowerPrompt.includes('cartoon') || lowerPrompt.includes('anime')) return 'cartoon';
  if (lowerPrompt.includes('vintage') || lowerPrompt.includes('retro')) return 'vintage';
  if (lowerPrompt.includes('minimalist') || lowerPrompt.includes('simple')) return 'minimalist';
  
  return 'artistic';
}

/**
 * Create dynamic background based on colors and style
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} colors - Color array
 * @param {string} style - Style type
 */
function createDynamicBackground(ctx, colors, style) {
  const width = AI_NFT_CONFIG.IMAGE_SIZE.width;
  const height = AI_NFT_CONFIG.IMAGE_SIZE.height;
  
  switch (style) {
    case 'abstract':
      createAbstractBackground(ctx, colors, width, height);
      break;
    case 'realistic':
      createRealisticBackground(ctx, colors, width, height);
      break;
    case 'cartoon':
      createCartoonBackground(ctx, colors, width, height);
      break;
    case 'vintage':
      createVintageBackground(ctx, colors, width, height);
      break;
    case 'minimalist':
      createMinimalistBackground(ctx, colors, width, height);
      break;
    default:
      createArtisticBackground(ctx, colors, width, height);
  }
}

/**
 * Create abstract background
 */
function createAbstractBackground(ctx, colors, width, height) {
  // Create multiple gradient layers
  for (let i = 0; i < 3; i++) {
    const gradient = ctx.createRadialGradient(
      Math.random() * width, Math.random() * height, 0,
      Math.random() * width, Math.random() * height, Math.random() * 300 + 100
    );
    
    gradient.addColorStop(0, colors[i % colors.length].hex + '80');
    gradient.addColorStop(1, colors[(i + 1) % colors.length].hex + '20');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  // Add abstract shapes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 50 + 10,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

/**
 * Create artistic background
 */
function createArtisticBackground(ctx, colors, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors[0].hex);
  gradient.addColorStop(0.5, colors[1 % colors.length].hex);
  gradient.addColorStop(1, colors[2 % colors.length].hex);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add artistic elements
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 15 + 5;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Create other background styles (simplified for now)
 */
function createRealisticBackground(ctx, colors, width, height) {
  createArtisticBackground(ctx, colors, width, height);
}

function createCartoonBackground(ctx, colors, width, height) {
  createArtisticBackground(ctx, colors, width, height);
}

function createVintageBackground(ctx, colors, width, height) {
  createArtisticBackground(ctx, colors, width, height);
}

function createMinimalistBackground(ctx, colors, width, height) {
  createArtisticBackground(ctx, colors, width, height);
}

/**
 * Add visual elements based on prompt content
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} prompt - Enhanced prompt
 * @param {Array} colors - Color array
 */
function addVisualElements(ctx, prompt, colors) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Add specific animals
  if (lowerPrompt.includes('kunduz') || lowerPrompt.includes('beaver')) {
    addBeaver(ctx, colors);
  } else if (lowerPrompt.includes('kedi') || lowerPrompt.includes('cat')) {
    addCat(ctx, colors);
  } else if (lowerPrompt.includes('köpek') || lowerPrompt.includes('dog')) {
    addDog(ctx, colors);
  } else if (lowerPrompt.includes('kuş') || lowerPrompt.includes('bird')) {
    addBird(ctx, colors);
  } else if (lowerPrompt.includes('balık') || lowerPrompt.includes('fish')) {
    addFish(ctx, colors);
  }
  
  // Add stars if space/cosmic theme
  if (lowerPrompt.includes('space') || lowerPrompt.includes('star') || lowerPrompt.includes('cosmic')) {
    addStars(ctx);
  }
  
  // Add geometric shapes if geometric theme
  if (lowerPrompt.includes('geometric') || lowerPrompt.includes('shape') || lowerPrompt.includes('triangle')) {
    addGeometricShapes(ctx, colors);
  }
  
  // Add nature elements
  if (lowerPrompt.includes('nature') || lowerPrompt.includes('tree') || lowerPrompt.includes('flower')) {
    addNatureElements(ctx, colors);
  }
  
  // Add buildings/architecture
  if (lowerPrompt.includes('ev') || lowerPrompt.includes('house') || lowerPrompt.includes('bina') || lowerPrompt.includes('building')) {
    addBuilding(ctx, colors);
  }
  
  // Add vehicles
  if (lowerPrompt.includes('araba') || lowerPrompt.includes('car') || lowerPrompt.includes('araç') || lowerPrompt.includes('vehicle')) {
    addCar(ctx, colors);
  }
}

/**
 * Add stars to the canvas
 */
function addStars(ctx) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.width;
    const y = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.height;
    const size = Math.random() * 3 + 1;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Add geometric shapes
 */
function addGeometricShapes(ctx, colors) {
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.width;
    const y = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.height;
    const size = Math.random() * 30 + 10;
    const color = colors[Math.floor(Math.random() * colors.length)].hex + '60';
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(x - size/2, y - size/2, size, size);
    ctx.fill();
  }
}

/**
 * Add nature elements
 */
function addNatureElements(ctx, colors) {
  // Simple tree representation
  ctx.fillStyle = colors[1 % colors.length].hex + '80';
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.width;
    const y = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.height;
    
    // Tree trunk
    ctx.fillRect(x - 5, y, 10, 30);
    // Tree top
    ctx.beginPath();
    ctx.arc(x, y - 10, 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Add realistic beaver drawing
 */
function addBeaver(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Create realistic water/pond background first
  createRealisticWater(ctx, centerX, centerY);
  
  // Beaver body with realistic fur texture
  ctx.fillStyle = '#5D4037'; // Darker brown base
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 10, 70, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Add fur texture to body
  addFurTexture(ctx, centerX, centerY + 10, 70, 45, '#6D4C41', '#4E342E');
  
  // Beaver head with more realistic proportions
  ctx.fillStyle = '#5D4037';
  ctx.beginPath();
  ctx.ellipse(centerX - 25, centerY - 15, 40, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Add fur texture to head
  addFurTexture(ctx, centerX - 25, centerY - 15, 40, 35, '#6D4C41', '#4E342E');
  
  // Beaver snout (more prominent)
  ctx.fillStyle = '#4E342E';
  ctx.beginPath();
  ctx.ellipse(centerX - 45, centerY - 10, 20, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Realistic beaver eyes with depth
  // Eye sockets
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.arc(centerX - 35, centerY - 20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 20, centerY - 20, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes with highlights
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 35, centerY - 20, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 20, centerY - 20, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Eye highlights
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(centerX - 36, centerY - 21, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 21, centerY - 21, 1.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Realistic beaver nose
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.arc(centerX - 50, centerY - 8, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Nostrils
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 51, centerY - 9, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 49, centerY - 9, 1, 0, Math.PI * 2);
  ctx.fill();
  
  // Realistic beaver teeth (more prominent and detailed)
  ctx.fillStyle = '#F5F5F5';
  // Left tooth
  ctx.beginPath();
  ctx.moveTo(centerX - 48, centerY - 5);
  ctx.lineTo(centerX - 45, centerY - 8);
  ctx.lineTo(centerX - 45, centerY + 2);
  ctx.lineTo(centerX - 48, centerY + 5);
  ctx.closePath();
  ctx.fill();
  
  // Right tooth
  ctx.beginPath();
  ctx.moveTo(centerX - 44, centerY - 5);
  ctx.lineTo(centerX - 41, centerY - 8);
  ctx.lineTo(centerX - 41, centerY + 2);
  ctx.lineTo(centerX - 44, centerY + 5);
  ctx.closePath();
  ctx.fill();
  
  // Tooth details
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 46.5, centerY - 6.5);
  ctx.lineTo(centerX - 46.5, centerY + 3.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX - 42.5, centerY - 6.5);
  ctx.lineTo(centerX - 42.5, centerY + 3.5);
  ctx.stroke();
  
  // Beaver ears (small and rounded)
  ctx.fillStyle = '#4E342E';
  ctx.beginPath();
  ctx.arc(centerX - 35, centerY - 35, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 15, centerY - 35, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner ears
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.arc(centerX - 35, centerY - 35, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 15, centerY - 35, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Realistic beaver tail (flat, wide, and textured)
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.ellipse(centerX + 60, centerY + 5, 35, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Tail texture (scales pattern)
  addTailTexture(ctx, centerX + 60, centerY + 5, 35, 20);
  
  // Beaver legs/paws
  ctx.fillStyle = '#4E342E';
  // Front left paw
  ctx.beginPath();
  ctx.ellipse(centerX - 20, centerY + 40, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Front right paw
  ctx.beginPath();
  ctx.ellipse(centerX - 5, centerY + 40, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Back left paw
  ctx.beginPath();
  ctx.ellipse(centerX + 15, centerY + 45, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Back right paw
  ctx.beginPath();
  ctx.ellipse(centerX + 35, centerY + 45, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Claws on paws
  ctx.fillStyle = '#2E2E2E';
  for (let i = 0; i < 3; i++) {
    // Front paws claws
    ctx.beginPath();
    ctx.arc(centerX - 20 + i * 3, centerY + 45, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX - 5 + i * 3, centerY + 45, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Back paws claws
    ctx.beginPath();
    ctx.arc(centerX + 15 + i * 4, centerY + 50, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + 35 + i * 4, centerY + 50, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add some water ripples around the beaver
  addWaterRipples(ctx, centerX, centerY);
  
  // Add some grass/reeds in the water
  addWaterPlants(ctx, centerX, centerY);
}

/**
 * Create realistic water background
 */
function createRealisticWater(ctx, centerX, centerY) {
  // Water base
  const waterGradient = ctx.createLinearGradient(0, centerY - 50, 0, centerY + 100);
  waterGradient.addColorStop(0, '#87CEEB');
  waterGradient.addColorStop(0.3, '#4682B4');
  waterGradient.addColorStop(0.7, '#2E8B57');
  waterGradient.addColorStop(1, '#1E3A8A');
  
  ctx.fillStyle = waterGradient;
  ctx.fillRect(0, centerY - 50, AI_NFT_CONFIG.IMAGE_SIZE.width, AI_NFT_CONFIG.IMAGE_SIZE.height - centerY + 50);
  
  // Water reflections
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * AI_NFT_CONFIG.IMAGE_SIZE.width;
    const y = centerY + Math.random() * 50;
    const width = Math.random() * 100 + 20;
    const height = Math.random() * 3 + 1;
    ctx.fillRect(x, y, width, height);
  }
}

/**
 * Add fur texture to beaver
 */
function addFurTexture(ctx, centerX, centerY, width, height, lightColor, darkColor) {
  for (let i = 0; i < 50; i++) {
    const x = centerX + (Math.random() - 0.5) * width;
    const y = centerY + (Math.random() - 0.5) * height;
    const length = Math.random() * 8 + 3;
    const angle = Math.random() * Math.PI * 2;
    
    ctx.strokeStyle = Math.random() > 0.5 ? lightColor : darkColor;
    ctx.lineWidth = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
}

/**
 * Add tail texture (scales pattern)
 */
function addTailTexture(ctx, centerX, centerY, width, height) {
  ctx.strokeStyle = '#2E2E2E';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 5; j++) {
      const x = centerX - width/2 + i * (width/7);
      const y = centerY - height/2 + j * (height/4);
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + width/7, y);
      ctx.lineTo(x + width/14, y + height/4);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

/**
 * Add water ripples
 */
function addWaterRipples(ctx, centerX, centerY) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < 5; i++) {
    const radius = 30 + i * 15;
    ctx.beginPath();
    ctx.arc(centerX + 20, centerY + 30, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Add water plants (grass/reeds)
 */
function addWaterPlants(ctx, centerX, centerY) {
  ctx.strokeStyle = '#228B22';
  ctx.lineWidth = 2;
  
  for (let i = 0; i < 10; i++) {
    const x = centerX - 100 + Math.random() * 200;
    const y = centerY + 20 + Math.random() * 30;
    const height = Math.random() * 20 + 10;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 4 - 2, y - height);
    ctx.stroke();
  }
}

/**
 * Add cat drawing
 */
function addCat(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Cat body
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 50, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Cat head
  ctx.fillStyle = '#FF8C00';
  ctx.beginPath();
  ctx.ellipse(centerX - 30, centerY - 25, 30, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Cat ears
  ctx.fillStyle = '#FF8C00';
  ctx.beginPath();
  ctx.moveTo(centerX - 45, centerY - 40);
  ctx.lineTo(centerX - 35, centerY - 50);
  ctx.lineTo(centerX - 25, centerY - 40);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(centerX - 20, centerY - 40);
  ctx.lineTo(centerX - 10, centerY - 50);
  ctx.lineTo(centerX, centerY - 40);
  ctx.closePath();
  ctx.fill();
  
  // Cat eyes
  ctx.fillStyle = '#00FF00';
  ctx.beginPath();
  ctx.arc(centerX - 35, centerY - 30, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 20, centerY - 30, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Cat nose
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath();
  ctx.moveTo(centerX - 27, centerY - 20);
  ctx.lineTo(centerX - 25, centerY - 15);
  ctx.lineTo(centerX - 23, centerY - 20);
  ctx.closePath();
  ctx.fill();
  
  // Cat tail
  ctx.strokeStyle = '#FF8C00';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(centerX + 50, centerY);
  ctx.quadraticCurveTo(centerX + 70, centerY - 20, centerX + 80, centerY + 10);
  ctx.stroke();
}

/**
 * Add dog drawing
 */
function addDog(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Dog body
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 55, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Dog head
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.ellipse(centerX - 35, centerY - 20, 30, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Dog ears (floppy)
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(centerX - 45, centerY - 30, 8, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX - 20, centerY - 30, 8, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Dog eyes
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 40, centerY - 25, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 25, centerY - 25, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Dog nose
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 32, centerY - 15, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Dog tail (wagging)
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(centerX + 55, centerY);
  ctx.quadraticCurveTo(centerX + 75, centerY - 15, centerX + 85, centerY + 5);
  ctx.stroke();
}

/**
 * Add bird drawing
 */
function addBird(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Bird body
  ctx.fillStyle = '#4169E1';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 25, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Bird head
  ctx.fillStyle = '#1E90FF';
  ctx.beginPath();
  ctx.arc(centerX - 20, centerY - 10, 12, 0, Math.PI * 2);
  ctx.fill();
  
  // Bird beak
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(centerX - 30, centerY - 10);
  ctx.lineTo(centerX - 35, centerY - 8);
  ctx.lineTo(centerX - 30, centerY - 6);
  ctx.closePath();
  ctx.fill();
  
  // Bird wings
  ctx.fillStyle = '#0000CD';
  ctx.beginPath();
  ctx.ellipse(centerX - 5, centerY - 5, 20, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX - 5, centerY + 5, 20, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Bird eyes
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 25, centerY - 12, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Add fish drawing
 */
function addFish(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Fish body
  ctx.fillStyle = '#FF6347';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 40, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Fish tail
  ctx.fillStyle = '#FF4500';
  ctx.beginPath();
  ctx.moveTo(centerX + 40, centerY);
  ctx.lineTo(centerX + 60, centerY - 15);
  ctx.lineTo(centerX + 60, centerY + 15);
  ctx.closePath();
  ctx.fill();
  
  // Fish fins
  ctx.fillStyle = '#FF4500';
  ctx.beginPath();
  ctx.ellipse(centerX - 10, centerY - 20, 8, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX - 10, centerY + 20, 8, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Fish eye
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(centerX - 15, centerY - 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 15, centerY - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Fish stripes
  ctx.strokeStyle = '#FF4500';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(centerX - 20 + i * 15, centerY - 20);
    ctx.lineTo(centerX - 20 + i * 15, centerY + 20);
    ctx.stroke();
  }
}

/**
 * Add building drawing
 */
function addBuilding(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Building base
  ctx.fillStyle = '#708090';
  ctx.fillRect(centerX - 40, centerY - 20, 80, 60);
  
  // Building roof
  ctx.fillStyle = '#8B0000';
  ctx.beginPath();
  ctx.moveTo(centerX - 50, centerY - 20);
  ctx.lineTo(centerX, centerY - 40);
  ctx.lineTo(centerX + 50, centerY - 20);
  ctx.closePath();
  ctx.fill();
  
  // Windows
  ctx.fillStyle = '#87CEEB';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillRect(centerX - 30 + i * 20, centerY - 10 + j * 15, 12, 10);
    }
  }
  
  // Door
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(centerX - 8, centerY + 20, 16, 20);
}

/**
 * Add car drawing
 */
function addCar(ctx, colors) {
  const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
  const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
  
  // Car body
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(centerX - 50, centerY - 15, 100, 30);
  
  // Car roof
  ctx.fillStyle = '#CC0000';
  ctx.fillRect(centerX - 30, centerY - 25, 60, 15);
  
  // Car wheels
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 35, centerY + 15, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 35, centerY + 15, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Car windows
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(centerX - 25, centerY - 20, 20, 10);
  ctx.fillRect(centerX + 5, centerY - 20, 20, 10);
  
  // Car headlights
  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.arc(centerX - 50, centerY - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX - 50, centerY + 5, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Add artistic text representation (minimal, only for non-visual prompts)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} prompt - Original prompt
 * @param {Array} colors - Color array
 */
function addArtisticText(ctx, prompt, colors) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Only add text if no specific visual elements were added
  const hasVisualElements = 
    lowerPrompt.includes('kunduz') || lowerPrompt.includes('beaver') ||
    lowerPrompt.includes('kedi') || lowerPrompt.includes('cat') ||
    lowerPrompt.includes('köpek') || lowerPrompt.includes('dog') ||
    lowerPrompt.includes('kuş') || lowerPrompt.includes('bird') ||
    lowerPrompt.includes('balık') || lowerPrompt.includes('fish') ||
    lowerPrompt.includes('ev') || lowerPrompt.includes('house') ||
    lowerPrompt.includes('araba') || lowerPrompt.includes('car') ||
    lowerPrompt.includes('space') || lowerPrompt.includes('star') ||
    lowerPrompt.includes('geometric') || lowerPrompt.includes('shape') ||
    lowerPrompt.includes('nature') || lowerPrompt.includes('tree');
  
  if (!hasVisualElements) {
    // Create a subtle text representation only for abstract prompts
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Split prompt into words and create artistic arrangement
    const words = prompt.split(' ').slice(0, 2); // Take first 2 words
    const centerX = AI_NFT_CONFIG.IMAGE_SIZE.width / 2;
    const centerY = AI_NFT_CONFIG.IMAGE_SIZE.height / 2;
    
    words.forEach((word, index) => {
      const angle = (index - 0.5) * 0.2; // Slight angle variation
      const x = centerX + Math.sin(angle) * 15;
      const y = centerY + (index - 0.5) * 20;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(word, 0, 0);
      ctx.restore();
    });
  }
}

/**
 * Convert base64 image to blob for IPFS upload
 * @param {string} base64Data - Base64 encoded image
 * @returns {Blob} - Image blob
 */
export function base64ToBlob(base64Data) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
}
