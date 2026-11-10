const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');

/**
 * Resolve an image source into a Buffer if possible
 */
async function resolveImageBuffer(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  // 1. Try local disk paths
  if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
    const cleanRel = imageUrl.replace(/^\/?uploads\//, '');
    const possiblePaths = [
      path.resolve(__dirname, '../../uploads', cleanRel),
      path.resolve(__dirname, '../../../uploads', cleanRel),
      path.resolve(__dirname, '../../uploads/products', cleanRel),
      path.resolve(__dirname, '../../../uploads/products', cleanRel),
      path.resolve(process.cwd(), 'uploads', cleanRel),
      path.resolve(process.cwd(), 'server/uploads', cleanRel),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          return fs.readFileSync(p);
        } catch (_) {}
      }
    }
  }

  // 2. If it's an absolute disk path
  if (path.isAbsolute(imageUrl) && fs.existsSync(imageUrl)) {
    try {
      return fs.readFileSync(imageUrl);
    } catch (_) {}
  }

  // 3. If it's a remote URL
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const resp = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 4000,
        headers: { 'User-Agent': 'CuratedArt-CatalogGenerator/1.0' },
      });
      if (resp.status === 200 && resp.data) {
        return Buffer.from(resp.data);
      }
    } catch (_) {
      // Remote fetch failed or timed out - graceful fallback
    }
  }

  return null;
}

/**
 * Extract dimension string from item name (e.g. "12 x 18 in", "25x30 cm")
 */
function extractDimensions(name) {
  if (!name) return '';
  const match = name.match(
    /\b(\d+(?:\.\d+)?\s*[x*×]\s*\d+(?:\.\d+)?(?:\s*[x*×]\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|in|inch|inches|ft)?)\b/i
  );
  return match ? match[1].toUpperCase() : '';
}

/**
 * Get effective price from item based on priceType
 */
function resolvePrice(item, priceType = 'mrp') {
  if (priceType === 'wholesalePrice' && item.wholesalePrice) {
    return item.wholesalePrice;
  }
  if (priceType === 'sellingPrice' && item.sellingPrice) {
    return item.sellingPrice;
  }
  return item.mrp || item.sellingPrice || item.wholesalePrice || 0;
}

/**
 * Format currency amount cleanly with Indian commas
 */
function formatRupees(amount) {
  const num = Math.round(Number(amount) || 0);
  return 'Rs.' + num.toLocaleString('en-IN') + '/-';
}

/**
 * Generate a PDF Buffer for product catalogs
 *
 * @param {Array} products - List of product objects
 * @param {Object} options - Options: { gridCols: 1|2|3, priceType: 'mrp'|'sellingPrice'|'wholesalePrice', minimalist: boolean, showSku: boolean, showBusinessHeader: boolean }
 * @param {Object} biz - Business profile details
 * @returns {Promise<Buffer>}
 */
