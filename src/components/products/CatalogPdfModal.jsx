import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  X,
  Image as ImageIcon,
  Check,
  Package,
  Layers,
  Sparkles,
  Share2,
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const htmlCards = products
      .map((item) => {
        const price = getPrice(item);
        const imgTag = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:260px;object-fit:cover;border-radius:12px;background:#f5f5f4;" onerror="this.style.display='none';"/>`
          : `<div style="width:100%;height:260px;background:#f5f5f4;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:12px;font-weight:bold;">PHOTO NOT AVAILABLE</div>`;

        return `
        <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div>
            ${imgTag}
            <div style="margin-top:12px;">
              ${showSku && item.sku ? `<div style="font-size:11px;font-weight:bold;color:#b45309;font-family:monospace;letter-spacing:0.5px;">CODE: ${item.sku}</div>` : ''}
              <h3 style="font-size:16px;font-weight:bold;color:#1c1917;margin:4px 0 0 0;line-height:1.3;font-family:serif;">${item.name}</h3>
            </div>
          </div>
          <div style="margin-top:14px;padding-top:10px;border-top:1px solid #f5f5f4;display:flex;align-items:baseline;justify-content:space-between;">
            <span style="font-size:11px;text-transform:uppercase;color:#78716c;font-weight:bold;letter-spacing:0.5px;">Price</span>
            <div style="font-size:20px;font-weight:900;color:#0c0a09;font-family:monospace;">₹${Number(price).toLocaleString('en-IN')}</div>
          </div>
        </div>
      `;
      })
      .join('\n');

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${biz.businessName} — Product Catalog</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif; background: #ffffff; color: #1c1917; margin: 0; padding: 24px; }
    .header { border-bottom: 2px solid #b45309; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .grid { display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 20px; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e7e5e4; text-align: center; font-size: 11px; color: #78716c; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:24px;color:#b45309;letter-spacing:1px;font-family:serif;">${biz.businessName.toUpperCase()}</h1>
      <p style="margin:4px 0 0 0;font-size:12px;color:#44403c;">${biz.address}</p>
      <p style="margin:2px 0 0 0;font-size:11px;color:#78716c;">Ph: ${biz.phone} &bull; ${biz.email}</p>
    </div>
    <div style="text-align:right;">
      <div style="background:#b45309;color:#ffffff;font-weight:bold;padding:4px 10px;border-radius:6px;font-size:11px;display:inline-block;letter-spacing:0.5px;">PRODUCT CATALOG</div>
      <div style="font-size:12px;font-weight:bold;margin-top:6px;color:#1c1917;">${todayFormatted}</div>
      <div style="font-size:11px;color:#78716c;">${products.length} Selected Designs</div>
    </div>
  </div>
  <div class="grid">
    ${htmlCards}
  </div>
  <div class="footer">
    For bookings & inquiries, contact: <strong>${biz.phone}</strong> &bull; Valid as of ${todayFormatted}
  </div>
</body>
</html>`;

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
      {/* =================================================================== */}
      {/* PRINT-ONLY STYLESHEET (SCOPED TO #printable-catalog-pdf)            */}
      {/* =================================================================== */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-catalog-pdf, #printable-catalog-pdf * {
            visibility: visible !important;
          }
          #printable-catalog-pdf {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 10mm !important;
            margin: 0 !important;
          }
          .catalog-print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #d6d3d1 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Main Modal Window */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none print:max-h-none print:w-full print:bg-white">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="print:hidden p-4 sm:p-5 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-stone-950/80">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-950 print:p-0 print:bg-white print:overflow-visible">
          {/* Printable Zone */}
          <div
            id="printable-catalog-pdf"
            className="max-w-4xl mx-auto bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 text-stone-100 print:bg-white print:border-none print:p-0 print:text-black print:max-w-none"
          >
            {/* Luxury Header */}
            {showBusinessHeader && (
              <div className="border-b-2 border-amber-500 pb-4 mb-6 flex items-center justify-between gap-4 print:border-amber-600">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-black font-serif font-black text-xl tracking-tight shrink-0 print:border print:border-black">
                    CA
                  </div>
                  <div>
                    <h1 className="text-xl font-serif font-bold text-amber-400 print:text-black tracking-wide">
                      {biz.businessName}
                    </h1>
                    <p className="text-[11px] text-stone-400 print:text-stone-700 font-medium">
                      {biz.address}
                    </p>
                    <p className="text-[10px] text-stone-500 print:text-stone-600">
                      Ph: {biz.phone} &bull; {biz.email}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 print:text-black print:border-black font-mono font-bold text-[10px] uppercase tracking-wider">
                    Product Catalog
                  </span>
                  <div className="text-xs font-semibold text-stone-200 print:text-black mt-1">
                    {todayFormatted}
                  </div>
                  <div className="text-[10px] text-stone-400 print:text-stone-600">
                    {products.length} Selected Pieces
                  </div>
                </div>
              </div>
            )}

            {/* Product Cards Grid */}
            {products.length === 0 ? (
              <div className="py-16 text-center text-stone-400 font-serif">
                <Package className="w-12 h-12 text-stone-600 mx-auto mb-2" />
                <p>No products selected for the catalog.</p>
                <p className="text-xs text-stone-500 mt-1">
                  Please check 1 or more products on the products list and click "PDF Catalog".
                </p>
              </div>
            ) : (
              <div
                className={`grid gap-5 ${
                  gridCols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                } print:gap-4 ${gridCols === 2 ? 'print:grid-cols-2' : 'print:grid-cols-3'}`}
              >
                {products.map((item) => {
                  const price = getPrice(item);
                  return (
                    <div
                      key={item.id}
                      className="catalog-print-card bg-stone-950/70 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm print:bg-white print:border-stone-300 print:shadow-none"
                    >
                      <div>
                        {/* 1. PRODUCT IMAGE */}
                        <div className="w-full h-56 sm:h-64 rounded-xl overflow-hidden bg-stone-900 border border-stone-800/80 mb-3 flex items-center justify-center print:bg-stone-50 print:border-stone-200">
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
                              <Package className="w-10 h-10 text-stone-600 print:text-stone-400 mx-auto mb-1" />
                              <span className="text-[10px] uppercase font-serif tracking-widest text-stone-500">
                                Curated Art
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Optional SKU tag */}
                        {showSku && item.sku && (
                          <div className="text-[10px] font-mono font-bold text-amber-500 print:text-stone-600 mb-1">
                            CODE: {item.sku}
                          </div>
                        )}

                        {/* 2. PRODUCT TITLE / NAME */}
                        <h3 className="font-serif font-bold text-base text-stone-100 print:text-black leading-snug">
                          {item.name}
                        </h3>
                      </div>

                      {/* 3. PRODUCT PRICE (ONLY) */}
                      <div className="mt-4 pt-3 border-t border-stone-800 print:border-stone-200 flex items-baseline justify-between">
                        <span className="text-[10px] uppercase font-bold text-stone-400 print:text-stone-500 tracking-wider">
                          {priceType === 'mrp'
                            ? 'MRP'
                            : priceType === 'sellingPrice'
                            ? 'Selling Price'
                            : 'Wholesale Rate'}
                        </span>
                        <div className="text-xl font-black font-mono text-amber-400 print:text-black">
                          ₹{Number(price).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Catalog Footer */}
            <div className="mt-8 pt-4 border-t border-stone-800 print:border-stone-300 text-center text-[10px] text-stone-400 print:text-stone-600">
              For bookings, orders & direct inquiries: <strong>{biz.phone}</strong> &bull; {biz.address}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

