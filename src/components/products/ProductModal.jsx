import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Upload, Package, Camera, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { compressImageFile } from '../../utils/imageCompressor';

export default function ProductModal({ isOpen, onClose, product, onSaved, categories }) {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    brand: 'Curated Art',
    imageUrl: '',
    description: '',
    purchasePrice: 0,
    sellingPrice: 0,
    mrp: 0,
    gstRate: 0,
    hsnCode: '9701',
    currentStock: 10,
    minStock: 5,
    unit: 'PCS',
    status: 'ACTIVE',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageProcess = async (file) => {
    if (!file) return;
    setUploadingImage(true);
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
      if (data.imageUrl) {
        setFormData((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      } else {
        setFormData((prev) => ({ ...prev, imageUrl: base64Data }));
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to process image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        brand: product.brand || 'Curated Art',
        imageUrl: product.imageUrl || '',
        description: product.description || '',
        purchasePrice: product.purchasePrice || 0,
        sellingPrice: product.mrp || product.sellingPrice || 0,
        mrp: product.mrp || product.sellingPrice || 0,
        gstRate: product.gstRate !== undefined ? product.gstRate : 0,
        hsnCode: product.hsnCode || '9701',
        currentStock: product.currentStock || 0,
        minStock: product.minStock || 5,
        unit: product.unit || 'PCS',
        status: product.status || 'ACTIVE',
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        categoryId: categories?.[0]?.id || '',
        brand: 'Curated Art',
        imageUrl: '',
        description: '',
        purchasePrice: 1000,
        sellingPrice: 1999,
        mrp: 1999,
        gstRate: 0,
        hsnCode: '9701',
        currentStock: 10,
        minStock: 5,
        unit: 'PCS',
        status: 'ACTIVE',
      });
    }
    setError('');
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const generateAutoSku = async () => {
    const selectedCat = categories.find((c) => c.id === formData.categoryId);
    const catName = selectedCat ? selectedCat.name : 'General';
    try {
      const res = await fetch(`/api/products/generate-sku?categoryName=${encodeURIComponent(catName)}`);
      const data = await res.json();
      if (data.sku) setFormData((prev) => ({ ...prev, sku: data.sku }));
    } catch (err) {
      console.error(err);
    }
  };

  const generateAutoBarcode = async () => {
    try {
      const res = await fetch('/api/products/generate-barcode');
      const data = await res.json();
      if (data.barcode) setFormData((prev) => ({ ...prev, barcode: data.barcode }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const url = isEdit ? `/api/products/${product.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = { ...formData };
      if (!isAdmin) {
        delete payload.purchasePrice;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const productMrp = formData.mrp || formData.sellingPrice || 0;
  const margin = productMrp - formData.purchasePrice;
  const marginPercent =
    productMrp > 0 ? Math.round((margin / productMrp) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/80">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100">
              {isEdit ? 'Edit Product Item' : 'Add New Art & Décor Item'}
            </h3>
            <p className="text-xs text-amber-500">
              {isEdit ? `Updating ${product.sku}` : 'Catalog entry with GST & Zoho mapping'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-6 mb-0 p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">Product Title *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Golden Ginkgo Leaf Handcrafted Metal Art"
              className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Product Image URL & Local Upload / Direct Camera */}
          <div className="p-3 bg-stone-950/60 border border-stone-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-300">
                Product Image & Photography
              </label>
              <span className="text-[10px] text-amber-500 font-medium">Direct camera snap supported</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-900 border border-stone-700 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative">
                {uploadingImage ? (
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=200&q=70';
                    }}
                  />
                ) : (
                  <Package className="w-7 h-7 text-stone-500" />
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer text-xs px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold inline-flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/40">
                    <Camera className="w-4 h-4" />
                    <span>Take Photo (Camera)</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleImageProcess(e.target.files?.[0])}
                    />
                  </label>

                  <label className="cursor-pointer text-xs px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold inline-flex items-center gap-1.5 transition-colors border border-stone-700">
                    <Upload className="w-3.5 h-3.5 text-stone-400" />
                    <span>Gallery / Files</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageProcess(e.target.files?.[0])}
                    />
                  </label>

                  {formData.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={formData.imageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="Or paste external image URL (https://...)"
                  className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Category & Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Brand / Studio</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SKU & Barcode with auto-generators */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-300">SKU Code *</label>
                <button
                  type="button"
                  onClick={generateAutoSku}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Auto-Gen
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="CA-MF-2026-0001"
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-300">EAN-13 Barcode *</label>
                <button
                  type="button"
                  onClick={generateAutoBarcode}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Auto-Gen
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="8908001000017"
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Pricing, Margin & HSN */}
          <div className="p-3.5 bg-stone-950/60 border border-stone-800 rounded-xl space-y-3">
            <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              {isAdmin && (
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-sm font-semibold"
                  />
                </div>
              )}
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">MRP (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.mrp}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, mrp: val, sellingPrice: val });
                  }}
                  className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-sm font-semibold text-amber-400 font-mono"
                />
              </div>
            </div>

            {/* Profit margin indicator - ADMIN only */}
            {isAdmin && (
              <div className="flex items-center justify-between text-xs text-stone-400 pt-1 border-t border-stone-800/80">
                <span>Gross Profit Margin per Unit:</span>
                <span className={`font-semibold font-mono ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{margin.toFixed(2)} ({marginPercent}%)
                </span>
              </div>
            )}
          </div>

          {/* GST & HSN & Unit */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">GST Rate</label>
              <select
                value={formData.gstRate}
                onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
              >
                <option value="0">0% (Exempt)</option>
                <option value="5">5% (Handicrafts/Textiles)</option>
                <option value="12">12% (Artisanal frames)</option>
                <option value="18">18% (Standard Luxury Décor)</option>
                <option value="28">28% (Luxury Glass/Mirrors)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">HSN Code</label>
              <input
                type="text"
                value={formData.hsnCode}
                onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                placeholder="9701"
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Unit of Measure</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="SQFT">SQFT (Square Feet)</option>
                <option value="SQM">SQM (Square Meters)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="SET">SET (Pair / Set)</option>
                <option value="BOX">BOX (Pack)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="ROLL">ROLL (Rolls)</option>
              </select>
            </div>
          </div>

          {/* Stock Quantities (supports decimal quantities e.g. 2635.20) */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                {isEdit ? 'Current Stock' : 'Initial Stock *'}
              </label>
              <input
                type="number"
                step="any"
                disabled={isEdit}
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Low Stock Alert Level</label>
              <input
                type="number"
                step="any"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Item Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DISCONTINUED">DISCONTINUED</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs tracking-wide hover:bg-amber-400 transition-colors shadow-lg shadow-amber-950/40 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Product' : 'Add to Catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

