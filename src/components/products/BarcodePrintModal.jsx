import React, { useState, useMemo } from 'react';
import { X, Printer, LayoutGrid, Tag, Sliders, CheckSquare, Layers, Copy, Hash } from 'lucide-react';
import BarcodeSvg from '../../utils/barcodeSvg';

export default function BarcodePrintModal({ isOpen, onClose, product, products = [] }) {
  // Determine products list (support both single product mode and multi-product batch mode)
  const productList = useMemo(() => {
    if (product) return [product];
    if (products && products.length > 0) return products;
    return [];
  }, [product, products]);

  // Quantities map: { [productId]: count }
  const [quantities, setQuantities] = useState({});

  // Initialize or update quantities when productList changes
  React.useEffect(() => {
    if (productList.length > 0) {
      const initial = {};
      productList.forEach((p) => {
        initial[p.id] = initial[p.id] || (product ? 4 : Math.max(1, p.currentStock || 1));
      });
      setQuantities(initial);
    }
  }, [productList, product]);

  // Layout format: 'a4_24', 'a4_30', 'thermal_50x25', 'thermal_50x35'
  const [layout, setLayout] = useState('a4_24');

  // Customization toggles
  const [options, setOptions] = useState({
    showBrand: true,
    showName: true,
    showSku: true,
    showPrice: true,
    showHsn: false,
  });

  // Calculate expanded list of all stickers to print (must be called unconditionally before early returns)
  const allStickers = useMemo(() => {
    const list = [];
    productList.forEach((p) => {
      const count = quantities[p.id] || 1;
      for (let i = 0; i < count; i++) {
        list.push({ ...p, stickerIndex: i });
      }
    });
    return list;
  }, [productList, quantities]);

  if (!isOpen || productList.length === 0) return null;

  const totalLabels = allStickers.length;
  const labelsPerPage = layout === 'a4_24' ? 24 : layout === 'a4_30' ? 30 : 1;
  const totalSheets = Math.ceil(totalLabels / labelsPerPage);

  // Quick Preset Actions for Quantities
  const handleSetAllQuantities = (qty) => {
    const updated = {};
    productList.forEach((p) => {
      updated[p.id] = Math.max(1, qty);
    });
    setQuantities(updated);
  };

  const handleSetByStock = () => {
    const updated = {};
    productList.forEach((p) => {
      updated[p.id] = Math.max(1, p.currentStock || 1);
    });
    setQuantities(updated);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      {/* Print-only CSS injected specifically for label sheets & thermal roll printers */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #barcode-sticker-print-zone, #barcode-sticker-print-zone * {
            visibility: visible;
          }
          #barcode-sticker-print-zone {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }
          .barcode-sticker-unit {
            page-break-inside: avoid;
            break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: ${layout.startsWith('a4') ? 'A4 portrait' : 'auto'};
            margin: ${layout.startsWith('a4') ? '8mm' : '0mm'};
          }
        }
      `}</style>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-stone-800 flex items-center justify-between bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                <span>Barcode Sticker & Label Sheet Generator</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-stone-800 text-stone-300">
                  {productList.length} {productList.length === 1 ? 'Product' : 'Products'}
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Print GS1-compliant EAN-13 barcodes on standard A4 peel-off sticker sheets or thermal rolls
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close barcode print dialog"
            title="Close"
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - 2 Columns (Controls on Left, Live Sheet Preview on Right) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT PANEL: Settings & Quantities (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Sheet Layout Selection */}
            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-2">
                1. Select Label Paper Layout
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLayout('a4_24')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    layout === 'a4_24'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>A4 Sheet (24-Up)</span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">3 × 8 grid • 70×37 mm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('a4_30')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    layout === 'a4_30'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>A4 Sheet (30-Up)</span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">3 × 10 grid • 70×29.7 mm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('thermal_50x25')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    layout === 'thermal_50x25'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Thermal 50×25mm</span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Roll printer • 2" × 1"</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('thermal_50x35')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    layout === 'thermal_50x35'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Thermal 50×35mm</span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Tall jewelry/tag roll</div>
                </button>
              </div>
            </div>

            {/* 2. Sticker Content Toggles */}
            <div className="p-3 bg-stone-950/70 border border-stone-800 rounded-xl space-y-2">
              <span className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                2. Sticker Information Fields
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.showBrand}
                    onChange={(e) => setOptions({ ...options, showBrand: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-900 border-stone-700"
                  />
                  <span>Brand Header</span>
                </label>

                <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.showName}
                    onChange={(e) => setOptions({ ...options, showName: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-900 border-stone-700"
                  />
                  <span>Product Title</span>
                </label>

                <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.showSku}
                    onChange={(e) => setOptions({ ...options, showSku: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-900 border-stone-700"
                  />
                  <span>SKU Code</span>
                </label>

                <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.showPrice}
                    onChange={(e) => setOptions({ ...options, showPrice: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-900 border-stone-700"
                  />
                  <span>MRP Price</span>
                </label>

                <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.showHsn}
                    onChange={(e) => setOptions({ ...options, showHsn: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-900 border-stone-700"
                  />
                  <span>HSN Code</span>
                </label>
              </div>
            </div>

            {/* 3. Products & Copies Management */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                  3. Quantities & Copies
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSetAllQuantities(1)}
                    className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 hover:text-amber-400"
                    title="Set 1 copy per product"
                  >
                    1 Each
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllQuantities(4)}
                    className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 hover:text-amber-400"
                    title="Set 4 copies per product"
                  >
                    4 Each
                  </button>
                  <button
                    type="button"
                    onClick={handleSetByStock}
                    className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 hover:text-amber-400"
                    title="Match physical stock count"
                  >
                    By Stock
                  </button>
                </div>
              </div>

              {/* Product Quantities List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {productList.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 rounded-lg bg-stone-950/80 border border-stone-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-200 truncate">{p.name}</p>
                      <p className="text-[10px] font-mono text-stone-400">
                        {p.sku} • Stock: <span className="text-amber-400 font-bold">{p.currentStock}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={quantities[p.id] || 1}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            [p.id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-16 px-2 py-1 bg-stone-900 border border-stone-700 rounded text-center text-xs font-mono font-bold text-amber-400"
                      />
                      <span className="text-[10px] text-stone-500">pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary Badge */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-amber-400">Total Labels: {totalLabels}</span>
                {layout.startsWith('a4') && (
                  <p className="text-[10px] text-stone-400">
                    Will print on ~{totalSheets} A4 sheet{totalSheets > 1 ? 's' : ''} ({labelsPerPage} stickers/sheet)
                  </p>
                )}
                {layout.startsWith('thermal') && (
                  <p className="text-[10px] text-stone-400">
                    Continuous roll print • {totalLabels} direct thermal stickers
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>Print Now</span>
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Live Visual Print Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-amber-500" />
                <span>Live Sheet Preview ({totalLabels} Stickers)</span>
              </span>
              <span className="text-[10px] font-mono text-stone-400">Scale: 100% Vector SVG</span>
            </div>

            {/* Preview Viewport Container */}
            <div className="flex-1 bg-stone-950 border border-stone-800 rounded-xl p-3 overflow-y-auto max-h-[520px]">
              {/* PRINT ZONE (Isolated for window.print) */}
              <div
                id="barcode-sticker-print-zone"
                className={`bg-white text-black p-3 mx-auto shadow-xl transition-all ${
                  layout.startsWith('a4') ? 'max-w-xl' : 'max-w-xs'
                }`}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <div
                  className={`grid gap-2 ${
                    layout === 'a4_24' || layout === 'a4_30'
                      ? 'grid-cols-3'
                      : 'grid-cols-1'
                  }`}
                >
                  {allStickers.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="barcode-sticker-unit border border-neutral-300 rounded p-1.5 flex flex-col items-center justify-between text-center bg-white shadow-2xs"
                      style={{
                        minHeight:
                          layout === 'a4_30'
                            ? '85px'
                            : layout === 'thermal_50x25'
                            ? '88px'
                            : '105px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Brand Header */}
                      {options.showBrand && (
                        <div className="text-[8px] font-bold tracking-widest text-neutral-800 uppercase leading-none">
                          CURATED ART
                        </div>
                      )}

                      {/* Product Title */}
                      {options.showName && (
                        <div className="text-[9px] font-semibold text-neutral-900 truncate w-full max-w-[170px] leading-tight mt-0.5">
                          {item.name}
                        </div>
                      )}

                      {/* Vector Barcode SVG */}
                      <div className="my-1 flex justify-center w-full">
                        <BarcodeSvg
                          value={item.barcode || item.sku}
                          width={layout === 'a4_30' ? 140 : 155}
                          height={layout === 'a4_30' ? 32 : 36}
                          showText={true}
                        />
                      </div>

                      {/* Footer Details: SKU, HSN, MRP */}
                      <div className="flex items-center justify-between w-full px-1 text-[8.5px] font-mono border-t border-neutral-200 pt-0.5 leading-tight">
                        <div className="text-left text-neutral-600 truncate max-w-[85px]">
                          {options.showSku && <span>{item.sku}</span>}
                          {options.showHsn && <span className="ml-1">H:{item.hsnCode}</span>}
                        </div>
                        {options.showPrice && (
                          <div className="text-right font-black text-neutral-950 text-[10px]">
                            MRP ₹{item.mrp || item.sellingPrice}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3 border-t border-stone-800 flex items-center justify-between bg-stone-900/90 shrink-0">
          <p className="text-[11px] text-stone-400">
            Tip: In the print dialog, set <strong className="text-stone-300">Margins: None</strong> and enable <strong className="text-stone-300">Background Graphics</strong>.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalLabels} Sticker{totalLabels > 1 ? 's' : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
