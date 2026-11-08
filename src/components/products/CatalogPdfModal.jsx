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

  if (!isOpen) return null;

  const biz = businessProfile || {
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
    const htmlCards = products
      .map((item) => {
        const price = getPrice(item);
        const imgTag = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:${gridCols === 2 ? '280px' : '200px'};object-fit:cover;border-radius:10px;background:#f5f5f4;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=70';"/>`
          : `<div style="width:100%;height:${gridCols === 2 ? '280px' : '200px'};background:#f5f5f4;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:12px;font-weight:bold;">PHOTO NOT AVAILABLE</div>`;

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

  // ISOLATED PRINTING via hidden iframe to prevent the 13 phantom pages bug
  const handlePrint = () => {
    const cleanHtml = generateCleanCatalogHtml();

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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            {showBusinessHeader && (
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

                        {/* Optional SKU tag */}
                        {showSku && item.sku && (
                          <div className="text-[10px] font-mono font-bold text-amber-500 mb-1">
                            CODE: {item.sku}
                          </div>
                        )}

                        {/* 2. PRODUCT TITLE / NAME */}
                        <h3 className="font-serif font-bold text-base text-stone-100 leading-snug">
                          {item.name}
                        </h3>
                      </div>

                      {/* 3. PRODUCT PRICE (ONLY) */}
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
