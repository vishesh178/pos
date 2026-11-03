import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ImportModal({ isOpen, onClose, onImported }) {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const parseCsv = (text) => {
    try {
      const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        // Split with basic CSV regex handling quotes
        const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        const values = match.map((v) => v.trim().replace(/^["']|["']$/g, ''));
        
        const rowObj = {};
        headers.forEach((h, idx) => {
          const val = values[idx] || '';
          if (h.includes('name') || h === 'title') rowObj.name = val;
          else if (h.includes('sku')) rowObj.sku = val;
          else if (h.includes('barcode') || h.includes('ean')) rowObj.barcode = val.replace(/'/g, '');
          else if (h.includes('category')) rowObj.category = val;
          else if (isAdmin && (h.includes('purchase') || h.includes('cost'))) rowObj.purchasePrice = parseFloat(val) || 0;
          else if (h.includes('selling') || h === 'rate' || h === 'price') rowObj.sellingPrice = parseFloat(val) || 0;
          else if (h.includes('mrp')) rowObj.mrp = parseFloat(val) || 0;
          else if (h.includes('stock') || h.includes('qty')) rowObj.currentStock = parseInt(val, 10) || 0;
          else if (h.includes('hsn')) rowObj.hsnCode = val;
          else if (h.includes('gst')) rowObj.gstRate = parseFloat(val) || 18;
        });

        if (rowObj.name) {
          rows.push(rowObj);
        }
      }

      setParsedRows(rows);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to parse CSV format.');
      setParsedRows([]);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: parsedRows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setResult(data);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/80">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              <span>Bulk Import Products (CSV / Excel)</span>
            </h3>
            <p className="text-xs text-stone-400">
              Migrate existing showroom inventory with automatic duplicate checks
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Import Finished: {result.importedCount} products added to catalog</span>
              </div>
              {result.errorsCount > 0 && (
                <p className="text-amber-400">
                  {result.errorsCount} rows skipped due to duplicate SKU or invalid fields.
                </p>
              )}
            </div>
          )}

          {/* Upload Box */}
          <div className="border-2 border-dashed border-stone-700 hover:border-amber-500/60 rounded-xl p-6 text-center transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <FileText className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-200">Click to choose a CSV inventory file</p>
              <p className="text-[11px] text-stone-400 mt-1">
                Headers supported: Name, SKU, Barcode, Category, Purchase Price, Selling Price, MRP, Current Stock, HSN
              </p>
            </label>
          </div>

          {/* Paste or edit CSV text */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Or Paste CSV Data Directly:
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseCsv(e.target.value);
              }}
              placeholder="Name,SKU,Barcode,Category,PurchasePrice,SellingPrice,Stock&#10;Vintage Brass Wall Clock,CA-WC-2026-0008,8908001000086,Wall Clocks,1500,3200,8"
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-200 font-mono text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Preview ({parsedRows.length} items ready to import)
                </h4>
              </div>
              <div className="max-h-48 overflow-y-auto border border-stone-800 rounded-xl bg-stone-950 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Barcode</th>
                      {isAdmin && <th className="px-3 py-2 text-right">Cost (₹)</th>}
                      <th className="px-3 py-2 text-right">Price (₹)</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800 text-stone-300">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-medium">{r.name}</td>
                        <td className="px-3 py-1.5 text-stone-400">{r.category || 'General'}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-amber-500">{r.sku || 'Auto'}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-stone-400">{r.barcode || 'Auto'}</td>
                        {isAdmin && <td className="px-3 py-1.5 text-right font-mono">₹{r.purchasePrice || 0}</td>}
                        <td className="px-3 py-1.5 text-right font-mono text-amber-400">₹{r.sellingPrice || 0}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{r.currentStock || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  Showing first 10 of {parsedRows.length} items...
                </p>
              )}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || parsedRows.length === 0}
              onClick={handleImportSubmit}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs tracking-wide hover:bg-amber-400 transition-colors shadow-lg shadow-amber-950/40 disabled:opacity-50"
            >
              {loading ? 'Importing...' : `Confirm & Import ${parsedRows.length} Items`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

