import React, { useState } from 'react';
import {
  Printer,
  Download,
  X,
  Package,
  Sparkles,
  Layers,
} from 'lucide-react';

export default function CatalogPdfModal({
  isOpen,
  onClose,
  products = [],
  businessProfile = null,
}) {
  const [gridCols, setGridCols] = useState(2); // 2 or 3 columns
  const [priceType, setPriceType] = useState('mrp'); // 'mrp', 'sellingPrice', 'wholesalePrice'
  const [showSku, setShowSku] = useState(true);
  const [showBusinessHeader, setShowBusinessHeader] = useState(true);
  const [minimalist, setMinimalist] = useState(false); // Only Mockup + SKU + Small MRP
  const [liveBiz, setLiveBiz] = useState(businessProfile);

  React.useEffect(() => {
    if (businessProfile) {
      setLiveBiz(businessProfile);
    } else {
      fetch('/api/business/profile')
        .then((res) => res.json())
        .then((data) => setLiveBiz(data))
        .catch((err) => console.error('Failed to load profile in CatalogPdfModal:', err));
    }
  }, [businessProfile]);

  if (!isOpen) return null;

  const biz = liveBiz || businessProfile || {
    businessName: 'Curated Art',
    legalName: 'Curated Art Luxury Decor Pvt Ltd',
    address: 'Showroom #104, Design District, SG Highway, Ahmedabad, Gujarat - 380054',
    phone: '+91 98765 43210',
    email: 'contact@curatedart.in',
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const getPrice = (item) => {
    if (priceType === 'wholesalePrice' && item.wholesalePrice) {
      return item.wholesalePrice;
    }
    if (priceType === 'sellingPrice' && item.sellingPrice) {
      return item.sellingPrice;
    }
    return item.mrp || item.sellingPrice || item.wholesalePrice || 0;
  };

  // Generate clean, self-contained HTML for isolated printing & standalone export
  const generateCleanCatalogHtml = () => {
    // 1-Per-Slide Lookbook Mode (Matching WhatsApp Mobile Catalog PDF format)
    if (gridCols === 1) {
      const slideCards = products
        .map((item) => {
          const price = getPrice(item);
          const dimMatch = (item.name || '').match(/\b(\d+(?:\.\d+)?\s*[x*×]\s*\d+(?:\.\d+)?(?:\s*[x*×]\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|in)?)\b/i);
          const dimText = dimMatch ? dimMatch[1].toUpperCase() : '';
          const categoryName = item.category?.name || item.category || 'Artifact';

          return `
          <div style="page-break-after:always;break-after:page;width:100%;height:100vh;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;background:#ffffff;">
            <div style="width:100%;flex:1;display:flex;align-items:center;justify-content:center;background:#ffffff;overflow:hidden;">
              ${item.imageUrl
                ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=70';"/>`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:16px;font-weight:bold;">PHOTO NOT AVAILABLE</div>`}
            </div>
            <div style="padding:16px 20px 20px 20px;background:#ffffff;border-top:1px solid #f5f5f4;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:sans-serif;font-size:14px;font-weight:700;color:#1c1917;margin-bottom:6px;">
                <span style="font-family:monospace;letter-spacing:0.5px;">${item.sku || item.name}</span>
                <span style="color:#44403c;font-weight:600;font-size:13px;">${dimText}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:sans-serif;font-size:12px;color:#78716c;">
                <span style="text-transform:capitalize;font-weight:500;">${categoryName}</span>
                <span style="font-weight:700;color:#1c1917;font-family:monospace;font-size:14px;">Rs.${Number(price).toLocaleString('en-IN')}/-</span>
              </div>
            </div>
          </div>
          `;
        })
        .join('\n');

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${biz.businessName} — Mobile Catalog Slide</title>
  <style>
    @page { size: 595pt 646pt; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #1c1917;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  ${slideCards}
</body>
</html>`;
    }

    const htmlCards = products
      .map((item) => {
        const price = getPrice(item);
        const imgTag = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:${gridCols === 2 ? '280px' : '200px'};object-fit:cover;border-radius:10px;background:#f5f5f4;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=70';"/>`
          : `<div style="width:100%;height:${gridCols === 2 ? '280px' : '200px'};background:#f5f5f4;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:12px;font-weight:bold;">PHOTO NOT AVAILABLE</div>`;

        if (minimalist) {
          return `
          <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:10px;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div>
              ${imgTag}
            </div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #f5f5f4;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:11px;font-weight:700;color:#292524;font-family:monospace;letter-spacing:0.5px;">${item.sku || ''}</span>
              <span style="font-size:11px;font-weight:600;color:#78716c;font-family:monospace;">MRP: ₹${Number(price).toLocaleString('en-IN')}</span>
            </div>
          </div>
        `;
        }

        return `
        <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div>
            ${imgTag}
            <div style="margin-top:12px;">
              ${showSku && item.sku ? `<div style="font-size:10px;font-weight:bold;color:#b45309;font-family:monospace;letter-spacing:0.5px;">CODE: ${item.sku}</div>` : ''}
              <h3 style="font-size:15px;font-weight:bold;color:#1c1917;margin:4px 0 0 0;line-height:1.3;font-family:serif;">${item.name}</h3>
            </div>
          </div>
          <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f5f5f4;display:flex;align-items:baseline;justify-content:space-between;">
            <span style="font-size:10px;text-transform:uppercase;color:#78716c;font-weight:bold;letter-spacing:0.5px;">${priceType === 'mrp' ? 'MRP' : priceType === 'sellingPrice' ? 'Price' : 'Wholesale Rate'}</span>
            <div style="font-size:19px;font-weight:900;color:#0c0a09;font-family:monospace;">₹${Number(price).toLocaleString('en-IN')}</div>
          </div>
        </div>
      `;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${biz.businessName} — Product Catalog</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif;
      background: #ffffff;
      color: #1c1917;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #b45309;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${gridCols}, 1fr);
      gap: 16px;
    }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e7e5e4;
      text-align: center;
      font-size: 10px;
      color: #78716c;
    }
  </style>
</head>
<body>
  ${
    showBusinessHeader
      ? `
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:22px;color:#b45309;letter-spacing:1px;font-family:serif;">${biz.businessName.toUpperCase()}</h1>
      <p style="margin:3px 0 0 0;font-size:11px;color:#44403c;">${biz.address}</p>
      <p style="margin:2px 0 0 0;font-size:10px;color:#78716c;">Ph: ${biz.phone} &bull; ${biz.email}</p>
    </div>
    <div style="text-align:right;">
      <div style="background:#b45309;color:#ffffff;font-weight:bold;padding:3px 8px;border-radius:4px;font-size:10px;display:inline-block;letter-spacing:0.5px;">PRODUCT CATALOG</div>
      <div style="font-size:12px;font-weight:bold;margin-top:4px;color:#1c1917;">${todayFormatted}</div>
      <div style="font-size:10px;color:#78716c;">${products.length} Selected Designs</div>
    </div>
  </div>`
      : ''
  }
  <div class="grid">
    ${htmlCards}
  </div>
  <div class="footer">
    For bookings & inquiries, contact: <strong>${biz.phone}</strong> &bull; Valid as of ${todayFormatted}
  </div>
</body>
</html>`;
  };

  // ISOLATED PRINTING via hidden iframe on desktop or new tab on mobile
  const handlePrint = () => {
    const cleanHtml = generateCleanCatalogHtml();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

    if (isMobile) {
      // Mobile Safari / Chrome cannot trigger print from 0-size hidden iframes
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(cleanHtml);
        printWindow.document.close();
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (e) {
            console.error('Mobile print trigger error:', e);
          }
        }, 500);
        return;
      }
    }

    let iframe = document.getElementById('catalog-print-isolated-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'catalog-print-isolated-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(cleanHtml);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
    }, 400);
  };

  const handleDownloadHtml = () => {
    const htmlDoc = generateCleanCatalogHtml();
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Curated_Art_Catalog_${new Date().toISOString().slice(0, 10)}.html`;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      {/* Main Modal Window */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Controls Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-stone-950/80">
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-stone-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Clean PDF Catalog ({products.length} Selected Items)</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Only Image, Title/Name, and Price — strictly without technical codes or stock counts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Grid Columns Toggle */}
            <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setGridCols(1)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  gridCols === 1 ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="1 Per Slide (WhatsApp Mobile Lookbook matching sample PDF)"
              >
                1 Per Slide (Lookbook)
              </button>
              <button
                type="button"
                onClick={() => setGridCols(2)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  gridCols === 2 ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="2 Columns (Large Luxury Photos)"
              >
                2 Cols (Large)
              </button>
              <button
                type="button"
                onClick={() => setGridCols(3)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  gridCols === 3 ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="3 Columns (Compact Grid)"
              >
                3 Cols (Compact)
              </button>
            </div>

            {/* Price Type Selector */}
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value)}
              className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="mrp">Show MRP Price</option>
              <option value="sellingPrice">Show Selling Rate</option>
              <option value="wholesalePrice">Show Wholesale Rate</option>
            </select>

            {/* Minimalist Lookbook (Photo + SKU + Small MRP) */}
            <button
              type="button"
              onClick={() => setMinimalist(!minimalist)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                minimalist
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-950/40'
                  : 'bg-stone-900 border border-stone-800 text-stone-300 hover:text-white'
              }`}
              title="Minimalist Lookbook format: Mockup Photo + SKU + Small MRP only"
            >
              {minimalist ? '✓ Minimalist (Photo + SKU + MRP)' : 'Minimalist (Photo + SKU + MRP)'}
            </button>

            {/* Print / Save as PDF Primary Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-all shadow-md shadow-amber-950/40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            {/* Standalone HTML Catalog Download */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition-colors cursor-pointer"
              title="Download offline HTML catalog file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="inline sm:hidden">HTML</span>
              <span className="hidden sm:inline">Download HTML</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-950">
          <div className="max-w-4xl mx-auto bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 text-stone-100">
            {/* Luxury Header Preview */}
            {showBusinessHeader && gridCols !== 1 && (
              <div className="border-b-2 border-amber-500 pb-4 mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-black font-serif font-black text-xl tracking-tight shrink-0">
                    CA
                  </div>
                  <div>
                    <h1 className="text-xl font-serif font-bold text-amber-400 tracking-wide">
                      {biz.businessName}
                    </h1>
                    <p className="text-[11px] text-stone-400 font-medium">
                      {biz.address}
                    </p>
                    <p className="text-[10px] text-stone-500">
                      Ph: {biz.phone} &bull; {biz.email}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-[10px] uppercase tracking-wider">
                    Product Catalog
                  </span>
                  <div className="text-xs font-semibold text-stone-200 mt-1">
                    {todayFormatted}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {products.length} Selected Pieces
                  </div>
                </div>
              </div>
            )}

            {/* Product Cards Grid Preview */}
            {products.length === 0 ? (
              <div className="py-16 text-center text-stone-400 font-serif">
                <Package className="w-12 h-12 text-stone-600 mx-auto mb-2" />
                <p>No products selected for the catalog.</p>
                <p className="text-xs text-stone-500 mt-1">
                  Please select products using the checkboxes and click "PDF Catalog".
                </p>
              </div>
            ) : gridCols === 1 ? (
              <div className="flex flex-col items-center gap-8 max-w-lg mx-auto py-2">
                <div className="w-full text-center text-xs text-amber-400 font-medium pb-2 border-b border-stone-800">
                  📱 Mobile Slide Deck Lookbook (595 × 646 pt — 1 product per slide, matching reference PDF)
                </div>
                {products.map((item) => {
                  const price = getPrice(item);
                  const dimMatch = (item.name || '').match(
                    /\b(\d+(?:\.\d+)?\s*[x*×]\s*\d+(?:\.\d+)?(?:\s*[x*×]\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|in)?)\b/i
                  );
                  const dimText = dimMatch ? dimMatch[1].toUpperCase() : '';
                  const categoryName = item.category?.name || item.category || 'Artifact';

                  return (
                    <div
                      key={item.id}
                      className="w-full bg-white text-stone-900 rounded-2xl overflow-hidden shadow-2xl border border-stone-700 flex flex-col"
                    >
                      <div className="w-full aspect-square bg-stone-100 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=70';
                            }}
                          />
                        ) : (
                          <div className="text-stone-400 font-bold text-sm tracking-widest">
                            PHOTO NOT AVAILABLE
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-white border-t border-stone-100">
                        <div className="flex justify-between items-baseline font-mono font-bold text-sm text-stone-900 mb-1">
                          <span>{item.sku || item.name}</span>
                          <span className="font-sans font-semibold text-xs text-stone-700">{dimText}</span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs text-stone-500">
                          <span className="capitalize font-medium">{categoryName}</span>
                          <span className="font-mono font-bold text-sm text-stone-900">
                            Rs.{Number(price).toLocaleString('en-IN')}/-
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`grid gap-5 ${
                  gridCols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                }`}
              >
                {products.map((item) => {
                  const price = getPrice(item);
                  return (
                    <div
                      key={item.id}
                      className="bg-stone-950/70 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm"
                    >
                      <div>
                        {/* 1. PRODUCT IMAGE */}
                        <div className="w-full h-56 sm:h-64 rounded-xl overflow-hidden bg-stone-900 border border-stone-800/80 mb-3 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src =
                                  'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=70';
                              }}
                            />
                          ) : (
                            <div className="text-center p-4">
                              <Package className="w-10 h-10 text-stone-600 mx-auto mb-1" />
                              <span className="text-[10px] uppercase font-serif tracking-widest text-stone-500">
                                Curated Art
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Optional SKU tag & Title or Minimalist Footer */}
                        {minimalist ? (
                          <div className="mt-2 pt-2 border-t border-stone-800 flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-stone-200">{item.sku || 'NO-SKU'}</span>
                            <span className="text-amber-400 font-semibold">MRP: ₹{Number(price).toLocaleString('en-IN')}</span>
                          </div>
                        ) : (
                          <>
                            {showSku && item.sku && (
                              <div className="text-[10px] font-mono font-bold text-amber-500 mb-1">
                                CODE: {item.sku}
                              </div>
                            )}

                            {/* 2. PRODUCT TITLE / NAME */}
                            <h3 className="font-serif font-bold text-base text-stone-100 leading-snug">
                              {item.name}
                            </h3>
                          </>
                        )}
                      </div>

                      {/* 3. PRODUCT PRICE (ONLY IN STANDARD MODE) */}
                      {!minimalist && (
                        <div className="mt-4 pt-3 border-t border-stone-800 flex items-baseline justify-between">
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                            {priceType === 'mrp'
                              ? 'MRP'
                              : priceType === 'sellingPrice'
                              ? 'Selling Price'
                              : 'Wholesale Rate'}
                          </span>
                          <div className="text-xl font-black font-mono text-amber-400">
                            ₹{Number(price).toLocaleString('en-IN')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Catalog Footer Preview */}
            <div className="mt-8 pt-4 border-t border-stone-800 text-center text-[10px] text-stone-400">
              For bookings, orders & direct inquiries: <strong>{biz.phone}</strong> &bull; {biz.address}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
