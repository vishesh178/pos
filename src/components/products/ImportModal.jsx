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
  Camera,
  Image as ImageIcon,
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
  const [progress, setProgress] = useState(null); // { current, total, percent }
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
  const processRawRows = (rows, sourceName = '', bookFiles = null) => {
    try {
      if (!rows || rows.length < 2) {
        throw new Error('File must contain at least a header row and 1 data row.');
      }

      // 1. Extract embedded images from OpenXML drawings if present in .xlsx
      const rowToImage = {};
      if (bookFiles) {
        try {
          const drawingFile = bookFiles['xl/drawings/drawing1.xml'];
          const relsFile = bookFiles['xl/drawings/_rels/drawing1.xml.rels'];

          if (drawingFile && relsFile) {
            const decoder = new TextDecoder('utf-8');
            const relsXml = decoder.decode(relsFile.content);
            const relMap = {};
            const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
            let rm;
            while ((rm = relRegex.exec(relsXml)) !== null) {
              relMap[rm[1]] = rm[2].replace(/^(\.\.\/)+/, 'xl/');
            }

            const drawingXml = decoder.decode(drawingFile.content);
            const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
            let aMatch;
            while ((aMatch = anchorRegex.exec(drawingXml)) !== null) {
              const block = aMatch[0];
              const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
              const blipMatch = block.match(/<a:blip[^>]*r:embed="([^"]+)"/);
              if (rowMatch && blipMatch) {
                const rowIdx = parseInt(rowMatch[1], 10);
                const rId = blipMatch[1];
                const mediaPath = relMap[rId];
                if (mediaPath && bookFiles[mediaPath]) {
                  const content = bookFiles[mediaPath].content;
                  const ext = mediaPath.endsWith('.jpeg') || mediaPath.endsWith('.jpg') ? 'jpeg' : 'png';
                  
                  // Convert Uint8Array to base64 safely in chunks
                  const bytes = new Uint8Array(content);
                  let binary = '';
                  const chunkSize = 8192;
                  for (let ci = 0; ci < bytes.length; ci += chunkSize) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(ci, Math.min(ci + chunkSize, bytes.length)));
                  }
                  rowToImage[rowIdx] = `data:image/${ext};base64,${btoa(binary)}`;
                }
              }
            }
          }
        } catch (imgErr) {
          console.warn('Embedded image extraction note:', imgErr);
        }
      }

      // 2. Locate header row (skip report headers like "Item List", look for row with product name and other attributes)
      let headerRowIndex = -1;
      let headers = [];

      for (let i = 0; i < Math.min(25, rows.length); i++) {
        const candidate = (rows[i] || []).map((c) => String(c || '').trim().toLowerCase());
        const nonEmpty = candidate.filter((c) => c.length > 0);
        if (nonEmpty.length < 3) continue; // Skip single titles or empty metadata rows

        const hasName = candidate.some((c) => c.includes('product') || (c.includes('name') && !c.includes('file')) || c === 'item' || c.includes('particular') || c.includes('desc'));
        const hasOther = candidate.some((c) => c.includes('cost') || c.includes('price') || c.includes('rate') || c.includes('stock') || c.includes('group') || c.includes('category') || c.includes('code') || c.includes('sku') || c.includes('ordinal') || c.includes('sale') || c.includes('mrp'));

        if (hasName && hasOther) {
          headerRowIndex = i;
          headers = candidate;
          break;
        }
      }

      if (headerRowIndex === -1) {
        // Fallback to first multi-cell row
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const candidate = (rows[i] || []).map((c) => String(c || '').trim().toLowerCase());
          if (candidate.filter((c) => c.length > 0).length >= 2) {
            headerRowIndex = i;
            headers = candidate;
            break;
          }
        }
        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          headers = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase());
        }
      }

      // Check next row in case of two-row headers (e.g. Qty, MRP under Inner Packing)
      const subHeaders = (rows[headerRowIndex + 1] || []).map((c) => String(c || '').trim().toLowerCase());

      // 3. Identify column indices
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
        const subH = subHeaders[idx] || '';
        
        // Skip explicitly ignored columns
        if (h.includes('image file') || h.includes('tot.image') || h.includes('file size') || h.includes('rack') || h.includes('pallet') || h.includes('packing')) {
          return;
        }

        if (colName === -1 && (h === 'item' || h.includes('product') || (h.includes('name') && !h.includes('file')) || h.includes('particulars'))) {
          colName = idx;
        } else if (colSku === -1 && (h === 'item code' || h.includes('sku') || h.includes('ordinal') || (h.includes('code') && !h.includes('main')))) {
          colSku = idx;
        } else if (colCategory === -1 && (h.includes('group') || h.includes('category') || h.includes('cat') || h.includes('type') || h.includes('department'))) {
          colCategory = idx;
        } else if (colBarcode === -1 && (h.includes('bar') || h.includes('ean') || h.includes('upc'))) {
          colBarcode = idx;
        } else if (colPurchase === -1 && (h.includes('cost') || h.includes('purchase') || h.includes('buy price'))) {
          colPurchase = idx;
        } else if (colSelling === -1 && (h.includes('sale') || h.includes('sell') || h.includes('rate') || h === 'price' || (h.includes('price') && !h.includes('cost')) || subH.includes('mrp'))) {
          colSelling = idx;
        } else if (colMrp === -1 && (h.includes('mrp') || subH.includes('mrp'))) {
          colMrp = idx;
        } else if (colStock === -1 && (h.includes('quntity') || h.includes('stock') || h.includes('closing') || h.includes('qty') || h.includes('quantity') || h.includes('balance') || h.includes('count'))) {
          colStock = idx;
        } else if (colHsn === -1 && (h.includes('hsn') || h.includes('sac'))) {
          colHsn = idx;
        } else if (colGst === -1 && (h.includes('gst') || h.includes('tax'))) {
          colGst = idx;
        }
      });

      // Default name to column 0 if still not detected
      if (colName === -1 && headers.length > 0) colName = 0;

      // 4. Parse data rows
      const parsed = [];
      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const nameVal = String(row[colName] || '').trim();
        if (!nameVal) continue; // Skip empty rows

        // Skip subheaders or group separator rows where cost, stock, and sku are all empty
        const rawCost = colPurchase !== -1 ? String(row[colPurchase] || '').trim() : '';
        const rawStock = colStock !== -1 ? String(row[colStock] || '').trim() : '';
        const rawSku = colSku !== -1 ? String(row[colSku] || '').trim() : '';
        if (!rawCost && !rawStock && !rawSku && nameVal.length < 25) {
          // Category separator row (e.g. ",FLOWER,,,,,,")
          continue;
        }

        const skuVal = rawSku || '';
        const barcodeVal = colBarcode !== -1 ? String(row[colBarcode] || '').replace(/['"\s]/g, '') : '';
        
        // Smart category resolution with name prefix detection
        let catVal = colCategory !== -1 ? String(row[colCategory] || '').trim() : '';
        if (!catVal || catVal === 'General') {
          if (nameVal.startsWith('SHP')) catVal = 'Showpieces & Sculptures';
          else if (nameVal.startsWith('FL')) catVal = 'Artificial Flowers';
          else if (nameVal.startsWith('FP')) catVal = 'Flower Pots & Planters';
          else if (nameVal.startsWith('PL')) catVal = 'Artificial Plants';
          else if (nameVal.startsWith('WC')) catVal = 'Wall Clocks';
          else if (nameVal.startsWith('WP')) catVal = 'Wall Art & Paintings';
          else catVal = 'General';
        }

        const purVal = rawCost ? parseFloat(rawCost.replace(/[^0-9.-]+/g, '')) || 0 : 0;
        let sellVal = colSelling !== -1 ? parseFloat(String(row[colSelling]).replace(/[^0-9.-]+/g, '')) || 0 : 0;
        let mrpVal = colMrp !== -1 ? parseFloat(String(row[colMrp]).replace(/[^0-9.-]+/g, '')) || 0 : 0;

        // Smart Price Extraction: If selling price / MRP is 0 or missing, detect A<Price> pattern in name
        // e.g. "FL A115 FL-8" -> 115, "FP A1250 FLOWER POT" -> 1250, "SHP A1050 BK-183" -> 1050
        if (sellVal <= 0 && mrpVal <= 0) {
          const matchA = nameVal.match(/\bA(\d{2,6})\b/i);
          const matchPrefix = nameVal.match(/^(?:FL|FP|PL|SHP|WC|WP|NL|PF|SW)\s+(\d{2,6})\b/i);
          const matchSlash = nameVal.match(/\b(\d{2,6})\//);

          if (matchA) {
            sellVal = parseFloat(matchA[1]);
          } else if (matchPrefix) {
            sellVal = parseFloat(matchPrefix[1]);
          } else if (matchSlash) {
            sellVal = parseFloat(matchSlash[1]);
          } else if (purVal > 0) {
            sellVal = Math.round(purVal * 1.4); // Standard retail markup
          }
        } else if (sellVal <= 0 && mrpVal > 0) {
          sellVal = mrpVal;
        }

        if (mrpVal <= 0) {
          mrpVal = sellVal;
        }

        // Clamp stock to >= 0 (negative closing stock in retail software means pending PO)
        const stockVal = rawStock ? Math.max(0, parseInt(rawStock.replace(/[^0-9-]+/g, ''), 10) || 0) : 0;
        const hsnVal = colHsn !== -1 ? String(row[colHsn] || '').trim() : '';
        const gstVal = colGst !== -1 ? parseFloat(String(row[colGst]).replace(/[^0-9.-]+/g, '')) || 18 : 18;

        // Match image from row index if drawing anchor was found
        const imageBase64 = rowToImage[r] || null;

        parsed.push({
          name: nameVal,
          sku: skuVal || undefined,
          barcode: barcodeVal || undefined,
          category: catVal || 'General',
          purchasePrice: Math.max(0, purVal),
          sellingPrice: Math.max(0, sellVal),
          mrp: Math.max(0, mrpVal),
          currentStock: stockVal,
          hsnCode: hsnVal || '9701',
          gstRate: gstVal,
          imageBase64: imageBase64 || undefined,
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

        // SheetJS parses binary .xlsx with bookFiles: true to retain drawing/media images
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', bookFiles: true });
        const sheetNames = workbook.SheetNames;

        if (!sheetNames || sheetNames.length === 0) {
          throw new Error('No sheets found in this Excel workbook.');
        }

        const activeSheetName = sheetNames[0];
        setSheetName(activeSheetName);

        const worksheet = workbook.Sheets[activeSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        processRawRows(rows, file.name, workbook.files);
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
    const firstLine = lines[0] || '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    const rows = lines.map((l) => {
      if (delimiter === '\t') return l.split('\t');
      return (l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || l.split(',')).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    });

    setFileName('Pasted Clipboard Data');
    processRawRows(rows, 'Pasted Data', null);
  };

  // Chunked batch submission to safely handle large catalogs up to 10,000+ items without network timeouts
  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);

    const BATCH_SIZE = 250;
    let totalImported = 0;
    let totalErrors = 0;

    try {
      for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
        const chunk = parsedRows.slice(i, i + BATCH_SIZE);
        const currentCount = Math.min(i + BATCH_SIZE, parsedRows.length);
        setProgress({
          current: currentCount,
          total: parsedRows.length,
          percent: Math.round((currentCount / parsedRows.length) * 100),
        });

        const res = await fetch('/api/products/bulk-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ items: chunk }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Batch import failed at item ' + i);

        totalImported += data.importedCount || 0;
        totalErrors += data.errorsCount || 0;
      }

      setResult({
        importedCount: totalImported,
        errorsCount: totalErrors,
      });

      if (onImported) onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const imagesCount = parsedRows.filter((r) => !!r.imageBase64).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-500" />
              <span>Bulk Import Products (Excel & CSV)</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Upload existing catalog from Microsoft Excel (.xlsx / .xls) with automatic photo extraction and smart pricing
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
                Supports embedded product photos, Om Tech exports, and standard catalogs (Name, SKU, Cost, Sale Price, Stock)
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
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Loaded: {fileName} ({parsedRows.length} items)
                  </span>
                  {imagesCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[11px] flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      {imagesCount} Photos
                    </span>
                  )}
                </div>
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

          {/* Progress Bar during Batch Upload */}
          {progress && (
            <div className="p-3.5 bg-stone-950 border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Importing into database...
                </span>
                <span className="text-stone-300 font-bold">{progress.percent}%</span>
              </div>
              <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-2 transition-all duration-300 rounded-full shadow-sm shadow-amber-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-400">
                Uploaded {progress.current} of {progress.total} products safely without timeouts
              </p>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Preview: {parsedRows.length} Products Detected
                </h4>
                <div className="flex items-center gap-2">
                  {imagesCount > 0 && (
                    <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      📸 {imagesCount} photos linked automatically
                    </span>
                  )}
                  <span className="text-[11px] text-stone-400 font-mono">
                    Auto-generates barcodes & SKUs if blank
                  </span>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto border border-stone-800 rounded-xl bg-stone-950 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">Photo</th>
                      <th className="px-3 py-2">Product Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">SKU</th>
                      {isAdmin && <th className="px-3 py-2 text-right">Cost (₹)</th>}
                      <th className="px-3 py-2 text-right">Selling (₹)</th>
                      <th className="px-3 py-2 text-right">MRP (₹)</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800 text-stone-300">
                    {parsedRows.slice(0, 15).map((r, i) => (
                      <tr key={i} className="hover:bg-stone-900/60">
                        <td className="px-3 py-1.5 text-center">
                          {r.imageBase64 ? (
                            <img
                              src={r.imageBase64}
                              alt={r.name}
                              className="w-8 h-8 rounded-lg object-cover border border-amber-500/40 mx-auto"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-600 mx-auto">
                              <ImageIcon className="w-4 h-4 opacity-40" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-stone-100">{r.name}</td>
                        <td className="px-3 py-1.5 text-stone-400">{r.category || 'General'}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-amber-400">{r.sku || 'Auto-SKU'}</td>
                        {isAdmin && <td className="px-3 py-1.5 text-right font-mono">₹{r.purchasePrice || 0}</td>}
                        <td className="px-3 py-1.5 text-right font-mono text-amber-400 font-bold">₹{r.sellingPrice || 0}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-stone-400">₹{r.mrp || r.sellingPrice || 0}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-emerald-400">{r.currentStock || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 15 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  Showing first 15 of {parsedRows.length} items... All {parsedRows.length} items will be imported.
                </p>
              )}
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:bg-stone-800 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || parsedRows.length === 0}
              onClick={handleImportSubmit}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs tracking-wide hover:bg-amber-400 transition-colors shadow-lg shadow-amber-950/40 disabled:opacity-40 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Products...</span>
                </>
              ) : (
                <span>Confirm & Import {parsedRows.length} Products</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
