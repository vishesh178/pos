const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '../../uploads/products');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * GET /api/ai/status
 * Check if Gemini API key is configured and verify connectivity
 */
router.get('/status', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return res.json({
      configured: false,
      message: 'Gemini API key is not configured in .env'
    });
  }

  try {
    const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
    });
    const testData = await testRes.json();
    const isValid = !!testData.candidates;

    res.json({
      configured: true,
      valid: isValid,
      keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
      status: isValid ? 'CONNECTED' : (testData.error?.message || 'ERROR')
    });
  } catch (err) {
    res.json({
      configured: true,
      valid: false,
      error: err.message
    });
  }
});

/**
 * Helper to generate prompt based on product category & name
 */
function buildMockupPrompt(product) {
  const name = product.name || '';
  const cat = (product.category?.name || product.category || '').toUpperCase();

  let context = 'placed elegantly in a luxury minimalist showroom setting';
  if (cat.includes('SHOWPIC') || cat.includes('SCULPTURE') || name.startsWith('SHP')) {
    context = 'a luxury artistic sculpture placed on an Italian marble console table against a warm neutral wall in an architectural interior';
  } else if (cat.includes('CLOCK') || name.startsWith('WC')) {
    context = 'a designer statement luxury wall clock mounted on a modern textured living room accent wall with warm gallery lighting';
  } else if (cat.includes('WALL') || cat.includes('PIC') || cat.includes('FRAME') || name.startsWith('WP') || name.startsWith('FP')) {
    context = 'a high-end framed luxury artwork hanging on an off-white gallery wall in a minimalist living room above a designer credenza';
  } else if (cat.includes('POT') || cat.includes('PLANTER') || cat.includes('FLOWER')) {
    context = 'a designer decorative pot with lush botanicals placed on a marble coffee table in a penthouse living room';
  }

  return `Photorealistic luxury interior mockup of home decor piece "${name}". The item is ${context}. Soft warm cinematic lighting, high-end interior design catalog aesthetic, 1:1 square aspect ratio, ultra-detailed, professional photography, clean background, no text on image.`;
}

/**
 * POST /api/ai/generate-mockup
 * Generate a luxury mockup for a single product using Gemini API
 */
router.post('/generate-mockup', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is not configured.' });
  }

  const { productId, customPrompt } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'productId is required.' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId, 10) },
      include: { category: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const promptText = customPrompt || buildMockupPrompt(product);

    // List of Gemini Image generation models to try in order of preference
    const candidateModels = [
      'gemini-3.1-flash-image',
      'gemini-2.5-flash-image',
      'gemini-3-pro-image'
    ];

    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    let lastError = null;

    for (const model of candidateModels) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              mimeType = part.inlineData.mimeType || 'image/jpeg';
              break;
            }
          }
        }

        if (imageBuffer) break;

        if (data.error) {
          lastError = data.error.message;
          // If rate limit / billing error, record it
          if (data.error.code === 429) {
            lastError = 'Google AI Studio rate limit or billing required for image generation. Please enable Pay-As-You-Go in Google AI Studio (aistudio.google.com).';
          }
        }
      } catch (callErr) {
        lastError = callErr.message;
      }
    }

    if (!imageBuffer) {
      return res.status(400).json({
        error: lastError || 'Failed to generate image with Gemini API. Check your model quota in Google AI Studio.',
        promptUsed: promptText
      });
    }

    // Save image to /uploads/products/
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const safeSku = (product.sku || `p${product.id}`).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `mockup-${safeSku}-${Date.now().toString(36)}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, imageBuffer);
    const imageUrl = `/uploads/products/${fileName}`;

    // Update product in SQLite
    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: { imageUrl }
    });

    res.json({
      success: true,
      imageUrl,
      product: updatedProduct,
      promptUsed: promptText
    });
  } catch (err) {
    console.error('Error generating AI mockup:', err);
    res.status(500).json({ error: err.message || 'Server error while generating mockup.' });
  }
});

module.exports = router;