async function generateCatalogPdf(products = [], options = {}, biz = {}) {
  const {
    gridCols = 1,
    priceType = 'mrp',
    minimalist = false,
    showSku = true,
    showBusinessHeader = true,
  } = options;

  const businessName = biz.businessName || 'Curated Art';
  const address = biz.address || 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054';
  const phone = biz.phone || '+91 98765 43210';
  const email = biz.email || 'contact@curatedart.in';
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Pre-load image buffers in parallel (max 10 concurrent to prevent memory overload)
  const imageBuffers = await Promise.all(
    products.map(async (p) => {
      try {
        return await resolveImageBuffer(p.imageUrl);
      } catch (_) {
        return null;
      }
    })
  );

  return new Promise((resolve, reject) => {
    try {
      const isLookbook = Number(gridCols) === 1;

      const doc = new PDFDocument({
        size: isLookbook ? [595, 646] : 'A4',
        margin: isLookbook ? 0 : 36,
        autoFirstPage: false,
        info: {
          Title: `${businessName} Catalog`,
          Author: businessName,
          Subject: 'Product Catalog',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (isLookbook) {
        // --- 1 PRODUCT PER SLIDE (595 x 646 pt) ---
        // Matches mobile WhatsApp Lookbook format
        const pageWidth = 595;
        const pageHeight = 646;
        const imageAreaHeight = 560;
        const footerHeight = pageHeight - imageAreaHeight; // 86 pt

        if (products.length === 0) {
          doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });
          doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');
          doc.font('Helvetica-Bold').fontSize(16).fillColor('#78716c');
          doc.text('No products selected for catalog.', 0, pageHeight / 2 - 20, {
            align: 'center',
            width: pageWidth,
          });
        } else {
          products.forEach((item, idx) => {
            doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });

            // 1. Page Background
            doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');

            // 2. Photo Area (0 to imageAreaHeight)
            const imgBuffer = imageBuffers[idx];
            let imageDrawn = false;
            if (imgBuffer) {
              try {
                // Fit nicely inside the 595 x 560 zone, centered
                doc.image(imgBuffer, 0, 0, {
                  fit: [pageWidth, imageAreaHeight],
                  align: 'center',
                  valign: 'center',
                });
                imageDrawn = true;
              } catch (_) {
                imageDrawn = false;
              }
            }

            if (!imageDrawn) {
              doc.rect(0, 0, pageWidth, imageAreaHeight).fill('#f5f5f4');
              doc.font('Helvetica-Bold').fontSize(14).fillColor('#a8a29e');
              doc.text('PHOTO NOT AVAILABLE', 0, imageAreaHeight / 2 - 10, {
                align: 'center',
                width: pageWidth,
              });
            }

            // 3. Subtle separator line
            doc.strokeColor('#e7e5e4').lineWidth(1)
              .moveTo(0, imageAreaHeight).lineTo(pageWidth, imageAreaHeight).stroke();

            // 4. White footer card
            doc.rect(0, imageAreaHeight + 1, pageWidth, footerHeight - 1).fill('#ffffff');

            const price = resolvePrice(item, priceType);
            const dimText = extractDimensions(item.name);
            const categoryName = item.category?.name || item.category || 'Artifact';
            const skuText = item.sku || item.name || '';

            if (minimalist) {
              // Minimalist slide layout: SKU on left, Price on right
              doc.font('Helvetica-Bold').fontSize(15).fillColor('#1c1917');
              doc.text(skuText, 24, imageAreaHeight + 30, { width: 320 });

              doc.font('Helvetica-Bold').fontSize(16).fillColor('#1c1917');
              doc.text(formatRupees(price), 340, imageAreaHeight + 28, {
                align: 'right',
                width: pageWidth - 340 - 24,
              });
            } else {
              // Standard Lookbook layout:
              // Line 1: SKU on left, Dimensions on right
              doc.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917');
              doc.text(skuText, 24, imageAreaHeight + 16, { width: 330 });

              if (dimText) {
                doc.font('Helvetica-Bold').fontSize(12).fillColor('#44403c');
                doc.text(dimText, 350, imageAreaHeight + 18, {
                  align: 'right',
                  width: pageWidth - 350 - 24,
                });
              }

              // Line 2: Category on left, Price on right
              doc.font('Helvetica').fontSize(12).fillColor('#78716c');
              doc.text(categoryName, 24, imageAreaHeight + 46, { width: 330 });

              doc.font('Helvetica-Bold').fontSize(15).fillColor('#1c1917');
              doc.text(formatRupees(price), 350, imageAreaHeight + 43, {
                align: 'right',
                width: pageWidth - 350 - 24,
              });
            }
          });
        }
      } else {
        // --- MULTI-COLUMN A4 LAYOUT (gridCols: 2 or 3) ---
        const cols = Number(gridCols) === 3 ? 3 : 2;
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 36;
        const contentWidth = pageWidth - margin * 2; // 523.28 pt

        const gap = cols === 3 ? 12 : 16;
        const colWidth = (contentWidth - gap * (cols - 1)) / cols;
        const cardHeight = cols === 3 ? 220 : 290;
        const imageHeight = cols === 3 ? 135 : 195;

        let cursorY = margin;
        let colIndex = 0;

        const startNewPage = (isFirst = false) => {
          doc.addPage({ size: 'A4', margin });
          cursorY = margin;
          colIndex = 0;

          if (isFirst && showBusinessHeader) {
            // Render Luxury Brand Header
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#b45309');
            doc.text(businessName.toUpperCase(), margin, cursorY);
            cursorY += 22;

            doc.font('Helvetica').fontSize(9).fillColor('#44403c');
            doc.text(address, margin, cursorY);
            cursorY += 12;

            doc.font('Helvetica').fontSize(8).fillColor('#78716c');
            doc.text(`Ph: ${phone}  •  ${email}`, margin, cursorY);

            // Right header badge
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#b45309');
            doc.text('PRODUCT CATALOG', margin + contentWidth - 140, margin, {
              align: 'right',
              width: 140,
            });

            doc.font('Helvetica-Bold').fontSize(9).fillColor('#1c1917');
            doc.text(todayFormatted, margin + contentWidth - 140, margin + 14, {
              align: 'right',
              width: 140,
            });

            doc.font('Helvetica').fontSize(8).fillColor('#78716c');
            doc.text(`${products.length} Selected Pieces`, margin + contentWidth - 140, margin + 27, {
              align: 'right',
              width: 140,
            });

            cursorY += 10;
            doc.strokeColor('#b45309').lineWidth(1.5)
              .moveTo(margin, cursorY).lineTo(margin + contentWidth, cursorY).stroke();
            cursorY += 16;
          }
        };

        startNewPage(true);

        if (products.length === 0) {
          doc.font('Helvetica').fontSize(12).fillColor('#78716c');
          doc.text('No products selected for catalog.', margin, cursorY + 40, {
            align: 'center',
            width: contentWidth,
          });
        } else {
          products.forEach((item, idx) => {
            // Check if card fits on current page
            if (cursorY + cardHeight > pageHeight - margin) {
              startNewPage(false);
            }

            const cardX = margin + colIndex * (colWidth + gap);
            const cardY = cursorY;

            // Card border & background
            doc.roundedRect(cardX, cardY, colWidth, cardHeight, 6)
              .lineWidth(0.8).strokeColor('#e7e5e4').fillAndStroke('#ffffff', '#e7e5e4');

            // Draw product photo
            const imgBuffer = imageBuffers[idx];
            let imageDrawn = false;
            const imgPad = 6;
            const imgTargetW = colWidth - imgPad * 2;
            const imgTargetH = imageHeight - imgPad * 2;

            if (imgBuffer) {
              try {
                doc.image(imgBuffer, cardX + imgPad, cardY + imgPad, {
                  fit: [imgTargetW, imgTargetH],
                  align: 'center',
                  valign: 'center',
                });
                imageDrawn = true;
              } catch (_) {}
            }

            if (!imageDrawn) {
              doc.rect(cardX + imgPad, cardY + imgPad, imgTargetW, imgTargetH).fill('#f5f5f4');
              doc.font('Helvetica-Bold').fontSize(9).fillColor('#a8a29e');
              doc.text('PHOTO NOT AVAILABLE', cardX + imgPad, cardY + imageHeight / 2 - 6, {
                align: 'center',
                width: imgTargetW,
              });
            }

            // Divider inside card
            doc.strokeColor('#f5f5f4').lineWidth(0.8)
              .moveTo(cardX, cardY + imageHeight).lineTo(cardX + colWidth, cardY + imageHeight).stroke();

            // Text Info
            const price = resolvePrice(item, priceType);
            const skuText = item.sku ? `CODE: ${item.sku}` : '';
            const textY = cardY + imageHeight + 8;
            const textPad = 8;
            const textWidth = colWidth - textPad * 2;

            if (minimalist) {
              if (item.sku) {
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#1c1917');
                doc.text(item.sku, cardX + textPad, textY, { width: textWidth, ellipsis: true });
              }
              doc.font('Helvetica-Bold').fontSize(11).fillColor('#1c1917');
              doc.text(formatRupees(price), cardX + textPad, cardY + cardHeight - 20, {
                align: 'right',
                width: textWidth,
              });
            } else {
              let curTextY = textY;
              if (showSku && skuText) {
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#b45309');
                doc.text(skuText, cardX + textPad, curTextY, { width: textWidth, ellipsis: true });
                curTextY += 11;
              }

              // Product Name (up to 2 lines)
              doc.font('Helvetica-Bold').fontSize(cols === 3 ? 9 : 10).fillColor('#1c1917');
              doc.text(item.name || '', cardX + textPad, curTextY, {
                width: textWidth,
                height: cols === 3 ? 24 : 28,
                ellipsis: true,
              });

              // Bottom Price
              doc.font('Helvetica-Bold').fontSize(cols === 3 ? 11 : 13).fillColor('#1c1917');
              doc.text(formatRupees(price), cardX + textPad, cardY + cardHeight - (cols === 3 ? 18 : 22), {
                align: 'right',
                width: textWidth,
              });
            }

            // Advance grid cursor
            colIndex++;
            if (colIndex >= cols) {
              colIndex = 0;
              cursorY += cardHeight + gap;
            }
          });
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateCatalogPdf,
  resolveImageBuffer,
  extractDimensions,
  resolvePrice,
  formatRupees,
};
