import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Check,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';

export default function ImportModal({ isOpen, onClose, onImported }) {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  // Generate and download a formatted Excel template with sample products
  const downloadSampleTemplate = () => {
    try {
      const sampleData = [
        {
          'Product Name': 'Antique Brass Moroccan Urli',
          'Category': 'Brass & Metal Décor',
          'SKU': 'CA-BRASS-001',
          'Barcode': '8908001000017',
          'Purchase Price': 1800,
          'Selling Price': 3200,
          'MRP': 3500,
          'Current Stock': 15,
          'HSN Code': '9701',
          'GST Rate': 18,
        },
        {
          'Product Name': 'Handmade Marble Inlay Platter',
          'Category': 'Marble Accents',
          'SKU': 'CA-MARBLE-002',
          'Barcode': '8908001000024',
          'Purchase Price': 2400,
          'Selling Price': 4500,
          'MRP': 4800,
          'Current Stock': 8,
          'HSN Code': '6802',
          'GST Rate': 18,
        },
        {
          'Product Name': 'Teak Wood Carved Wall Panel',
          'Category': 'Wall Décor',
          'SKU': 'CA-WOOD-003',
          'Barcode': '8908001000031',
          'Purchase Price': 4200,
          'Selling Price': 7900,
          'MRP': 8500,
          'Current Stock': 5,
          'HSN Code': '4420',
          'GST Rate': 12,
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);
      ws['!cols'] = [
        { wch: 34 }, // Name
        { wch: 22 }, // Category
        { wch: 18 }, // SKU
        { wch: 18 }, // Barcode
        { wch: 16 }, // Purchase Price
        { wch: 16 }, // Selling Price
        { wch: 12 }, // MRP
        { wch: 14 }, // Stock
        { wch: 12 }, // HSN
        { wch: 10 }, // GST
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, 'Curated_Art_Product_Import_Template.xlsx');
    } catch (err) {
      console.error('Failed to generate template:', err);
      alert('Could not download template: ' + err.message);
    }
  };

  // Process 2D array of raw rows from Excel (.xlsx/.xls) or CSV
  const processRawRows = (rows, sourceName = '') => {
    try {
      if (!rows || rows.length < 2) {
        throw new Error('File must contain at least a header row and 1 data row.');
      }

      // 1. Locate header row
      let headerRowIndex = -1;
      let headers = [];

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const candidate = (rows[i] || []).map((c) => String(c || '').trim().toLowerCase());
        const hasName = candidate.some((c) => c.includes('name') || c.includes('product') || c.includes('item') || c.includes('desc') || c === 'title' || c === 'particulars');
        const hasPriceOrSku = candidate.some((c) => c.includes('sku') || c.includes('price') || c.includes('rate') || c.includes('stock') || c.includes('qty'));

        if (hasName && (hasPriceOrSku || candidate.length >= 2)) {
          headerRowIndex = i;
          headers = candidate;
          break;
        }
      }

      if (headerRowIndex === -1) {
        // Fallback to first row
        headerRowIndex = 0;
        headers = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase());
      }

      // 2. Identify column indices
      let colName = -1;
      let colCategory = -1;
      let colSku = -1;
      let colBarcode = -1;
      let colPurchase = -1;
      let colSelling = -1;
      let colMrp = -1;
      let colStock = -1;
      let colHsn = -1;
      let colGst = -1;

      headers.forEach((h, idx) => {
        if (colName === -1 && (h.includes('name') || h.includes('item') || h.includes('product') || h.includes('desc') || h === 'title' || h === 'particulars')) {
          colName = idx;
        } else if (colCategory === -1 && (h.includes('cat') || h.includes('group') || h.includes('type'))) {
          colCategory = idx;
        } else if (colSku === -1 && (h.includes('sku') || h.includes('code') || h.includes('model'))) {
          colSku = idx;
        } else if (colBarcode === -1 && (h.includes('bar') || h.includes('ean') || h.includes('upc'))) {
          colBarcode = idx;
        } else if (colPurchase === -1 && (h.includes('cost') || h.includes('pur') || h.includes('buy'))) {
          colPurchase = idx;
        } else if (colSelling === -1 && (h.includes('sell') || h.includes('sale') || h.includes('rate') || h.includes('price') || h === 'mrp')) {
          colSelling = idx;
        } else if (colMrp === -1 && h.includes('mrp')) {
          colMrp = idx;
        } else if (colStock === -1 && (h.includes('stock') || h.includes('qty') || h.includes('quantity') || h.includes('balance') || h.includes('count'))) {
          colStock = idx;
        } else if (colHsn === -1 && (h.includes('hsn') || h.includes('sac'))) {
          colHsn = idx;
        } else if (colGst === -1 && (h.includes('gst') || h.includes('tax'))) {
          colGst = idx;
        }
      });

      // Default name to column 0 if still not detected
      if (colName === -1 && headers.length > 0) colName = 0;

      // 3. Parse data rows
      const parsed = [];
      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const nameVal = String(row[colName] || '').trim();
        if (!nameVal) continue; // Skip empty rows

        const skuVal = colSku !== -1 ? String(row[colSku] || '').trim() : '';
        const barcodeVal = colBarcode !== -1 ? String(row[colBarcode] || '').replace(/['"\s]/g, '') : '';
        const catVal = colCategory !== -1 ? String(row[colCategory] || '').trim() : 'General';
        
        const purVal = colPurchase !== -1 ? parseFloat(String(row[colPurchase]).replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const sellVal = colSelling !== -1 ? parseFloat(String(row[colSelling]).replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const mrpVal = colMrp !== -1 ? parseFloat(String(row[colMrp]).replace(/[^0-9.-]+/g, '')) || sellVal : sellVal;
        const stockVal = colStock !== -1 ? parseInt(String(row[colStock]).replace(/[^0-9-]+/g, ''), 10) || 0 : 0;
        const hsnVal = colHsn !== -1 ? String(row[colHsn] || '').trim() : '';
        const gstVal = colGst !== -1 ? parseFloat(String(row[colGst]).replace(/[^0-9.-]+/g, '')) || 18 : 18;

        parsed.push({
          name: nameVal,
          sku: skuVal || undefined,
          barcode: barcodeVal || undefined,
          category: catVal || 'General',
          purchasePrice: purVal,
          sellingPrice: sellVal,
          mrp: mrpVal || sellVal,
          currentStock: Math.max(0, stockVal),
          hsnCode: hsnVal || '9701',
          gstRate: gstVal,
        });
      }

      if (parsed.length === 0) {
        throw new Error('No valid product rows detected. Please check your Excel column headers.');
      }

      setParsedRows(parsed);
      setError('');
    } catch (err) {
      console.error('File parsing error:', err);
      setError(err.message || 'Failed to read file format.');
      setParsedRows([]);
    }
  };

  // Handle .xlsx, .xls, .csv, .tsv upload via FileReader + SheetJS
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setResult(null);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        if (!buffer) return;

        // SheetJS parses binary .xlsx, .xls, .csv, and .tsv automatically
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetNames = workbook.SheetNames;

        if (!sheetNames || sheetNames.length === 0) {
          throw new Error('No sheets found in this Excel workbook.');
        }

        const activeSheetName = sheetNames[0];
        setSheetName(activeSheetName);

        const worksheet = workbook.Sheets[activeSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        processRawRows(rows, file.name);
      } catch (err) {
        console.error('Excel upload read error:', err);
        setError('Could not parse Excel file: ' + (err.message || 'Invalid or corrupted format'));
        setParsedRows([]);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle manual paste (tab-separated from Excel or comma-separated CSV)
  const handlePasteChange = (e) => {
    const text = e.target.value;
    setCsvText(text);

    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    // Detect delimiter: tab (\t) or comma (,)
    const firstLine = lines[0] || '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    const rows = lines.map((l) => {
      if (delimiter === '\t') return l.split('\t');
      return (l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || l.split(',')).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    });

    setFileName('Pasted Clipboard Data');
    processRawRows(rows, 'Pasted Data');
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
      if (onImported) onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-500" />
              <span>Bulk Import Products (Excel & CSV)</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Upload existing catalog from Microsoft Excel (.xlsx / .xls) or CSV with automatic barcode generation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Import Succeeded: {result.importedCount} products added to catalog!</span>
              </div>
              {result.errorsCount > 0 && (
                <p className="text-amber-400 text-[11px]">
                  {result.errorsCount} duplicate SKUs were skipped to protect existing inventory.
                </p>
              )}
            </div>
          )}

          {/* Upload Drop Zone & Sample Template */}
          <div className="border-2 border-dashed border-stone-700 hover:border-amber-500/80 rounded-2xl p-6 text-center transition-colors bg-stone-950/50">
            <input
              type="file"
              accept=".xlsx, .xls, .csv, .tsv"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-file-input"
            />
            <label htmlFor="excel-file-input" className="cursor-pointer block">
              <FileSpreadsheet className="w-10 h-10 text-amber-500 mx-auto mb-2.5" />
              <p className="text-sm font-semibold text-stone-100">
                Click to select your <span className="text-amber-400 font-mono">.xlsx</span> / <span className="text-amber-400 font-mono">.xls</span> or <span className="text-amber-400 font-mono">.csv</span> file
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                Supported columns: Product Name, Category, SKU, Barcode, Purchase Price, Selling Price, MRP, Current Stock, HSN, GST Rate
              </p>
            </label>

            {/* Template Download & File Status */}
            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 text-amber-400 hover:text-amber-300 border border-stone-800 hover:border-amber-500/50 transition-colors flex items-center gap-1.5 font-medium text-[11px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample .xlsx Template</span>
              </button>

              {fileName && (
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Loaded: {fileName} ({parsedRows.length} items)
                </span>
              )}
            </div>
          </div>

          {/* Direct Paste Box */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Or Paste Directly from Excel / CSV:
            </label>
            <textarea
              rows={3}
              value={csvText}
              onChange={handlePasteChange}
              placeholder="Copy cells in Excel and paste here (Name, Category, SKU, PurchasePrice, SellingPrice, Stock)..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-200 font-mono text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Preview: {parsedRows.length} Products Detected
                </h4>
                <span className="text-[11px] text-stone-400 font-mono">
                  Auto-generates barcode & SKU if left blank
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto border border-stone-800 rounded-xl bg-stone-950 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Product Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Barcode</th>
                      {isAdmin && <th className="px-3 py-2 text-right">Cost (₹)</th>}
                      <th className="px-3 py-2 text-right">Selling (₹)</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800 text-stone-300">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-stone-900/60">
                        <td className="px-3 py-1.5 font-medium text-stone-100">{r.name}</td>
                        <td className="px-3 py-1.5 text-stone-400">{r.category || 'General'}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-amber-400">{r.sku || 'Auto-SKU'}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-stone-400">{r.barcode || 'Auto-EAN13'}</td>
                        {isAdmin && <td className="px-3 py-1.5 text-right font-mono">₹{r.purchasePrice || 0}</td>}
                        <td className="px-3 py-1.5 text-right font-mono text-amber-400 font-bold">₹{r.sellingPrice || 0}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-emerald-400">{r.currentStock || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  Showing first 10 of {parsedRows.length} items... All {parsedRows.length} items will be imported.
                </p>
              )}
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || parsedRows.length === 0}
              onClick={handleImportSubmit}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs tracking-wide hover:bg-amber-400 transition-colors shadow-lg shadow-amber-950/40 disabled:opacity-40"
            >
              {loading ? 'Importing Products...' : `Confirm & Import ${parsedRows.length} Products`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
