import React, { useState } from 'react';
import { X, Printer, LayoutGrid, Tag } from 'lucide-react';

export default function BarcodePrintModal({ isOpen, onClose, product }) {
  const [format, setFormat] = useState('thermal'); // 'thermal' or 'a4_sheet'
  const [quantity, setQuantity] = useState(4);

  if (!isOpen || !product) return null;

  const handlePrint = () => {
    window.print();
  };

  const labels = Array.from({ length: quantity }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/80">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-500" />
              <span>Print Barcode Price Tags</span>
            </h3>
            <p className="text-xs text-stone-400">
              {product.name} ({product.sku})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Format Selection & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-2">Print Layout</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('thermal')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                    format === 'thermal'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                      : 'border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Thermal Label</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('a4_sheet')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                    format === 'a4_sheet'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                      : 'border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>A4 Sheet (24-up)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-2">Number of Copies</label>
              <input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-semibold"
              />
              <p className="text-[11px] text-stone-400 mt-1">
                EAN-13: <span className="font-mono text-amber-400">{product.barcode}</span>
              </p>
            </div>
          </div>

          {/* Live Preview Area */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2">Print Preview</label>
            <div className="p-4 bg-stone-950 border border-stone-800 rounded-xl max-h-72 overflow-y-auto">
              <div
                id="printable-barcode-area"
                className={`flex flex-wrap gap-3 justify-center ${
                  format === 'thermal' ? 'max-w-xs mx-auto' : ''
                }`}
              >
                {labels.map((idx) => (
                  <div
                    key={idx}
                    className="w-56 p-3 bg-white text-black rounded-md border border-neutral-300 flex flex-col items-center justify-center text-center shadow-sm select-none"
                    style={{ minHeight: '110px' }}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-800">
                      CURATED ART
                    </div>
                    <div className="text-[11px] font-semibold text-neutral-900 truncate max-w-[200px] leading-tight mt-0.5">
                      {product.name}
                    </div>

                    {/* Barcode Graphic Pattern (Simulated standard EAN pattern) */}
                    <div className="my-1.5 flex flex-col items-center">
                      <div className="h-8 flex items-end gap-[1.5px] px-2 py-0.5 bg-white">
                        {/* Generates alternating barcode line widths from barcode string */}
                        {product.barcode.split('').map((char, cIdx) => {
                          const val = parseInt(char, 10) || 1;
                          const widthClass = val % 2 === 0 ? 'w-[2.5px]' : 'w-[1.5px]';
                          const isTall = cIdx === 0 || cIdx === 6 || cIdx === 12;
                          return (
                            <div
                              key={cIdx}
                              className={`bg-black ${widthClass} ${isTall ? 'h-8' : 'h-7'}`}
                            />
                          );
                        })}
                      </div>
                      <span className="font-mono text-[10px] tracking-widest font-semibold text-black">
                        {product.barcode}
                      </span>
                    </div>

                    <div className="flex items-center justify-between w-full px-1 text-[10px] font-mono border-t border-neutral-300 pt-0.5">
                      <span className="text-neutral-600 font-sans">{product.sku}</span>
                      <span className="font-bold text-neutral-900 text-xs">MRP ₹{product.mrp || product.sellingPrice}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:bg-stone-800 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs tracking-wide hover:bg-amber-400 transition-colors shadow-lg shadow-amber-950/40 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print {quantity} Label{quantity > 1 ? 's' : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

