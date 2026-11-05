import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Database,
  FileCheck,
  RefreshCw,
  Search,
  Download,
  ShieldCheck,
  Users,
  Truck,
  BookOpen,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';

export default function CustomerImportModal({ isOpen, onClose, onImported }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste'
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [inputText, setInputText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [inSheetDuplicates, setInSheetDuplicates] = useState(0);
  const [previewSearch, setPreviewSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'customers' | 'suppliers' | 'ledgers'
  const [cleanupMisrouted, setCleanupMisrouted] = useState(true); // Default true: reorganize misrouted accounts
  const [overwriteExisting, setOverwriteExisting] = useState(false); // Default false: strictly no duplicates
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Accounting section titles and groups
  const SECTION_HEADERS = [
    'capital',
    'reserve and surplus',
    'loans funds',
    'secured loans',
    'unsecured loans',
    'sundry creditors',
    'sundry creditors / suppliers',
    'other liabilities',
    'current liabilities',
    'current assets',
    'fixed assets',
    'investments',
    'inventories',
    'sundry debtors',
    'sundry debtors / retailer',
    'sundry debtors / wholesaler',
    'sundry debtors / architech',
    'sundry debtors / architect',
    'cash on hand',
    'cash at bank',
    'loans and advances',
    'other current assets',
    'opening stock',
    'purchase stock',
    'trading expenses',
    'profit and loss expenses',
    'sales',
    'closing stock',
    'trading incomes',
    'profit and loss incomes',
    'salary',
    'total',
    'account list',
    'accounting year',
    'balance sheet',
    'trial balance',
    'closing balance',
    'opening balance',
  ];

  // Helper: Classify entity destination based on current section heading & GST
  const classifySection = (secName, gstin) => {
    const s = String(secName || '').toLowerCase().trim();
    if (s.includes('sundry creditor') || s.includes('supplier') || s.includes('vendor')) {
      return {
        targetEntity: 'SUPPLIER',
        customerType: null,
        label: 'Supplier / Vendor',
        badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        dest: 'Suppliers Directory',
        isLedger: false,
      };
    }
    if (s.includes('sundry debtor') || s.includes('debtor')) {
      if (s.includes('wholesal')) {
        return {
          targetEntity: 'CUSTOMER',
          customerType: 'WHOLESALE',
          label: 'Wholesale Partner',
          badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          dest: 'Customer Directory (Wholesale Tier)',
          isLedger: false,
        };
      }
      if (s.includes('architech') || s.includes('architect') || s.includes('designer')) {
        return {
          targetEntity: 'CUSTOMER',
          customerType: 'INTERIOR_DESIGNER',
          label: 'Architect / Designer',
          badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          dest: 'Customer Directory (Designer Tier)',
          isLedger: false,
        };
      }
      return {
        targetEntity: 'CUSTOMER',
        customerType: gstin && gstin.length >= 10 ? 'CORPORATE' : 'RETAIL',
        label: gstin && gstin.length >= 10 ? 'Corporate Buyer' : 'Retail Customer',
        badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dest: 'Customer Directory (Retail)',
        isLedger: false,
      };
    }

    // Any other section (Capital, Loans, Bank, Cash, Expenses, Liabilities, Assets, etc.)
    return {
      targetEntity: 'ACCOUNTING_LEDGER',
      customerType: null,
      label: s.includes('bank')
        ? 'Bank Account'
        : s.includes('cash')
        ? 'Cash Account'
        : s.includes('loan')
        ? 'Loan Account'
        : s.includes('capital')
        ? 'Capital Account'
        : s.includes('expense') || s.includes('salary')
        ? 'Expense Ledger'
        : 'General Ledger',
      badgeColor: 'bg-stone-800 text-amber-300 border-amber-800/40',
      dest: 'Chart of Accounts (General Ledger)',
      isLedger: true,
    };
  };

  if (!isOpen) return null;

  // Download exact matching sample Excel template (.xlsx) with all 10 customer fields
  const handleDownloadSample = () => {
    try {
      const sampleRows = [
        {
          'Account Name': 'MEGASTAR TOURS AND TRAVELS',
          Address: 'AMROLI, SURAT',
          'Mobile Nos.': '9879200001',
          State: 'Gujarat',
          'State Code': '24',
          Pincode: '394107',
          'GST No.': '',
          'GST Date': '',
          'PAN No.': '',
          'MSME No.': '',
        },
        {
          'Account Name': 'A P TRADING',
          Address: '301, SHALIMAR GUEST HOUSE, 3RD FLOOR',
          'Mobile Nos.': '9820012345',
          State: 'Maharashtra',
          'State Code': '27',
          Pincode: '400001',
          'GST No.': '27AGVPP1698Q1Z0',
          'GST Date': '01/07/2017',
          'PAN No.': 'AGVPP1698Q',
          'MSME No.': 'UDYAM-MH-01-0012345',
        },
        {
          'Account Name': 'AADI ART',
          Address: 'CHAMPA COLONY, KANJARI-NADIAD',
          'Mobile Nos.': '9925080873',
          State: 'Gujarat',
          'State Code': '24',
          Pincode: '387325',
          'GST No.': '24APDPP1426P1ZP',
          'GST Date': '01/07/2017',
          'PAN No.': 'APDPP1426P',
          'MSME No.': '',
        },
        {
          'Account Name': 'P P SAVANI SCHOOL',
          Address: 'HIRABAUG, VARACHHA, SURAT',
          'Mobile Nos.': '',
          State: 'Gujarat',
          'State Code': '24',
          Pincode: '395006',
          'GST No.': '',
          'GST Date': '',
          'PAN No.': '',
          'MSME No.': '',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Account List');
      XLSX.writeFile(wb, 'Customer_Account_List_Template.xlsx');
    } catch (err) {
      console.error('Failed to export sample template:', err);
    }
  };

  // Core parser for 2D array of rows from Excel or TSV with Section Routing
  const processRawRows = (rows, sourceName = '') => {
    try {
      if (!rows || rows.length === 0) {
        setError('The file or pasted content appears empty.');
        setParsedRows([]);
        setInSheetDuplicates(0);
        return;
      }

      // Step 1: Detect header row (within first 25 rows)
      let headerIndex = -1;
      let headerCols = [];

      for (let i = 0; i < Math.min(rows.length, 25); i++) {
        const r = rows[i].map((c) => String(c ?? '').trim().toLowerCase());
        if (
          r.some(
            (c) =>
              c.includes('account name') ||
              c.includes('party name') ||
              c.includes('customer name') ||
              c === 'account' ||
              c === 'customer' ||
              c === 'party' ||
              c === 'name'
          )
        ) {
          headerIndex = i;
          headerCols = r;
          break;
        }
      }

      let nameCol = -1;
      let addressCol = -1;
      let mobileCol = -1;
      let stateCol = -1;
      let stateCodeCol = -1;
      let pincodeCol = -1;
      let gstinCol = -1;
      let gstDateCol = -1;
      let panCol = -1;
      let msmeCol = -1;

      if (headerIndex !== -1) {
        headerCols.forEach((h, idx) => {
          if (
            h.includes('account name') ||
            h.includes('party name') ||
            h.includes('customer name') ||
            h === 'account' ||
            h === 'name'
          ) {
            nameCol = idx;
          } else if (h.includes('address') || h.includes('street') || h.includes('location')) {
            addressCol = idx;
          } else if (
            h.includes('mobile') ||
            h.includes('phone') ||
            h.includes('contact') ||
            h.includes('cell')
          ) {
            mobileCol = idx;
          } else if (h.includes('state code') || h.includes('st code')) {
            stateCodeCol = idx;
          } else if (h.includes('state') && !h.includes('code') && !h.includes('date')) {
            stateCol = idx;
          } else if (h.includes('pincode') || h.includes('pin') || h.includes('zip')) {
            pincodeCol = idx;
          } else if (h.includes('gst date') || h.includes('reg date')) {
            gstDateCol = idx;
          } else if ((h.includes('gst') || h.includes('gstin')) && !h.includes('date')) {
            gstinCol = idx;
          } else if (h.includes('pan')) {
            panCol = idx;
          } else if (h.includes('msme') || h.includes('udyam')) {
            msmeCol = idx;
          }
        });
      }

      const startIndex = headerIndex !== -1 ? headerIndex + 1 : 0;
      const accounts = [];
      let currentSection = 'General Ledger';

      // Track duplicate rows inside the sheet to never add duplicates
      const seenNames = new Set();
      const seenMobiles = new Set();
      const seenGstins = new Set();
      let duplicatesFiltered = 0;

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // Clean cells
        const cols = row.map((c) => String(c ?? '').trim());
        const firstCol = (cols[nameCol !== -1 ? nameCol : 0] || '').trim();
        const firstColLower = firstCol.toLowerCase();

        // Skip blank or single-character noise
        if (!firstCol || firstCol.length < 2) continue;

        // Detect section headers (e.g. 'Sundry Creditors / Suppliers', 'Capital', 'Loans Funds', etc.)
        const trailingValues = cols.slice(1).filter((c) => c && c.trim() !== '');
        const isHeaderKeyword = SECTION_HEADERS.some(
          (k) =>
            firstColLower === k ||
            firstColLower.startsWith(k + ' /') ||
            firstColLower.startsWith(k + ':') ||
            firstColLower.startsWith(k + ' -')
        );

        if (isHeaderKeyword && trailingValues.length === 0) {
          currentSection = firstCol;
          continue; // Move to rows within this section
        }

        // Map fields based on detected headers or default 10-column layout:
        let name = firstCol;
        let address = addressCol !== -1 ? (cols[addressCol] || '') : (cols[1] || '');
        let mobile = mobileCol !== -1 ? (cols[mobileCol] || '') : (cols[2] || '');
        let state = stateCol !== -1 ? (cols[stateCol] || '') : (cols[3] || 'Gujarat');
        let stateCode = stateCodeCol !== -1 ? (cols[stateCodeCol] || '') : (cols[4] || '24');
        let pincode = pincodeCol !== -1 ? (cols[pincodeCol] || '') : (cols[5] || '');
        let gstin = gstinCol !== -1 ? (cols[gstinCol] || '') : (cols[6] || '');
        let gstDate = gstDateCol !== -1 ? (cols[gstDateCol] || '') : (cols[7] || '');
        let panNo = panCol !== -1 ? (cols[panCol] || '') : (cols[8] || '');
        let msmeNo = msmeCol !== -1 ? (cols[msmeCol] || '') : (cols[9] || '');

        // Clean Excel number artifacts (e.g. mobile "9925080873.0" -> "9925080873")
        mobile = mobile.replace(/\.0$/, '').trim();
        stateCode = stateCode.replace(/\.0$/, '').trim();
        pincode = pincode.replace(/\.0$/, '').trim();
        gstin = gstin.toUpperCase().trim();
        panNo = panNo.toUpperCase().trim();
        msmeNo = msmeNo.trim();
        gstDate = gstDate.trim();

        // If PAN is empty but GSTIN exists, 10 chars from position 2 are the PAN
        if (!panNo && gstin && gstin.length === 15) {
          panNo = gstin.substring(2, 12);
        }

        // Clean mobile
        if (
          !mobile ||
          mobile === '0' ||
          mobile === '0.0' ||
          mobile.toLowerCase() === 'nan' ||
          mobile === '-'
        ) {
          mobile = '-';
        }

        // Clean state code: pad to 2 digits (e.g. "9" -> "09")
        if (stateCode && /^\d+$/.test(stateCode)) {
          stateCode = stateCode.padStart(2, '0');
        }

        // Infer state code from GSTIN if missing
        if ((!stateCode || stateCode === '00' || stateCode === '24') && gstin && /^\d{2}/.test(gstin)) {
          stateCode = gstin.substring(0, 2);
        }

        // Default state if blank
        if (!state || state.trim() === '') {
          if (stateCode === '27') state = 'Maharashtra';
          else if (stateCode === '09') state = 'Uttar Pradesh';
          else if (stateCode === '07') state = 'Delhi';
          else if (stateCode === '08') state = 'Rajasthan';
          else state = 'Gujarat';
        }

        // Classify entity destination based on current section heading & GST
        const classification = classifySection(currentSection, gstin);

        // In-file duplicate detection: strictly avoid duplicate accounts in the list
        const nameKey = `${classification.targetEntity}:${name.toLowerCase()}`;
        if (seenNames.has(nameKey)) {
          duplicatesFiltered++;
          continue;
        }
        if (mobile !== '-' && seenMobiles.has(mobile)) {
          duplicatesFiltered++;
          continue;
        }
        if (gstin && seenGstins.has(gstin)) {
          duplicatesFiltered++;
          continue;
        }

        seenNames.add(nameKey);
        if (mobile !== '-') seenMobiles.add(mobile);
        if (gstin) seenGstins.add(gstin);

        accounts.push({
          name,
          address,
          mobile,
          state,
          stateCode: stateCode || '24',
          pincode,
          gstin,
          gstDate,
          panNo,
          msmeNo,
          section: currentSection,
          targetEntity: classification.targetEntity,
          customerType: classification.customerType,
          label: classification.label,
          badgeColor: classification.badgeColor,
          dest: classification.dest,
          isLedger: classification.isLedger,
        });
      }

      if (accounts.length === 0) {
        setError('No valid account rows could be detected in this sheet. Please check the column headings.');
        setParsedRows([]);
        setInSheetDuplicates(0);
        return;
      }

      setParsedRows(accounts);
      setInSheetDuplicates(duplicatesFiltered);
      setError('');
      setResult(null);
    } catch (err) {
      console.error('Error processing spreadsheet:', err);
      setError('Failed to parse spreadsheet: ' + err.message);
      setParsedRows([]);
      setInSheetDuplicates(0);
    }
  };

  // Handle .xlsx / .xls / .csv / .tsv file upload via FileReader + SheetJS
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

        // Read binary workbook using SheetJS (supports .xlsx, .xls, .csv, .tsv)
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetNames = workbook.SheetNames;

        if (!sheetNames || sheetNames.length === 0) {
          throw new Error('No sheets found in this Excel file');
        }

        const selectedSheetName = sheetNames[0];
        setSheetName(selectedSheetName);

        const worksheet = workbook.Sheets[selectedSheetName];
        // Convert to 2D array of values
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        processRawRows(rows, file.name);
      } catch (err) {
        console.error('Excel parse failure:', err);
        setError('Could not read Excel file: ' + (err.message || 'Corrupted or unsupported format'));
        setParsedRows([]);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle direct tab-separated paste from clipboard
  const handlePasteChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    const rows = lines.map((l) => l.split('\t'));

    setFileName('Pasted from Excel');
    setSheetName('Clipboard');
    processRawRows(rows, 'Pasted Data');
  };

  // Submit parsed accounts with Smart Section Routing
  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);
    setImportProgress({ current: 0, total: parsedRows.length });

    try {
      const bulkRes = await fetch('/api/customers/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: parsedRows,
          overwriteExisting,
          cleanupMisrouted,
        }),
      });

      const contentType = bulkRes.headers.get('content-type') || '';
      if (bulkRes.ok && contentType.includes('application/json')) {
        const data = await bulkRes.json();
        setResult(data);
        if (onImported) onImported();
        return;
      } else if (!bulkRes.ok && contentType.includes('application/json')) {
        const errData = await bulkRes.json();
        throw new Error(errData.error || 'Bulk import failed');
      } else {
        throw new Error(`Server returned error status ${bulkRes.status}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'An error occurred during import.');
    } finally {
      setLoading(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  // Breakdown statistics for quick filter pill counters
  const customersCount = parsedRows.filter((r) => r.targetEntity === 'CUSTOMER').length;
  const suppliersCount = parsedRows.filter((r) => r.targetEntity === 'SUPPLIER').length;
  const ledgersCount = parsedRows.filter((r) => r.targetEntity === 'ACCOUNTING_LEDGER').length;
  const wholesaleCount = parsedRows.filter((r) => r.customerType === 'WHOLESALE').length;
  const architectCount = parsedRows.filter((r) => r.customerType === 'INTERIOR_DESIGNER').length;
  const retailCount = parsedRows.filter(
    (r) => r.customerType === 'RETAIL' || r.customerType === 'CORPORATE'
  ).length;

  // Filter preview list by active sub-tab and search term
  const filteredPreview = parsedRows.filter((r) => {
    if (filterType === 'customers' && r.targetEntity !== 'CUSTOMER') return false;
    if (filterType === 'suppliers' && r.targetEntity !== 'SUPPLIER') return false;
    if (filterType === 'ledgers' && r.targetEntity !== 'ACCOUNTING_LEDGER') return false;

    if (!previewSearch) return true;
    const q = previewSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.section && r.section.toLowerCase().includes(q)) ||
      (r.address && r.address.toLowerCase().includes(q)) ||
      (r.mobile && r.mobile.includes(q)) ||
      (r.gstin && r.gstin.toLowerCase().includes(q)) ||
      (r.panNo && r.panNo.toLowerCase().includes(q)) ||
      (r.state && r.state.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-5xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-stone-100 flex items-center gap-2">
                <span>Smart Master Account Importer & Router</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 border border-amber-700 text-amber-300 font-semibold">
                  Section-Aware Routing
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Automatically routes Gokul Traders ledger sections: Creditors &rarr; Suppliers, Debtors &rarr; Customers (Retail, Wholesale, Architect), and safely excludes general ledger accounts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-stone-950 border border-stone-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Account Master Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Paste from Excel Cells</span>
          </button>
        </div>

        {/* Tab 1: Direct File Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <label className="border-2 border-dashed border-stone-700 hover:border-amber-500/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-stone-950/40 hover:bg-stone-950/70 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-6 h-6 text-amber-500" />
              </div>
              <p className="font-semibold text-sm text-stone-200">
                Click to select your Account Master <span className="text-amber-400 font-mono">.xlsx</span> file
              </p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-lg">
                Upload your Gokul Traders account list. The parser dynamically reads section headers (Sundry Creditors, Retailers, Wholesalers, Architects, Loans) and routes each entity to its proper directory.
              </p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv, .tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {fileName && (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs">
                <div className="flex items-center gap-2 text-stone-300">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-stone-100">{fileName}</span>
                  {sheetName && (
                    <span className="text-stone-500 text-[11px]">
                      (Sheet: <strong className="text-stone-300">{sheetName}</strong>)
                    </span>
                  )}
                </div>
                <label className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer text-xs flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>Change File</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv, .tsv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Template Download Banner */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
              <div className="flex items-center gap-2 text-stone-300">
                <FileSpreadsheet className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Need a standardized 10-column Excel format? Download our sample template.</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample .xlsx</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Paste from Excel Cells */}
        {activeTab === 'paste' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-300">
              Select cells in your customer Excel, copy (<kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-200">Ctrl+C</kbd> / <kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-200">Cmd+C</kbd>), and paste below:
            </label>
            <textarea
              rows={5}
              value={inputText}
              onChange={handlePasteChange}
              placeholder="Paste table rows directly here from Excel..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
        )}

        {/* Progress Bar during Batch Ingestion */}
        {loading && importProgress.total > 0 && (
          <div className="p-3.5 bg-stone-950 border border-stone-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-300 font-semibold flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span>Routing and saving accounts...</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {importProgress.current} / {importProgress.total}
              </span>
            </div>
            <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-150"
                style={{
                  width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert with Detailed Breakdown */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-300">
                    Master Account Routing Successful!
                  </h4>
                  <p className="text-xs text-stone-300 mt-0.5">{result.message}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0"
              >
                Done
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/60 font-mono text-center">
              <div className="p-2 bg-stone-900/80 rounded-lg border border-stone-800">
                <span className="block text-[10px] text-stone-400 font-sans">Customers</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {result.importedCustomers + (result.updatedCustomers || 0)}
                </span>
                <span className="block text-[9px] text-stone-500 font-sans mt-0.5">
                  Ret: {result.breakdown?.retailers || 0} • Whol: {result.breakdown?.wholesalers || 0} • Arch: {result.breakdown?.architects || 0}
                </span>
              </div>
              <div className="p-2 bg-stone-900/80 rounded-lg border border-stone-800">
                <span className="block text-[10px] text-stone-400 font-sans">Suppliers</span>
                <span className="text-blue-400 font-bold text-sm">
                  {result.importedSuppliers + (result.updatedSuppliers || 0)}
                </span>
                <span className="block text-[9px] text-stone-500 font-sans mt-0.5">
                  Added to Suppliers Tab
                </span>
              </div>
              <div className="p-2 bg-stone-900/80 rounded-lg border border-stone-800">
                <span className="block text-[10px] text-stone-400 font-sans">General Accounts</span>
                <span className="text-amber-400 font-bold text-sm">
                  {result.categorizedLedgers || 0}
                </span>
                <span className="block text-[9px] text-stone-500 font-sans mt-0.5">
                  Saved to Chart of Accounts
                </span>
              </div>
              <div className="p-2 bg-stone-900/80 rounded-lg border border-stone-800">
                <span className="block text-[10px] text-stone-400 font-sans">Reorganized</span>
                <span className="text-stone-300 font-bold text-sm">
                  {result.cleanedMisrouted || 0}
                </span>
                <span className="block text-[9px] text-stone-500 font-sans mt-0.5">
                  Cleaned from Customer list
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Parsed Accounts Table & Import Execution */}
        {parsedRows.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-stone-800">
            {/* Filter Pills / Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-amber-500 text-stone-950 font-bold shadow'
                      : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  All Accounts ({parsedRows.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('customers')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'customers'
                      ? 'bg-emerald-500 text-stone-950 font-bold shadow'
                      : 'bg-stone-950 border border-stone-800 text-emerald-400 hover:border-emerald-700'
                  }`}
                >
                  Customers ({customersCount})
                  <span className="ml-1 text-[10px] opacity-80">
                    ({retailCount} Ret, {wholesaleCount} Whol, {architectCount} Arch)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('suppliers')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'suppliers'
                      ? 'bg-blue-500 text-stone-950 font-bold shadow'
                      : 'bg-stone-950 border border-stone-800 text-blue-400 hover:border-blue-700'
                  }`}
                >
                  Suppliers ({suppliersCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('ledgers')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === 'ledgers'
                      ? 'bg-stone-700 text-stone-100 font-bold shadow'
                      : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  General Accounts ({ledgersCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Search accounts or sections..."
                    className="pl-8 pr-2.5 py-1 bg-stone-950 border border-stone-800 rounded-lg text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Reorganization & Overwrite options bar */}
            <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanupMisrouted}
                  onChange={(e) => setCleanupMisrouted(e.target.checked)}
                  className="rounded bg-stone-900 border-stone-700 text-amber-500 cursor-pointer"
                />
                <span className="font-semibold text-amber-400">Reorganize misrouted accounts:</span>
                <span className="text-stone-400">
                  Moves suppliers & clears loan/capital ledgers previously imported into Customers
                </span>
              </label>

              <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="rounded bg-stone-900 border-stone-700 text-amber-500 cursor-pointer"
                />
                <span>Update address/tier if exists</span>
              </label>
            </div>

            {/* Scrollable Preview Table with Destination Column */}
            <div className="max-h-60 overflow-x-auto overflow-y-auto border border-stone-800 rounded-xl bg-stone-950 text-xs">
              <table className="w-full text-left text-[11px] min-w-[800px]">
                <thead className="bg-stone-900 text-stone-400 uppercase text-[9px] font-bold sticky top-0 border-b border-stone-800">
                  <tr>
                    <th className="p-2.5">Account Name</th>
                    <th className="p-2.5">Target Destination</th>
                    <th className="p-2.5">Address</th>
                    <th className="p-2.5">Mobile</th>
                    <th className="p-2.5">State (Code)</th>
                    <th className="p-2.5">GST No.</th>
                    <th className="p-2.5">PAN No.</th>
                    <th className="p-2.5">Section Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 text-stone-300">
                  {filteredPreview.slice(0, 40).map((r, idx) => (
                    <tr key={idx} className="hover:bg-stone-900/50 transition-colors">
                      <td className="p-2.5 font-semibold text-stone-100 whitespace-nowrap">
                        {r.name}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${r.badgeColor}`}
                        >
                          {r.label}
                        </span>
                        <div className="text-[9px] text-stone-500 mt-0.5">{r.dest}</div>
                      </td>
                      <td className="p-2.5 text-stone-400 truncate max-w-[150px]">
                        {r.address || '-'}
                      </td>
                      <td className="p-2.5 font-mono text-stone-300 whitespace-nowrap">
                        {r.mobile || '-'}
                      </td>
                      <td className="p-2.5 text-stone-300 whitespace-nowrap">
                        {r.state} <span className="text-stone-500 font-mono">({r.stateCode})</span>
                      </td>
                      <td className="p-2.5 font-mono text-stone-300 whitespace-nowrap">
                        {r.gstin || '-'}
                      </td>
                      <td className="p-2.5 font-mono text-amber-400 whitespace-nowrap">
                        {r.panNo || '-'}
                      </td>
                      <td className="p-2.5 text-stone-500 text-[10px] truncate max-w-[120px]">
                        {r.section}
                      </td>
                    </tr>
                  ))}
                  {filteredPreview.length > 40 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-2.5 text-center text-stone-500 text-[10px] italic"
                      >
                        + {filteredPreview.length - 40} more accounts loaded in this category...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-stone-800">
              <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Section routing active: {customersCount} Customers & {suppliersCount} Suppliers
                  will be imported
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleImportSubmit}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40 disabled:opacity-50 cursor-pointer transition-all"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>
                    {loading
                      ? 'Routing & Ingesting...'
                      : `Import ${customersCount} Customers & ${suppliersCount} Suppliers`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
