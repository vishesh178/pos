import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Printer,
  Download,
  Share2,
  Copy,
  Check,
  Search,
  Filter,
  Sparkles,
  Package,
  Eye,
  EyeOff,
  MessageSquare,
  Calendar,
  Layers,
  Boxes,
  FileSpreadsheet,
  Tag,
  RefreshCw,
  ZoomIn,
  X,
  Image as ImageIcon,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CatalogPdfModal from '../components/products/CatalogPdfModal';

// Native browser CSV export utility
function exportToCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map((row) =>
    keys
      .map((k) => {
        let val = row[k] ?? '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(',')
  );
  const csvContent = [header, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function WholesaleCatalogPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [catalogData, setCatalogData] = useState(null);
  const [categories, setCategories] = useState([]);

  // Selected items state for custom targeted catalogs
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [isCatalogPdfModalOpen, setIsCatalogPdfModalOpen] = useState(false);

  // View layout: 'cards' (Lookbook), 'table' (Price List Sheet), 'whatsapp' (Quick Text)
  const [layoutMode, setLayoutMode] = useState('cards');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [minStock, setMinStock] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceAdjustment, setPriceAdjustment] = useState(0); // percentage adjustment (-10, -5, 0, +5, etc.)

  // Display toggles
  const [showImages, setShowImages] = useState(true);
  const [showWholesalePrice, setShowWholesalePrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showExactStock, setShowExactStock] = useState(true);
  const [showHsnGst, setShowHsnGst] = useState(true);

  // Lightbox Modal for high-res photo inspection
  const [lightboxItem, setLightboxItem] = useState(null);

  // Copy WhatsApp status feedback
  const [copied, setCopied] = useState(false);

  // Wholesale terms
  const [customTerms, setCustomTerms] = useState(
    '• Minimum Order Value: ₹10,000\n• 100% Advance Payment via UPI/NEFT before dispatch\n• GST 18% Extra on Wholesale Price\n• Packaging & Freight extra at actuals\n• Stock & prices subject to change without prior notice'
  );
  const [isEditingTerms, setIsEditingTerms] = useState(false);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const urlIds = searchParams.get('ids');
      let idParam = '';
      if (urlIds) {
        idParam = `&ids=${encodeURIComponent(urlIds)}`;
      }
      const res = await fetch(`/api/products/wholesale-catalog?minStock=${minStock}${idParam}`);
      const data = await res.json();
      setCatalogData(data);

      const catRes = await fetch('/api/products/categories');
      const catData = await catRes.json();
      setCategories(catData);

      // Initialize selected items from URL query params or sessionStorage
      if (urlIds) {
        const idList = urlIds.split(',').map((s) => s.trim()).filter(Boolean);
        if (idList.length > 0) {
          setSelectedItemIds(new Set(idList));
          setOnlySelected(true);
        }
      } else {
        const stored = sessionStorage.getItem('selected_catalog_ids');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedItemIds(new Set(parsed));
              setOnlySelected(true);
              sessionStorage.removeItem('selected_catalog_ids');
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Failed to fetch wholesale catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
    const handleInv = () => fetchCatalog();
    window.addEventListener('inventory-updated', handleInv);
    return () => window.removeEventListener('inventory-updated', handleInv);
  }, [minStock, searchParams]);

  // Selection toggle handlers
  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (!catalogData?.items) return;
    const allFilteredIds = filteredItems.map((i) => i.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedItemIds.has(id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedItemIds(new Set());
    setOnlySelected(false);
    sessionStorage.removeItem('selected_catalog_ids');
    if (searchParams.has('ids')) {
      const next = new URLSearchParams(searchParams);
      next.delete('ids');
      setSearchParams(next);
    }
  };

  // Filtered & computed items (respects onlySelected toggle)
  const filteredItems = useMemo(() => {
    if (!catalogData?.items) return [];
    return catalogData.items.filter((item) => {
      if (onlySelected && !selectedItemIds.has(item.id)) return false;
      const matchesCat =
        selectedCategory === 'all' || item.categoryName === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [catalogData, selectedCategory, searchQuery, onlySelected, selectedItemIds]);

  // Adjust price according to discount/surcharge slider
  const getAdjustedPrice = (basePrice) => {
    if (!priceAdjustment) return basePrice;
    return Math.round(basePrice * (1 + priceAdjustment / 100));
  };

  // Generate WhatsApp formatted text
  const whatsappText = useMemo(() => {
    if (!catalogData || !filteredItems.length) return '';
    const biz = catalogData.business;
    const todayStr = catalogData.dateFormatted;

    let text = `✨ *${biz.businessName.toUpperCase()} — WHOLESALE STOCK CATALOG* ✨\n`;
    text += `📅 *Date:* ${todayStr}\n`;
    text += `📍 *Showroom:* ${biz.address}\n`;
    text += `📞 *Orders & Booking:* ${biz.phone}\n`;
    if (biz.gstin) text += `📋 *GSTIN:* ${biz.gstin}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Group items by category
    const grouped = {};
    for (const it of filteredItems) {
      if (!grouped[it.categoryName]) grouped[it.categoryName] = [];
      grouped[it.categoryName].push(it);
    }

    for (const [catName, items] of Object.entries(grouped)) {
      text += `🏛️ *${catName.toUpperCase()}*\n`;
      items.forEach((it, idx) => {
        const effPrice = getAdjustedPrice(it.wholesalePrice);
        text += `${idx + 1}. *${it.name}*\n`;
        text += `   • SKU: ${it.sku}\n`;
        if (showWholesalePrice) text += `   • *Wholesale Rate:* ₹${effPrice.toLocaleString('en-IN')}\n`;
        if (showMrp && it.mrp) text += `   • Suggested MRP: ₹${it.mrp.toLocaleString('en-IN')}\n`;
        if (showExactStock) text += `   • Ready Stock: ${Number(it.currentStock.toFixed(2))} ${it.unit}\n`;
        else text += `   • Stock: In Ready Stock ✅\n`;
        if (it.imageUrl) text += `   • 🖼️ Photo: ${it.imageUrl}\n`;
        text += `\n`;
      });
      text += `\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📌 *TERMS & CONDITIONS:*\n${customTerms}\n\n`;
    text += `To lock your order, please reply with SKU & Quantity!`;

    return text;
  }, [
    catalogData,
    filteredItems,
    priceAdjustment,
    showWholesalePrice,
    showMrp,
    showExactStock,
    customTerms,
  ]);

  const handleCopyWhatsapp = () => {
    navigator.clipboard.writeText(whatsappText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!filteredItems.length) return;
    const exportRows = filteredItems.map((it, idx) => {
      let photoLink = '';
      if (it.imageUrl) {
        if (it.imageUrl.startsWith('http://') || it.imageUrl.startsWith('https://')) {
          photoLink = it.imageUrl;
        } else if (it.imageUrl.startsWith('/uploads/')) {
          photoLink = `http://localhost:5001${it.imageUrl}`;
        }
      }
      return {
        'Item #': idx + 1,
        'SKU': it.sku,
        'Barcode': it.barcode,
        'Product Name': it.name,
        'Category': it.categoryName,
        'HSN Code': it.hsnCode,
        'GST Rate': `${it.gstRate}%`,
        'Ready Stock': it.currentStock,
        'Unit': it.unit,
        'Wholesale Rate (INR)': getAdjustedPrice(it.wholesalePrice),
        'Suggested MRP (INR)': it.mrp || getAdjustedPrice(it.wholesalePrice),
        'Retailer Margin': `${it.retailMarginPercent}%`,
        'Photo Link': photoLink,
      };
    });
    exportToCsv(
      `Curated_Art_Wholesale_Rate_Sheet_${new Date().toISOString().slice(0, 10)}.csv`,
      exportRows
    );
  };

  const handleDownloadHtmlCatalog = () => {
    if (!catalogData || !filteredItems.length) return;
    const biz = catalogData.business;
    const today = catalogData.dateFormatted;

    const htmlCards = filteredItems
      .map((it) => {
        const effPrice = getAdjustedPrice(it.wholesalePrice);
        const imgTag = it.imageUrl
          ? `<img src="${it.imageUrl}" alt="${it.name}" style="width:100%;height:220px;object-fit:cover;border-radius:12px;background:#1c1917;" onerror="this.src='https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=70';"/>`
          : `<div style="width:100%;height:220px;background:#292524;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#a8a29e;font-size:12px;">No Photo Available</div>`;

        return `
        <div style="background:#1c1917;border:1px solid #44403c;border-radius:16px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;">
          <div>
            ${imgTag}
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#a8a29e;margin-top:10px;">
              <span style="font-family:monospace;font-weight:bold;color:#f59e0b;">${it.sku}</span>
              <span>${it.categoryName}</span>
            </div>
            <h3 style="font-size:14px;font-weight:bold;color:#fafaf9;margin:6px 0 4px 0;line-height:1.3;">${it.name}</h3>
            <div style="font-size:11px;color:#78716c;">HSN: ${it.hsnCode} | GST: ${it.gstRate}% | Ready Stock: <strong style="color:#10b981;">${Number(it.currentStock.toFixed(2))} ${it.unit}</strong></div>
          </div>
          <div style="margin-top:14px;padding-top:10px;border-top:1px solid #292524;display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:#a8a29e;font-weight:bold;">Wholesale Rate</div>
              <div style="font-size:18px;font-weight:900;color:#f59e0b;font-family:monospace;">₹${effPrice.toLocaleString('en-IN')}</div>
            </div>
            ${
              it.mrp
                ? `
            <div style="text-align:right;">
              <div style="font-size:10px;text-transform:uppercase;color:#a8a29e;">Suggested MRP</div>
              <div style="font-size:13px;font-weight:bold;color:#d6d3d1;font-family:monospace;">₹${it.mrp.toLocaleString('en-IN')}</div>
              <div style="font-size:10px;color:#10b981;font-weight:bold;">${it.retailMarginPercent}% Retail Margin</div>
            </div>`
                : ''
            }
          </div>
        </div>
      `;
      })
      .join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${biz.businessName} — Wholesale Catalog — ${today}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0a09; color: #fafaf9; margin: 0; padding: 24px; }
    .header { border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .terms { margin-top: 32px; padding: 16px; background: #1c1917; border-radius: 12px; font-size: 12px; color: #a8a29e; line-height: 1.6; white-space: pre-line; }
    @media print { body { background: #fff; color: #000; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:24px;color:#f59e0b;letter-spacing:1px;">${biz.businessName.toUpperCase()}</h1>
      <p style="margin:4px 0 0 0;font-size:12px;color:#d6d3d1;">${biz.legalName} &bull; Ph: ${biz.phone} &bull; ${biz.email}</p>
      <p style="margin:2px 0 0 0;font-size:11px;color:#a8a29e;">${biz.address} &bull; GSTIN: ${biz.gstin}</p>
    </div>
    <div style="text-align:right;">
      <div style="background:#f59e0b;color:#000;font-weight:bold;padding:4px 10px;border-radius:6px;font-size:11px;display:inline-block;">DAILY WHOLESALE STOCK CATALOG</div>
      <div style="font-size:13px;font-weight:bold;margin-top:6px;">${today}</div>
      <div style="font-size:11px;color:#a8a29e;">${filteredItems.length} Available Designs</div>
    </div>
  </div>
  <div class="grid">
    ${htmlCards}
  </div>
  <div class="terms">
    <strong style="color:#f59e0b;">WHOLESALE TERMS & CONDITIONS:</strong>
    ${customTerms}
  </div>
  <div style="text-align:center;margin-top:20px;font-size:11px;color:#78716c;">
    To place your wholesale booking, please contact ${biz.phone} with SKU and Quantity. Valid for ${today}.
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Curated_Art_Wholesale_Lookbook_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !catalogData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-400 font-serif">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <span>Loading daily available wholesale inventory & photos...</span>
      </div>
    );
  }

  const business = catalogData?.business || {};

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* ACTION HEADER (HIDDEN WHEN PRINTING) */}
      {/* ===================================================================== */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            <span>Daily Wholesale Stock Catalog & Rate Sheet</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Generate, print, or WhatsApp live ready stock catalogs with product images & wholesale pricing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyWhatsapp}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs transition-colors shadow-md shadow-emerald-950/40"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied WhatsApp Text!' : 'Copy for WhatsApp'}</span>
          </button>

          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-emerald-400 hover:border-emerald-500/40 text-xs font-semibold transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Open WhatsApp</span>
          </a>

          <button
            onClick={handleDownloadHtmlCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Visual Lookbook (HTML)</span>
          </button>

          <button
            onClick={() => setIsCatalogPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-all shadow-md shadow-amber-950/40 cursor-pointer"
            title="Generate clean catalog PDF with Image, Name, and Price only"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>PDF Catalog {selectedItemIds.size > 0 ? `(${selectedItemIds.size})` : ''}</span>
          </button>

          {searchParams.has('ids') && (
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Clear direct link filter and show all available products"
            >
              <span>Load Full Showroom</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Clean Excel CSV</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUMMARY KPI CARDS (HIDDEN WHEN PRINTING) */}
      {/* ===================================================================== */}
      <div className="print:hidden grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-[10px] uppercase font-bold tracking-wider">
            <span>Ready Art Designs</span>
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-400 font-mono mt-1">
            {filteredItems.length} Designs
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Catalog Date: {catalogData?.dateFormatted?.split(',')[1] || 'Today'}
          </p>
        </div>

        <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-[10px] uppercase font-bold tracking-wider">
            <span>Total Available Stock</span>
            <Boxes className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {filteredItems.reduce((sum, it) => sum + it.currentStock, 0)} Units
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Available for instant dispatch</p>
        </div>

        <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-[10px] uppercase font-bold tracking-wider">
            <span>Wholesale Inventory Value</span>
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-400 font-mono mt-1">
            ₹
            {filteredItems
              .reduce((sum, it) => sum + getAdjustedPrice(it.wholesalePrice) * it.currentStock, 0)
              .toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">At wholesale rate base</p>
        </div>

        <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-[10px] uppercase font-bold tracking-wider">
            <span>Avg Retail Margin for Buyer</span>
            <Tag className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 font-mono mt-1">
            {filteredItems.length > 0
              ? Math.round(
                  filteredItems.reduce((sum, it) => sum + it.retailMarginPercent, 0) /
                    filteredItems.length
                )
              : 0}
            %
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">Retailer profit on MRP</p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CONTROLS & DISPLAY TOGGLES (HIDDEN WHEN PRINTING) */}
      {/* ===================================================================== */}
      <div className="print:hidden p-4 bg-stone-900 border border-stone-800 rounded-2xl space-y-4">
        {/* Row 1: Layout Selection & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => setLayoutMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                layoutMode === 'cards'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Visual Lookbook</span>
            </button>

            <button
              onClick={() => setLayoutMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                layoutMode === 'table'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Compact Rate Sheet</span>
            </button>

            <button
              onClick={() => setLayoutMode('whatsapp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                layoutMode === 'whatsapp'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Quick Text</span>
            </button>
          </div>

          {/* Search bar + Selected Only filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Filter by product name, SKU or collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-200 placeholder-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedItemIds.size === 0 && !onlySelected) {
                  selectAllFiltered();
                  setOnlySelected(true);
                } else {
                  setOnlySelected(!onlySelected);
                }
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0 cursor-pointer ${
                onlySelected
                  ? 'bg-amber-500 text-stone-950 border-amber-500 font-bold shadow-md shadow-amber-950/40'
                  : selectedItemIds.size > 0
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'
              }`}
              title="Show only selected items in catalog"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Selected Only {selectedItemIds.size > 0 ? `(${selectedItemIds.size})` : ''}</span>
            </button>
          </div>
        </div>

        {/* Selected Items Status Banner */}
        {selectedItemIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-300 print:hidden">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {onlySelected ? (
                  <>Showing custom catalog of <strong>{filteredItems.length} selected item(s)</strong>. Print, PDF, WhatsApp, HTML lookbook and CSV will include only these items.</>
                ) : (
                  <><strong>{selectedItemIds.size} item(s)</strong> selected for custom catalog.</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setOnlySelected(!onlySelected)}
                className="font-bold underline text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {onlySelected ? 'Show All Products' : `Filter to Selected (${selectedItemIds.size})`}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-stone-400 hover:text-rose-400 underline cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Row 2: Category Filter, Min Stock & Price Markup Adjuster */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Available Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-stone-400">Min Available Stock:</span>
              <select
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value={1}>Ready Stock (≥ 1 pc)</option>
                <option value={3}>Bulk Stock (≥ 3 pcs)</option>
                <option value={5}>Wholesale Batch (≥ 5 pcs)</option>
                <option value={10}>Master Carton (≥ 10 pcs)</option>
              </select>
            </div>

            {/* Wholesale Pricing Tier Adjuster */}
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Trade Rate Tier:</span>
              <select
                value={priceAdjustment}
                onChange={(e) => setPriceAdjustment(Number(e.target.value))}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-amber-400 font-bold focus:outline-none focus:border-amber-500"
              >
                <option value={0}>Standard Wholesale Rate (0%)</option>
                <option value={-5}>Bulk Dealer Discount (-5%)</option>
                <option value={-10}>Master Distributor Discount (-10%)</option>
                <option value={5}>Special Season Surcharge (+5%)</option>
              </select>
            </div>
          </div>

          {/* Visibility Toggles */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showImages}
                onChange={(e) => setShowImages(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span className="font-semibold text-amber-400">Product Photos</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showWholesalePrice}
                onChange={(e) => setShowWholesalePrice(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>Wholesale Rate</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showMrp}
                onChange={(e) => setShowMrp(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>Suggested MRP</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showExactStock}
                onChange={(e) => setShowExactStock(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>Stock Qty</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showHsnGst}
                onChange={(e) => setShowHsnGst(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>HSN / GST</span>
            </label>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PRINT-OPTIMIZED CATALOG DOCUMENT CONTAINER */}
      {/* ===================================================================== */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 md:p-8 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* Luxury Showroom Header (Always Visible, specially styled on print) */}
        <div className="border-b border-stone-800 print:border-stone-400 pb-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-black font-serif font-black text-2xl tracking-tighter shrink-0 print:border print:border-black">
              CA
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-serif font-bold text-stone-100 print:text-black tracking-wide">
                {business.businessName || 'CURATED ART'}
              </h2>
              <p className="text-[11px] text-amber-500 print:text-stone-700 font-medium">
                {business.legalName || 'Curated Art Luxury Decor Pvt Ltd'}
              </p>
              <p className="text-[10px] text-stone-400 print:text-stone-600 mt-0.5">
                {business.address} &bull; Ph: {business.phone}
              </p>
            </div>
          </div>

          <div className="text-left md:text-right font-mono text-xs text-stone-300 print:text-black">
            <div className="inline-block px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 print:text-black print:border-black font-sans font-bold text-[11px] uppercase tracking-wider mb-1">
              DAILY WHOLESALE STOCK CATALOG
            </div>
            <div className="text-[11px] font-sans font-semibold text-stone-100 print:text-black">
              {catalogData?.dateFormatted || new Date().toLocaleDateString('en-IN')}
            </div>
            <div className="text-[10px] text-stone-400 print:text-stone-600">
              GSTIN: {business.gstin || '24AAAAA0000A1Z5'} &bull; State: Gujarat (24)
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* LAYOUT 1: VISUAL LOOKBOOK (LUXURY GRID CARDS) */}
        {/* ------------------------------------------------------------------- */}
        {layoutMode === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 print:grid-cols-3 print:gap-3">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-stone-400 font-serif">
                No available in-stock items match the selected filter.
              </div>
            ) : (
              filteredItems.map((item) => {
                const effPrice = getAdjustedPrice(item.wholesalePrice);
                return (
                  <div
                    key={item.id}
                    className={`group p-4 bg-stone-950/80 border rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-amber-950/20 transition-all print:bg-white print:border-stone-300 print:text-black print:break-inside-avoid relative ${
                      selectedItemIds.has(item.id)
                        ? 'border-amber-500/80 bg-amber-950/20 shadow-lg shadow-amber-950/30'
                        : 'border-stone-800 hover:border-amber-500/50'
                    }`}
                  >
                    {/* Item Selection Checkbox (Hidden in Print) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectItem(item.id);
                      }}
                      className={`absolute top-3 left-3 z-20 w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        selectedItemIds.has(item.id)
                          ? 'bg-amber-500 text-stone-950 shadow-md ring-2 ring-amber-400'
                          : 'bg-black/75 text-stone-400 hover:text-white border border-stone-600 hover:border-amber-400'
                      } print:hidden`}
                      title={selectedItemIds.has(item.id) ? 'Deselect from catalog' : 'Select for custom catalog'}
                    >
                      <Check
                        className={`w-3.5 h-3.5 stroke-[3] ${
                          selectedItemIds.has(item.id) ? 'opacity-100' : 'opacity-0 hover:opacity-50'
                        }`}
                      />
                    </button>

                    <div>
                      {/* Product Photo with Hover Zoom & Stock Pill */}
                      {showImages && (
                        <div
                          onClick={() => setLightboxItem(item)}
                          className="w-full h-48 bg-stone-900 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden border border-stone-800 cursor-pointer print:bg-stone-100 print:border-stone-300"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src =
                                  'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=70';
                              }}
                            />
                          ) : (
                            <div className="text-center p-3">
                              <Package className="w-8 h-8 text-amber-500/50 mx-auto mb-1 print:text-stone-400" />
                              <span className="text-[10px] uppercase tracking-widest text-stone-400 font-serif">
                                {item.categoryName}
                              </span>
                            </div>
                          )}

                          {/* Zoom Button Hover Indicator */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-300 backdrop-blur-[2px] print:hidden">
                            <ZoomIn className="w-4 h-4" />
                            <span>Inspect Photo</span>
                          </div>

                          {/* Available Stock Pill */}
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-stone-950/90 border border-stone-700/80 backdrop-blur-md text-[10px] font-bold text-emerald-400 shadow-md print:bg-white print:text-black print:border-black">
                            {showExactStock
                              ? `${Number(item.currentStock.toFixed(2))} ${item.unit} In Stock`
                              : 'Ready Stock'}
                          </div>
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex items-center justify-between text-[10px] text-stone-400 print:text-stone-600 mb-1">
                        <span className="font-mono font-semibold text-amber-400 print:text-black">{item.sku}</span>
                        <span>{item.categoryName}</span>
                      </div>

                      <h3 className="font-serif font-bold text-sm text-stone-100 print:text-black line-clamp-2 leading-snug">
                        {item.name}
                      </h3>

                      {showHsnGst && (
                        <p className="text-[10px] text-stone-400 print:text-stone-600 mt-1">
                          HSN: <span className="font-mono">{item.hsnCode}</span> &bull; GST:{' '}
                          <span className="font-mono">{item.gstRate}%</span>
                        </p>
                      )}
                    </div>

                    {/* Pricing Block */}
                    <div className="mt-4 pt-3 border-t border-stone-800/80 print:border-stone-300 flex items-end justify-between">
                      {showWholesalePrice ? (
                        <div>
                          <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">
                            Wholesale Rate
                          </span>
                          <div className="text-lg font-black font-mono text-amber-400 print:text-black leading-none mt-0.5">
                            ₹{effPrice.toLocaleString('en-IN')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-stone-400">Trade Piece</div>
                      )}

                      {showMrp && item.mrp > 0 && (
                        <div className="text-right">
                          <span className="text-[9px] uppercase text-stone-400 tracking-wider">
                            Suggested MRP
                          </span>
                          <div className="text-xs font-mono font-bold text-stone-300 print:text-stone-700">
                            ₹{item.mrp.toLocaleString('en-IN')}
                          </div>
                          {item.retailMarginPercent > 0 && (
                            <span className="text-[9px] text-emerald-400 print:text-emerald-700 font-bold block">
                              {item.retailMarginPercent}% Retail Margin
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* LAYOUT 2: COMPACT RATE SHEET (A4 TABLE WITH THUMBNAIL IMAGES) */}
        {/* ------------------------------------------------------------------- */}
        {layoutMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs print:text-[10px]">
              <thead className="bg-stone-950 border-y border-stone-800 text-[10px] uppercase font-bold text-stone-400 print:bg-stone-100 print:text-black print:border-black">
                <tr>
                  <th className="px-3 py-2.5 text-center w-10 print:hidden">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && filteredItems.every((it) => selectedItemIds.has(it.id))}
                      onChange={selectAllFiltered}
                      className="accent-amber-500 rounded cursor-pointer"
                      title="Select / Deselect All Filtered Items"
                    />
                  </th>
                  {showImages && <th className="px-3 py-2.5 text-center w-16">Photo</th>}
                  <th className="px-3 py-2.5">SKU / Code</th>
                  <th className="px-4 py-2.5">Product Name & Specifications</th>
                  <th className="px-3 py-2.5">Category</th>
                  {showHsnGst && <th className="px-2 py-2.5 text-center">HSN</th>}
                  {showHsnGst && <th className="px-2 py-2.5 text-center">GST</th>}
                  <th className="px-3 py-2.5 text-center">Available Stock</th>
                  {showWholesalePrice && (
                    <th className="px-4 py-2.5 text-right font-black">Wholesale Rate (₹)</th>
                  )}
                  {showMrp && <th className="px-3 py-2.5 text-right">MRP (₹)</th>}
                  {showMrp && <th className="px-3 py-2.5 text-right">Margin (%)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300 font-mono print:divide-stone-300 print:text-black">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={showImages ? 11 : 10} className="text-center py-8 text-stone-400 font-sans">
                      No available stock found for this selection.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const effPrice = getAdjustedPrice(item.wholesalePrice);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-stone-800/40 print:hover:bg-transparent transition-colors ${
                          selectedItemIds.has(item.id) ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        {/* Checkbox for custom catalog selection */}
                        <td className="px-3 py-2 text-center print:hidden">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            className="accent-amber-500 rounded cursor-pointer"
                            title={selectedItemIds.has(item.id) ? 'Deselect item' : 'Select for custom catalog'}
                          />
                        </td>

                        {/* High-Resolution Thumbnail Image */}
                        {showImages && (
                          <td className="px-3 py-2 text-center">
                            <div
                              onClick={() => setLightboxItem(item)}
                              className="w-12 h-12 rounded-lg overflow-hidden bg-stone-900 border border-stone-800 shrink-0 mx-auto cursor-pointer hover:border-amber-500 transition-colors print:border-stone-300"
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src =
                                      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=100&q=70';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] text-stone-500">
                                  No Img
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        <td className="px-3 py-2.5 font-bold text-amber-400 print:text-black">
                          {item.sku}
                        </td>
                        <td className="px-4 py-2.5 font-sans font-medium text-stone-100 print:text-black">
                          {item.name}
                        </td>
                        <td className="px-3 py-2.5 font-sans text-stone-400 print:text-stone-700">
                          {item.categoryName}
                        </td>
                        {showHsnGst && (
                          <td className="px-2 py-2.5 text-center text-stone-400 print:text-stone-700">
                            {item.hsnCode}
                          </td>
                        )}
                        {showHsnGst && (
                          <td className="px-2 py-2.5 text-center text-stone-400 print:text-stone-700">
                            {item.gstRate}%
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-bold text-emerald-400 print:text-black">
                            {showExactStock
                              ? `${Number(item.currentStock.toFixed(2))} ${item.unit}`
                              : 'Ready Stock'}
                          </span>
                        </td>
                        {showWholesalePrice && (
                          <td className="px-4 py-2.5 text-right font-black text-amber-400 print:text-black text-sm">
                            ₹{effPrice.toLocaleString('en-IN')}
                          </td>
                        )}
                        {showMrp && (
                          <td className="px-3 py-2.5 text-right text-stone-300 print:text-black">
                            ₹{item.mrp.toLocaleString('en-IN')}
                          </td>
                        )}
                        {showMrp && (
                          <td className="px-3 py-2.5 text-right text-emerald-400 print:text-black font-sans font-bold">
                            {item.retailMarginPercent}%
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* LAYOUT 3: WHATSAPP QUICK TEXT PREVIEW */}
        {/* ------------------------------------------------------------------- */}
        {layoutMode === 'whatsapp' && (
          <div className="space-y-4 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Ready WhatsApp Broadcast Message ({filteredItems.length} Items with Photo Links)</span>
              </span>
              <button
                onClick={handleCopyWhatsapp}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy WhatsApp Message'}</span>
              </button>
            </div>

            <textarea
              readOnly
              value={whatsappText}
              rows={16}
              className="w-full bg-stone-950 border border-stone-800 rounded-2xl p-4 font-mono text-xs text-stone-200 focus:outline-none select-all"
            />
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* WHOLESALE TERMS & CONDITIONS FOOTER (PRINT READY) */}
        {/* ------------------------------------------------------------------- */}
        <div className="mt-8 pt-5 border-t border-stone-800 print:border-stone-400 text-xs text-stone-400 print:text-stone-700">
          <div className="flex justify-between items-center mb-2 print:hidden">
            <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
              Wholesale Order Policy & Dispatch Terms
            </span>
            <button
              onClick={() => setIsEditingTerms(!isEditingTerms)}
              className="text-[11px] text-stone-400 hover:text-amber-400 underline font-sans"
            >
              {isEditingTerms ? 'Done Editing' : 'Edit Terms'}
            </button>
          </div>

          {isEditingTerms ? (
            <textarea
              value={customTerms}
              onChange={(e) => setCustomTerms(e.target.value)}
              rows={4}
              className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-500 print:hidden font-mono"
            />
          ) : (
            <div className="whitespace-pre-line leading-relaxed font-sans text-[11px] bg-stone-950/40 p-4 rounded-xl border border-stone-800/60 print:bg-transparent print:border-none print:p-0">
              {customTerms}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-stone-800/60 print:border-stone-300 flex flex-col md:flex-row justify-between items-center text-[10px] text-stone-400 print:text-stone-600">
            <span>Generated on {catalogData?.dateFormatted} &bull; Curated Art Showroom</span>
            <span className="font-mono">Catalog Ref: CA-CAT-{new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* HIGH-RES IMAGE LIGHTBOX MODAL */}
      {/* ===================================================================== */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative flex flex-col md:flex-row"
          >
            <button
              onClick={() => setLightboxItem(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-stone-950/80 border border-stone-700 text-stone-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image Preview */}
            <div className="w-full md:w-1/2 h-72 md:h-auto bg-stone-950 relative flex items-center justify-center overflow-hidden">
              {lightboxItem.imageUrl ? (
                <img
                  src={lightboxItem.imageUrl}
                  alt={lightboxItem.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-16 h-16 text-stone-700" />
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-stone-950/80 text-[10px] text-emerald-400 font-bold border border-stone-700">
                {Number(lightboxItem.currentStock.toFixed(2))} {lightboxItem.unit} Ready in Showroom
              </div>
            </div>

            {/* Product Specs */}
            <div className="p-6 md:w-1/2 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-wider">
                  {lightboxItem.categoryName}
                </span>
                <h3 className="font-serif font-bold text-lg text-stone-100 mt-2">
                  {lightboxItem.name}
                </h3>
                <p className="text-xs font-mono text-stone-400 mt-0.5">
                  SKU: {lightboxItem.sku} &bull; Barcode: {lightboxItem.barcode}
                </p>

                <div className="mt-4 p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Wholesale Trade Rate:</span>
                    <span className="font-mono font-bold text-amber-400 text-base">
                      ₹{getAdjustedPrice(lightboxItem.wholesalePrice).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {lightboxItem.mrp > 0 && (
                    <div className="flex justify-between text-stone-300">
                      <span className="text-stone-400">Suggested Retail MRP:</span>
                      <span className="font-mono font-semibold">
                        ₹{lightboxItem.mrp.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {lightboxItem.retailMarginPercent > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Buyer Retail Margin:</span>
                      <span>{lightboxItem.retailMarginPercent}% Margin on MRP</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-400 text-[11px] pt-1 border-t border-stone-800">
                    <span>HSN & Tax:</span>
                    <span>
                      {lightboxItem.hsnCode} ({lightboxItem.gstRate}% GST)
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hi Curated Art, I want to book wholesale order for:\n*${lightboxItem.name}*\nSKU: ${lightboxItem.sku}\nWholesale Rate: ₹${getAdjustedPrice(lightboxItem.wholesalePrice)}\nAvailable Stock: ${Number(lightboxItem.currentStock.toFixed(2))} ${lightboxItem.unit}\nPhoto: ${lightboxItem.imageUrl || 'N/A'}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Book This Item via WhatsApp</span>
                </a>

                <button
                  onClick={() => setLightboxItem(null)}
                  className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean PDF Catalog Modal (Image, Name & Price Only) */}
      {isCatalogPdfModalOpen && (
        <CatalogPdfModal
          isOpen={isCatalogPdfModalOpen}
          onClose={() => setIsCatalogPdfModalOpen(false)}
          products={
            selectedItemIds.size > 0
              ? (catalogData?.items || []).filter((it) => selectedItemIds.has(it.id))
              : filteredItems
          }
          businessProfile={business}
        />
      )}
    </div>
  );
}
