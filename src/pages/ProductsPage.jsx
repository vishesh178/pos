import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  BookOpen,
  Plus,
  Search,
  Filter,
  Printer,
  Download,
  Upload,
  AlertTriangle,
  Edit2,
  Trash2,
  Tag,
  CheckCircle,
  Camera,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProductModal from '../components/products/ProductModal';
import BarcodePrintModal from '../components/products/BarcodePrintModal';
import ImportModal from '../components/products/ImportModal';
import { compressImageFile } from '../utils/imageCompressor';
import { downloadExportFile } from '../utils/exportDownloader';

export default function ProductsPage() {
  const navigate = useNavigate();
  const { token, hasPermission, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Direct Photo Capture State
  const [uploadingProductId, setUploadingProductId] = useState(null);

  // Modals & Selection state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [barcodeProductsList, setBarcodeProductsList] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const toggleSelectProduct = (id) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (products.length > 0 && selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleOpenBatchBarcodes = () => {
    if (selectedProductIds.size > 0) {
      const selected = products.filter((p) => selectedProductIds.has(p.id));
      setBarcodeProduct(null);
      setBarcodeProductsList(selected);
      setIsBarcodeModalOpen(true);
    } else {
      setBarcodeProduct(null);
      setBarcodeProductsList(products);
      setIsBarcodeModalOpen(true);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/products/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedCategory !== 'all') params.append('categoryId', selectedCategory);
      if (lowStockOnly) params.append('lowStock', 'true');
      params.append('page', String(page));
      params.append('limit', String(pageSize));

      const res = await fetch(`/api/products?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data && data.pagination) {
        setProducts(data.products || []);
        setPagination(data.pagination);
      } else if (Array.isArray(data)) {
        setProducts(data);
        setPagination({ total: data.length, totalPages: 1, page: 1, limit: data.length });
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    const handleInv = () => fetchProducts();
    window.addEventListener('inventory-updated', handleInv);
    return () => window.removeEventListener('inventory-updated', handleInv);
  }, []);

  // When filters or page change, fetch debounced
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [search, selectedCategory, lowStockOnly, page, pageSize]);

  // Reset page to 1 when search or category filter changes
  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    setPage(1);
  };

  const handleToggleLowStock = () => {
    setLowStockOnly((prev) => !prev);
    setPage(1);
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenBarcode = (product) => {
    setBarcodeProduct(product);
    setBarcodeProductsList([product]);
    setIsBarcodeModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete or discontinue "${name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(data.message || 'Product removed');
      fetchProducts();
    } catch (err) {
      alert('Failed to delete product: ' + err.message);
    }
  };

  // Direct 1-tap Camera / Gallery Photo Snap for any product card
  const handleDirectPhotoSnap = async (productId, file) => {
    if (!file) return;
    setUploadingProductId(productId);
    try {
      const base64Data = await compressImageFile(file);
      const res = await fetch('/api/products/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64Data }),
      });
      const data = await res.json();
      if (!data.imageUrl) throw new Error(data.error || 'Image upload failed');

      // Update product image URL in database
      const updateRes = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl: data.imageUrl }),
      });
      if (!updateRes.ok) throw new Error('Failed to update product photo');

      // Update local state immediately
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, imageUrl: data.imageUrl } : p))
      );
    } catch (err) {
      console.error('Direct photo snap error:', err);
      alert('Photo snap error: ' + err.message);
    } finally {
      setUploadingProductId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-serif text-stone-100 flex items-center gap-2">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
            <span>Curated Art Catalog & Décor</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5">
            Wall frames, clocks, planters, direct camera photography, barcode tags & live stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(['ADMIN', 'MANAGER', 'INVENTORY']) && (
            <button
              onClick={handleAddNew}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-md shadow-amber-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Art Piece</span>
            </button>
          )}

          <button
            onClick={handleOpenBatchBarcodes}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              selectedProductIds.size > 0
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-950/40'
                : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-amber-400 hover:border-stone-700'
            }`}
            title="Generate Barcode Labels / Sticker Sheets"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Labels {selectedProductIds.size > 0 ? `(${selectedProductIds.size})` : ''}</span>
          </button>

          <button
            onClick={() => navigate('/wholesale-catalog')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-colors cursor-pointer"
            title="Open Wholesale Rate Sheet"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wholesale</span>
          </button>

          <button
            onClick={() => downloadExportFile('/api/export/products?format=xlsx', 'curated_art_products.xlsx', token)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 hover:border-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Export Products Catalog (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {hasPermission(['ADMIN', 'MANAGER']) && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-stone-100 hover:border-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Import CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 bg-stone-900/90 border border-stone-800 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by title, SKU, barcode, or HSN..."
            className="w-full pl-10 pr-8 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-2.5 text-stone-500 hover:text-stone-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleToggleLowStock}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer shrink-0 ${
              lowStockOnly
                ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="whitespace-nowrap">Low Stock</span>
          </button>
        </div>
      </div>

      {/* MOBILE-FIRST VIEW: Touch-Friendly Product Cards (< 768px) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-stone-400 bg-stone-900 border border-stone-800 rounded-2xl">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading product catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-stone-400 bg-stone-900 border border-stone-800 rounded-2xl text-xs">
            No products found matching filters.
          </div>
        ) : (
          products.map((p) => {
            const isLowStock = p.currentStock <= p.minStock;
            const isUploadingThis = uploadingProductId === p.id;
            return (
              <div
                key={p.id}
                className={`p-3.5 bg-stone-900 border rounded-2xl shadow-lg space-y-3 transition-colors ${
                  selectedProductIds.has(p.id) ? 'border-amber-500/60 bg-amber-950/10' : 'border-stone-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Select Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(p.id)}
                      onChange={() => toggleSelectProduct(p.id)}
                      className="w-4 h-4 rounded text-amber-500 bg-stone-950 border-stone-700 cursor-pointer"
                    />
                  </div>
                  {/* Product Image Thumbnail with Direct Camera Snap */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-stone-950 border border-stone-800 shrink-0 flex items-center justify-center">
                    {isUploadingThis ? (
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    ) : p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=200&q=70';
                        }}
                      />
                    ) : (
                      <Package className="w-8 h-8 text-stone-600" />
                    )}

                    {/* Camera Snap overlay button */}
                    <label
                      className="absolute bottom-1 right-1 p-1 rounded-lg bg-stone-900/90 text-amber-400 border border-amber-500/50 hover:bg-amber-500 hover:text-stone-950 transition-colors cursor-pointer shadow-md"
                      title="Snap photo with camera"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isUploadingThis}
                        onChange={(e) => handleDirectPhotoSnap(p.id, e.target.files?.[0])}
                      />
                    </label>
                  </div>

                  {/* Title, Category & SKU */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-bold text-sm text-stone-100 line-clamp-2 leading-snug">
                      {p.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-amber-400 font-semibold">
                        {p.category?.name || 'Home Décor'}
                      </span>
                      <span className="text-[10px] text-stone-500">HSN: {p.hsnCode}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-stone-400">
                      <span>{p.sku}</span>
                      <span>• {p.barcode}</span>
                    </div>
                  </div>
                </div>

                {/* Price & Stock Status Bar */}
                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold font-mono text-amber-400">
                      ₹{p.sellingPrice.toFixed(2)}
                    </span>
                    {p.mrp > p.sellingPrice && (
                      <span className="text-[11px] font-mono text-stone-500 line-through ml-1.5">
                        ₹{p.mrp.toFixed(2)}
                      </span>
                    )}
                    {isAdmin && p.purchasePrice !== null && p.purchasePrice !== undefined && (
                      <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                        Cost: ₹{p.purchasePrice.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                        p.currentStock <= 0
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : isLowStock
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {p.currentStock} {p.unit}
                    </span>
                    <p className="text-[9px] text-stone-500 mt-0.5">GST: {p.gstRate}%</p>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-1 border-t border-stone-800/80">
                  {/* Direct Camera Photo Snap Button */}
                  <label className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isUploadingThis ? 'Saving...' : p.imageUrl ? 'Change Photo' : 'Snap Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={isUploadingThis}
                      onChange={(e) => handleDirectPhotoSnap(p.id, e.target.files?.[0])}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleEdit(p)}
                    className="py-1.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenBarcode(p)}
                    className="py-1.5 px-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
                    title="Print Barcode Tag"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  {hasPermission(['ADMIN']) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 rounded-xl bg-stone-800 hover:bg-rose-950 text-stone-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW: Full Multi-Column Table (>= 768px) */}
      <div className="hidden md:block bg-stone-900/90 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-900 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedProductIds.size === products.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-950 border-stone-700 cursor-pointer"
                    title="Select All"
                  />
                </th>
                <th className="px-5 py-3.5">Product Title & Category</th>
                <th className="px-4 py-3.5">SKU & Barcode</th>
                {isAdmin && <th className="px-4 py-3.5 text-right">Purchase Cost</th>}
                <th className="px-4 py-3.5 text-right">Selling Price</th>
                <th className="px-4 py-3.5 text-right">MRP</th>
                <th className="px-4 py-3.5 text-center">GST %</th>
                <th className="px-4 py-3.5 text-center">Stock</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80 text-stone-300">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="text-center py-12 text-stone-400 font-serif">
                    Loading showroom products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="text-center py-12 text-stone-400">
                    No décor products found matching your filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLowStock = p.currentStock <= p.minStock;
                  const isUploadingThis = uploadingProductId === p.id;
                  const isSelected = selectedProductIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-stone-800/40 transition-colors ${isSelected ? 'bg-amber-950/10' : ''}`}
                    >
                      <td className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-3.5 h-3.5 rounded text-amber-500 bg-stone-950 border-stone-700 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {/* Image with quick camera upload */}
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-stone-950 border border-stone-800 shrink-0 flex items-center justify-center group">
                            {isUploadingThis ? (
                              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            ) : p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src =
                                    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=100&q=70';
                                }}
                              />
                            ) : (
                              <Package className="w-5 h-5 text-stone-600" />
                            )}
                            <label
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                              title="Update product photo"
                            >
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                disabled={isUploadingThis}
                                onChange={(e) => handleDirectPhotoSnap(p.id, e.target.files?.[0])}
                              />
                            </label>
                          </div>
                          <div>
                            <div className="font-semibold text-stone-100 text-sm font-serif">
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-amber-400 font-medium">
                                {p.category?.name || 'Home Décor'}
                              </span>
                              <span className="text-[10px] text-stone-400">HSN: {p.hsnCode}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-stone-300 text-[11px] font-semibold">{p.sku}</div>
                        <div className="font-mono text-stone-400 text-[10px] mt-0.5">{p.barcode}</div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3.5 text-right font-mono text-stone-400">
                          ₹{p.purchasePrice !== undefined && p.purchasePrice !== null ? p.purchasePrice.toFixed(2) : '0.00'}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-400 text-sm">
                        ₹{p.sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-stone-400 line-through text-[11px]">
                        ₹{p.mrp ? p.mrp.toFixed(2) : p.sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-[10px] font-semibold">
                          {p.gstRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                            p.currentStock <= 0
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : isLowStock
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {p.currentStock} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <label
                            className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-amber-400 hover:bg-stone-700 transition-colors cursor-pointer"
                            title="Snap / Update Photo"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              disabled={isUploadingThis}
                              onChange={(e) => handleDirectPhotoSnap(p.id, e.target.files?.[0])}
                            />
                          </label>
                          <button
                            onClick={() => handleOpenBarcode(p)}
                            title="Print Barcode Labels"
                            className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-amber-400 hover:bg-stone-700 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {hasPermission(['ADMIN', 'MANAGER', 'INVENTORY']) && (
                            <button
                              onClick={() => handleEdit(p)}
                              title="Edit Product"
                              className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-amber-400 hover:bg-stone-700 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasPermission(['ADMIN', 'MANAGER']) && (
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              title="Delete Product"
                              className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-rose-400 hover:bg-stone-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Control Bar */}
      {pagination.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-stone-900 border border-stone-800 rounded-2xl text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-stone-200">{(page - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-stone-200">{Math.min(page * pageSize, pagination.total)}</strong> of{' '}
              <strong className="text-amber-400 font-mono font-bold">{pagination.total.toLocaleString()}</strong> products
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-stone-950 border border-stone-800 rounded-lg text-stone-300 text-xs focus:border-amber-500 cursor-pointer ml-2"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              First
            </button>
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1 font-mono text-stone-200 font-semibold bg-stone-800/80 rounded-lg">
              Page {page} of {pagination.totalPages}
            </span>

            <button
              disabled={page >= pagination.totalPages}
              onClick={() => {
                setPage((p) => Math.min(pagination.totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => {
                setPage(pagination.totalPages);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Modals - Unmounted when closed for zero hook divergence */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          product={selectedProduct}
          onSaved={fetchProducts}
          categories={categories}
        />
      )}

      {isBarcodeModalOpen && (
        <BarcodePrintModal
          isOpen={isBarcodeModalOpen}
          onClose={() => {
            setIsBarcodeModalOpen(false);
            setBarcodeProduct(null);
            setBarcodeProductsList([]);
          }}
          product={barcodeProduct}
          products={barcodeProductsList}
        />
      )}

      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImported={fetchProducts}
        />
      )}
    </div>
  );
}
