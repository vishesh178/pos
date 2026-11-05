import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  Sparkles,
  Printer,
  RotateCcw,
  Tag,
  AlertCircle,
  Check,
  X,
  FileText,
  Package,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { usePOS } from '../context/POSContext';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/pos/ReceiptModal';
import EstimateModal from '../components/pos/EstimateModal';

const INDIAN_STATES = [
  { name: 'Gujarat', code: '24', isIntra: true },
  { name: 'Maharashtra', code: '27' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'Delhi', code: '07' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Karnataka', code: '29' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Haryana', code: '06' },
  { name: 'Punjab', code: '03' },
  { name: 'West Bengal', code: '19' },
  { name: 'Bihar', code: '10' },
  { name: 'Kerala', code: '32' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Goa', code: '30' },
  { name: 'Assam', code: '18' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Odisha', code: '21' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
];

export default function POSPage() {
  const { token } = useAuth();
  const {
    cart,
    customer,
    setCustomer,
    invoiceDiscount,
    setInvoiceDiscount,
    totals,
    pricebooks,
    activePricebook,
    selectPricebook,
    tierSavings,
    addToCart,
    updateQuantity,
    updateItemDiscount,
    removeFromCart,
    clearCart,
    businessProfile,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'cart'

  // Customer Selection & Search State (F4)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerModalTab, setCustomerModalTab] = useState('search'); // 'search' | 'create'
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobile: '',
    email: '',
    billingAddress: '',
    pincode: '',
    gstin: '',
    gstDate: '',
    panNo: '',
    msmeNo: '',
    state: 'Gujarat',
    stateCode: '24',
    customerType: 'RETAIL',
    pricebookId: '',
    saveToDirectory: true,
  });
  const [newCustomerSubmitting, setNewCustomerSubmitting] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState('');
  const customerSearchInputRef = useRef(null);

  // Payment / Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH', 'UPI', 'CARD', 'SPLIT'
  const [paymentType, setPaymentType] = useState('FULL'); // 'FULL' or 'PARTIAL'
  const [partialAmount, setPartialAmount] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Receipt Modal State
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Estimate Modal State
  const [createdEstimate, setCreatedEstimate] = useState(null);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [estimateSubmitting, setEstimateSubmitting] = useState(false);

  const searchInputRef = useRef(null);

  // Load categories and initial products
  useEffect(() => {
    fetch('/api/products/categories')
      .then((r) => r.json())
      .then((cats) => setCategories(cats))
      .catch((e) => console.error(e));

    performSearch('');
  }, []);

  // Auto-refresh product stock when inventory changes anywhere in the app
  useEffect(() => {
    const handleInventoryChange = () => {
      performSearch(searchQuery);
    };
    window.addEventListener('inventory-updated', handleInventoryChange);
    return () => window.removeEventListener('inventory-updated', handleInventoryChange);
  }, [searchQuery]);

  const performSearch = (q) => {
    setLoadingSearch(true);
    fetch(`/api/pos/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((items) => {
        setSearchResults(items);
        setLoadingSearch(false);
      })
      .catch(() => setLoadingSearch(false));
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    performSearch(val);
  };

  const fetchCustomerDirectory = async (query = '') => {
    setCustomerSearchLoading(true);
    try {
      const url = query.trim()
        ? `/api/customers?search=${encodeURIComponent(query.trim())}`
        : `/api/customers?limit=15`;
      const res = await fetch(url);
      const data = await res.json();
      setCustomerSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load customers for POS:', err);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  const handleOpenCustomerModal = () => {
    setCustomerSearchQuery('');
    setCustomerModalTab('search');
    setNewCustomerError('');
    setIsCustomerModalOpen(true);
    fetchCustomerDirectory('');
  };

  useEffect(() => {
    if (!isCustomerModalOpen || customerModalTab !== 'search') return;
    const delay = setTimeout(() => {
      fetchCustomerDirectory(customerSearchQuery);
    }, 150);
    return () => clearTimeout(delay);
  }, [customerSearchQuery, isCustomerModalOpen, customerModalTab]);

  useEffect(() => {
    if (isCustomerModalOpen && customerModalTab === 'search') {
      setTimeout(() => customerSearchInputRef.current?.focus(), 50);
    }
  }, [isCustomerModalOpen, customerModalTab]);

  const handleSelectCustomer = (c) => {
    setCustomer({
      id: c.id,
      name: c.name,
      mobile: c.mobile || '',
      email: c.email || '',
      billingAddress: c.billingAddress || '',
      shippingAddress: c.shippingAddress || '',
      pincode: c.pincode || '',
      gstin: c.gstin || '',
      gstDate: c.gstDate || '',
      panNo: c.panNo || '',
      msmeNo: c.msmeNo || '',
      state: c.state || 'Gujarat',
      stateCode: c.stateCode || '24',
      customerType: c.customerType || 'RETAIL',
      pricebookId: c.pricebookId || null,
      pricebook: c.pricebook || null,
      currentBalance: c.currentBalance || 0,
    });
    setIsCustomerModalOpen(false);
  };

  const handleResetWalkin = () => {
    setCustomer({
      id: null,
      name: 'Walk-in Retail Customer',
      mobile: '',
      email: '',
      billingAddress: '',
      shippingAddress: '',
      pincode: '',
      gstin: '',
      gstDate: '',
      panNo: '',
      msmeNo: '',
      state: 'Gujarat',
      stateCode: '24',
      customerType: 'RETAIL',
      pricebookId: null,
      pricebook: null,
      currentBalance: 0,
    });
    const def =
      pricebooks.find((p) => p.isDefault) ||
      pricebooks.find((p) => p.code === 'RETAIL') ||
      pricebooks[0];
    if (def) selectPricebook(def);
    setIsCustomerModalOpen(false);
  };

  const handleOpenNewCustomerTab = (seed = '') => {
    setNewCustomerError('');
    const query = (seed || customerSearchQuery || '').trim();
    const isDigits = /^\d+$/.test(query);
    setNewCustomerForm({
      name: isDigits ? '' : query,
      mobile: isDigits ? query : '',
      email: '',
      billingAddress: '',
      pincode: '',
      gstin: '',
      gstDate: '',
      panNo: '',
      msmeNo: '',
      state: 'Gujarat',
      stateCode: '24',
      customerType: 'RETAIL',
      pricebookId: '',
      saveToDirectory: true,
    });
    setCustomerModalTab('create');
  };

  const handleGstinChange = (value) => {
    const g = value.toUpperCase();
    const next = { ...newCustomerForm, gstin: g };

    // Auto-detect State & State Code from first 2 digits
    if (g.length >= 2) {
      const code = g.substring(0, 2);
      const matched = INDIAN_STATES.find((s) => s.code === code);
      if (matched) {
        next.state = matched.name;
        next.stateCode = matched.code;
      }
    }

    // Auto-fill PAN No. (characters 3-12 / index 2-12)
    if (g.length >= 12 && !newCustomerForm.panNo) {
      const extractedPan = g.substring(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(extractedPan)) {
        next.panNo = extractedPan;
      }
    }

    setNewCustomerForm(next);
  };

  const handleCreateCustomerFromPOS = async (e) => {
    e.preventDefault();
    setNewCustomerError('');
    setNewCustomerSubmitting(true);

    try {
      const payload = {
        name: newCustomerForm.name.trim(),
        mobile: newCustomerForm.mobile?.trim() || '-',
        email: newCustomerForm.email?.trim() || null,
        billingAddress: newCustomerForm.billingAddress?.trim() || null,
        pincode: newCustomerForm.pincode?.trim() || null,
        gstin: newCustomerForm.gstin?.trim().toUpperCase() || null,
        gstDate: newCustomerForm.gstDate?.trim() || null,
        panNo: newCustomerForm.panNo?.trim().toUpperCase() || null,
        msmeNo: newCustomerForm.msmeNo?.trim() || null,
        state: newCustomerForm.state || 'Gujarat',
        stateCode: newCustomerForm.stateCode || '24',
        customerType: newCustomerForm.customerType || 'RETAIL',
        pricebookId: newCustomerForm.pricebookId || null,
      };

      if (newCustomerForm.saveToDirectory) {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create customer');

        handleSelectCustomer(data);
      } else {
        setCustomer({
          id: null,
          name: payload.name,
          mobile: payload.mobile,
          email: payload.email || '',
          billingAddress: payload.billingAddress || '',
          shippingAddress: '',
          pincode: payload.pincode || '',
          gstin: payload.gstin || '',
          gstDate: payload.gstDate || '',
          panNo: payload.panNo || '',
          msmeNo: payload.msmeNo || '',
          state: payload.state,
          stateCode: payload.stateCode,
          customerType: payload.customerType,
          pricebookId: payload.pricebookId || null,
          pricebook: pricebooks.find((p) => p.id === payload.pricebookId) || null,
          currentBalance: 0,
        });
        setIsCustomerModalOpen(false);
      }
    } catch (err) {
      setNewCustomerError(err.message);
    } finally {
      setNewCustomerSubmitting(false);
    }
  };

  // Keyboard Shortcuts: F2 focuses search, F4 customer, F8 checkout, Esc closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleOpenCustomerModal();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setCashTendered(totals.grandTotal.toString());
          setIsCheckoutModalOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsCheckoutModalOpen(false);
        setIsCustomerModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, totals.grandTotal]);

  const handleProductPick = (product) => {
    addToCart(product, 1);
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPaymentType('FULL');
    setPartialAmount(totals.grandTotal.toString());
    setCashTendered(totals.grandTotal.toString());
    setCheckoutError('');
    setIsCheckoutModalOpen(true);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutSubmitting(true);

    try {
      const payload = {
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerGstin: customer.gstin,
        customerState: customer.state,
        customerStateCode: customer.stateCode,
        items: cart,
        paymentMethod,
        paidAmount: activePaidAmount,
        invoiceDiscount,
        pricebookId: activePricebook?.id || null,
        pricebookName: activePricebook?.name || null,
      };

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      // 1. Immediate optimistic local stock deduction so UI updates with zero lag
      const purchased = {};
      for (const item of cart) {
        if (item.productId) {
          purchased[item.productId] = (purchased[item.productId] || 0) + item.quantity;
        }
      }
      setSearchResults((prev) =>
        prev.map((p) => (purchased[p.id] ? { ...p, currentStock: p.currentStock - purchased[p.id] } : p))
      );

      setCompletedInvoice(data.invoice);
      setIsCheckoutModalOpen(false);
      setIsReceiptModalOpen(true);
      clearCart();

      // 2. Fetch fresh stock from server to guarantee sync with database
      performSearch(searchQuery);

      // 3. Broadcast inventory update event to the whole application
      window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { invoice: data.invoice } }));
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleCreateEstimate = async () => {
    if (cart.length === 0) return;
    setEstimateSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        customerName: customer.name || 'Walk-in Retail Customer',
        customerMobile: customer.mobile || '',
        customerGstin: customer.gstin || '',
        customerState: customer.state,
        customerStateCode: customer.stateCode,
        items: cart,
        invoiceDiscount,
        pricebookId: activePricebook?.id || null,
        pricebookName: activePricebook?.name || null,
        validityDays: 15,
      };

      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create estimate');

      setCreatedEstimate(data.estimate);
      setIsEstimateModalOpen(true);
    } catch (err) {
      alert('Error creating quotation: ' + err.message);
    } finally {
      setEstimateSubmitting(false);
    }
  };

  const handleConvertEstimateToBill = async (estimate) => {
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentMethod: 'CASH' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');

      setIsEstimateModalOpen(false);
      setCompletedInvoice(data.invoice);
      setIsReceiptModalOpen(true);
      clearCart();

      // Refresh stock from database and notify components
      performSearch(searchQuery);
      window.dispatchEvent(new CustomEvent('inventory-updated', { detail: { invoice: data.invoice } }));
    } catch (err) {
      alert('Failed to convert estimate to bill: ' + err.message);
    }
  };

  const activePaidAmount = paymentType === 'FULL'
    ? totals.grandTotal
    : Math.min(totals.grandTotal, Math.max(0, parseFloat(partialAmount) || 0));
  const activeBalanceDue = Math.max(0, totals.grandTotal - activePaidAmount);
  const tenderNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderNum - activePaidAmount);

  const filteredProducts = activeCategory === 'all'
    ? searchResults
    : searchResults.filter((p) => p.categoryId === activeCategory);

  return (
    <div className="h-[calc(100dvh-150px)] md:h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4 md:gap-5 select-none">
      {/* Mobile View Switcher (Catalog vs Cart) */}
      <div className="md:hidden flex items-center p-1 bg-stone-900 border border-stone-800 rounded-xl shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'catalog'
              ? 'bg-amber-500 text-stone-950 font-bold shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Catalog ({searchResults.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'cart'
              ? 'bg-amber-500 text-stone-950 font-bold shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Cart ({cart.reduce((s, it) => s + it.quantity, 0)})</span>
          {totals.grandTotal > 0 && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                mobileTab === 'cart' ? 'bg-stone-950 text-amber-400 font-bold' : 'bg-amber-500/20 text-amber-400 font-semibold'
              }`}
            >
              ₹{Math.round(totals.grandTotal)}
            </span>
          )}
        </button>
      </div>

      {/* LEFT COLUMN: Product Catalog & Fast Scanner (60%) */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-stone-900/80 border border-stone-800 rounded-2xl p-4 overflow-hidden backdrop-blur-md ${
          mobileTab === 'catalog' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Search & Barcode Scan Bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Scan Barcode (USB Scanner) or Search by Name, SKU (F2)..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-700/80 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500 transition-colors font-sans"
            />
          </div>

          <button
            onClick={() => {
              setSearchQuery('');
              performSearch('');
            }}
            title="Reset search"
            className="p-2.5 rounded-xl bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none shrink-0 mb-3">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-stone-950'
                : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            All Pieces ({searchResults.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loadingSearch ? (
            <div className="flex items-center justify-center h-48 text-stone-400 font-serif text-sm">
              Searching showroom catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-xs">
              <p>No products found matching "{searchQuery}"</p>
              <p className="text-[11px] text-stone-500 mt-1">Try another title, SKU, or scan barcode</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((it) => it.productId === p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleProductPick(p)}
                    className="group bg-stone-950/70 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/60 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-lg relative overflow-hidden"
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 font-mono font-bold text-[10px]">
                        x{inCart.quantity}
                      </span>
                    )}
                    <div>
                      <span className="text-[10px] text-amber-500 font-medium">
                        {p.category?.name || 'Home Décor'}
                      </span>
                      <h4 className="text-xs font-semibold text-stone-100 font-serif line-clamp-2 mt-0.5 group-hover:text-amber-400 transition-colors">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-stone-400 font-mono mt-1">{p.sku}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-amber-400 font-mono">
                          ₹{p.sellingPrice.toFixed(2)}
                        </span>
                        {p.mrp > p.sellingPrice && (
                          <span className="text-[10px] text-stone-400 line-through font-mono ml-1.5">
                            ₹{p.mrp}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          p.currentStock <= p.minStock
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-800'
                            : 'bg-stone-900 text-stone-300'
                        }`}
                      >
                        {p.currentStock} in stock
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile floating quick-cart footer if cart has items */}
        {cart.length > 0 && (
          <div className="md:hidden mt-3 pt-2.5 border-t border-stone-800 flex items-center justify-between shrink-0">
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                {cart.reduce((s, it) => s + it.quantity, 0)} Items Selected
              </p>
              <p className="text-sm font-bold text-amber-400 font-mono">
                ₹{totals.grandTotal.toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => setMobileTab('cart')}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/50"
            >
              <span>View Cart & Bill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Active POS Cart & Billing Panel (40%) */}
      <div
        className={`w-full md:w-[420px] flex flex-col bg-stone-900/90 border border-stone-800 rounded-2xl p-4 overflow-hidden shadow-2xl backdrop-blur-md ${
          mobileTab === 'cart' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Mobile Back to Catalog Button */}
        <div className="md:hidden pb-2 mb-2 border-b border-stone-800 flex items-center justify-between shrink-0">
          <button
            onClick={() => setMobileTab('catalog')}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Back to Catalog</span>
          </button>
          <span className="text-[11px] font-mono text-stone-400">
            {cart.reduce((s, it) => s + it.quantity, 0)} items
          </span>
        </div>
        {/* Customer Header Selector (F4) */}
        <div className="pb-3 border-b border-stone-800 flex items-center justify-between gap-2">
          <div
            onClick={handleOpenCustomerModal}
            className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity flex-1 min-w-0"
            title="Click to search or change customer (F4)"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-stone-100 truncate">
                  {customer.name}
                </p>
                {customer.customerType && customer.customerType !== 'RETAIL' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-amber-950 text-amber-400 border border-amber-800 shrink-0">
                    {customer.customerType === 'WHOLESALE' ? 'Wholesale' : customer.customerType === 'INTERIOR_DESIGNER' ? 'Designer' : 'Corp'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-400 flex items-center gap-1 truncate">
                {customer.mobile && customer.mobile !== '-' ? (
                  <span>Ph: {customer.mobile}</span>
                ) : customer.billingAddress ? (
                  <span className="truncate">📍 {customer.billingAddress}</span>
                ) : (
                  <span>{customer.id ? 'Account' : 'Walk-in'}</span>
                )}
                <span>• [{customer.stateCode || '24'}] {customer.state}</span>
                {customer.currentBalance > 0 && (
                  <span className="text-rose-400 font-bold font-mono">
                    • ⚠️ ₹{customer.currentBalance.toFixed(2)} Due
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {customer.id && (
              <button
                type="button"
                onClick={handleResetWalkin}
                title="Reset to Walk-in Customer"
                className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenCustomerModal}
              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 hover:text-amber-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Search className="w-3 h-3" />
              <span>{customer.id ? 'Change (F4)' : 'Search (F4)'}</span>
            </button>
          </div>
        </div>

        {/* Tiered Pricebook Selector Bar */}
        {pricebooks && pricebooks.length > 0 && (
          <div className="py-2 px-1 border-b border-stone-800/80 bg-stone-950/40 -mx-4 px-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-500" />
                <span>Pricing Tier</span>
              </span>
              {tierSavings > 0 && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Saves ₹{tierSavings.toLocaleString('en-IN')}</span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {pricebooks.map((pb) => {
                const isSelected = activePricebook?.id === pb.id || (!activePricebook && pb.code === 'RETAIL');
                const label = pb.code === 'RETAIL' ? 'Retail' : pb.code === 'DESIGNER' ? 'Designer' : pb.code === 'WHOLESALE' ? 'Wholesale' : pb.code === 'VIP' ? 'VIP' : pb.name.split(' ')[0];
                return (
                  <button
                    key={pb.id}
                    type="button"
                    onClick={() => selectPricebook(pb)}
                    title={`${pb.name} (${pb.discountPercentage}% discount)`}
                    className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-950/40 border border-amber-400'
                        : 'bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800'
                    }`}
                  >
                    <p className="text-[10px] truncate leading-tight font-medium">{label}</p>
                    <p className={`text-[9px] font-mono leading-none mt-0.5 ${isSelected ? 'text-stone-950 font-bold' : 'text-amber-500/80'}`}>
                      {pb.discountPercentage > 0 ? `-${pb.discountPercentage}%` : 'MRP'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400 text-xs py-12">
              <ShoppingCart className="w-8 h-8 text-stone-700 mb-2" />
              <p className="font-semibold text-stone-300">Cart is empty</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Scan an item or pick from the catalog</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className="p-2.5 bg-stone-950/80 border border-stone-800/80 rounded-xl space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div className="pr-2 flex-1">
                    <h5 className="text-xs font-semibold text-stone-100 font-serif leading-tight">
                      {item.productName}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-400">
                      <span className="font-mono">{item.sku}</span>
                      <span>GST: {item.gstRate}%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="p-1 text-stone-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-stone-700 rounded-lg overflow-hidden bg-stone-900">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="px-2 py-1 text-stone-300 hover:bg-stone-800"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-1 font-mono text-xs font-bold text-stone-100">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="px-2 py-1 text-stone-300 hover:bg-stone-800"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price Calculation */}
                  <div className="text-right">
                    <div className="font-mono font-bold text-xs text-amber-400">
                      ₹{(item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {item.mrp && item.mrp > item.unitPrice && (
                        <span className="line-through text-stone-500 mr-1.5">₹{item.mrp.toFixed(2)}</span>
                      )}
                      @ ₹{item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Summary Calculations */}
        <div className="pt-3 border-t border-stone-800 space-y-1.5 text-xs">
          {tierSavings > 0 && (
            <div className="flex justify-between items-center text-emerald-400 text-[11px] bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-900/40">
              <span className="flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>{activePricebook?.name?.split('(')[0] || 'Tier'} Savings:</span>
              </span>
              <span className="font-mono font-bold">-₹{tierSavings.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-stone-400">
            <span>Subtotal:</span>
            <span className="font-mono">₹{totals.subtotal.toFixed(2)}</span>
          </div>

          {/* Bill-level discount input */}
          <div className="flex justify-between items-center text-stone-400">
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-500" />
              <span>Bill Discount (₹):</span>
            </span>
            <input
              type="number"
              min="0"
              value={invoiceDiscount || ''}
              onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-20 px-2 py-0.5 bg-stone-950 border border-stone-700 rounded text-right font-mono text-xs text-amber-400"
            />
          </div>

          {!totals.isInterState ? (
            <div className="flex justify-between text-stone-400 text-[11px]">
              <span>CGST + SGST:</span>
              <span className="font-mono">
                ₹{(totals.cgstTotal + totals.sgstTotal).toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="flex justify-between text-stone-400 text-[11px]">
              <span>IGST (Inter-State):</span>
              <span className="font-mono">₹{totals.igstTotal.toFixed(2)}</span>
            </div>
          )}

          {totals.roundOff !== 0 && (
            <div className="flex justify-between text-stone-400 text-[11px]">
              <span>Round Off:</span>
              <span className="font-mono">
                ₹{totals.roundOff > 0 ? `+${totals.roundOff.toFixed(2)}` : totals.roundOff.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-stone-700">
            <span className="font-bold text-sm text-stone-100 uppercase tracking-wide">Grand Total:</span>
            <span className="font-mono font-black text-xl text-amber-400">
              ₹{totals.grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Checkout & Estimate Buttons */}
        <div className="pt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="p-3 rounded-xl bg-stone-800 text-stone-400 hover:text-rose-400 hover:bg-stone-700 transition-colors disabled:opacity-40 cursor-pointer"
              title="Clear Cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCreateEstimate}
              disabled={cart.length === 0 || estimateSubmitting}
              className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500/50 text-stone-200 hover:text-amber-400 font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              title="Create formal Quotation / Estimate for customer before billing"
            >
              <FileText className="w-4 h-4 text-amber-500" />
              <span>{estimateSubmitting ? 'Creating...' : 'Save as Estimate / Quote'}</span>
            </button>
          </div>
          <button
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            <span>Proceed to Checkout (F8)</span>
          </button>
        </div>
      </div>

      {/* Customer Selection & Search Modal (F4) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl p-4 sm:p-6 my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-100">
                    Select Customer for Billing (F4)
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Search existing directory or register a new customer account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Switcher: Search Directory vs + New Customer */}
            <div className="flex items-center gap-1.5 p-1 bg-stone-950 border border-stone-800 rounded-xl my-3 shrink-0">
              <button
                type="button"
                onClick={() => setCustomerModalTab('search')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  customerModalTab === 'search'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Existing Directory</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenNewCustomerTab(customerSearchQuery)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  customerModalTab === 'create'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ New Customer</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {customerModalTab === 'search' ? (
                /* TAB 1: Search Existing Customer */
                <div className="space-y-3">
                  {/* Search Input Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-3" />
                    <input
                      ref={customerSearchInputRef}
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="Search by name, phone (e.g. 98980), GSTIN, address, PAN..."
                      className="w-full pl-10 pr-9 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
                    />
                    {customerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCustomerSearchQuery('')}
                        className="absolute right-3 top-2.5 text-stone-500 hover:text-stone-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Quick 1-tap Walk-in selection */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950/70 border border-stone-800/80 text-xs">
                    <span className="text-stone-400 text-[11px]">Retail walk-in without account?</span>
                    <button
                      type="button"
                      onClick={handleResetWalkin}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 text-[11px] font-semibold cursor-pointer"
                    >
                      Select Walk-in Default
                    </button>
                  </div>

                  {/* Search Results List */}
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {customerSearchLoading ? (
                      <div className="p-8 text-center text-stone-400 text-xs">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Searching customer directory...
                      </div>
                    ) : customerSearchResults.length === 0 ? (
                      <div className="p-6 text-center text-stone-400 bg-stone-950 rounded-xl border border-stone-800 text-xs space-y-2">
                        <p>No customer found matching "{customerSearchQuery}".</p>
                        <button
                          type="button"
                          onClick={() => handleOpenNewCustomerTab(customerSearchQuery)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Register "{customerSearchQuery}" Now</span>
                        </button>
                      </div>
                    ) : (
                      customerSearchResults.map((c) => {
                        const isSelected = customer.id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500 text-stone-100 shadow-md'
                                : 'bg-stone-950/80 hover:bg-stone-800/80 border-stone-800 text-stone-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-serif font-bold text-sm text-stone-100 truncate">
                                  {c.name}
                                </span>
                                {c.customerType && c.customerType !== 'RETAIL' && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800 shrink-0">
                                    {c.customerType === 'WHOLESALE' ? 'Wholesale' : c.customerType === 'INTERIOR_DESIGNER' ? 'Designer' : 'Corp'}
                                  </span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-stone-900 border border-stone-700 text-stone-300 shrink-0">
                                  [{c.stateCode || '24'}] {c.state || 'Gujarat'}
                                </span>
                                {c.pricebook && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-semibold shrink-0">
                                    {c.pricebook.discountPercentage > 0 ? `-${c.pricebook.discountPercentage}%` : 'MRP'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-stone-400 mt-1">
                                {c.mobile && c.mobile !== '-' ? (
                                  <span className="font-mono text-stone-300">📞 {c.mobile}</span>
                                ) : (
                                  <span className="text-stone-500 font-mono">No phone</span>
                                )}
                                {c.billingAddress && (
                                  <span className="text-stone-300 truncate max-w-[260px]">
                                    📍 {c.billingAddress}{c.pincode ? ` - ${c.pincode}` : ''}
                                  </span>
                                )}
                                {c.gstin && (
                                  <span className="font-mono text-amber-400/90 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.2 rounded text-[10px]">
                                    GST: {c.gstin}
                                  </span>
                                )}
                                {c.panNo && (
                                  <span className="font-mono text-stone-400 text-[10px]">
                                    PAN: {c.panNo}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {c.currentBalance > 0 ? (
                                <div>
                                  <span className="text-xs font-bold font-mono text-rose-400">
                                    ₹{c.currentBalance.toFixed(2)}
                                  </span>
                                  <p className="text-[9px] text-rose-300/80 font-semibold">Due</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 justify-end">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Clear</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* TAB 2: Create New Customer matching Excel */
                <form onSubmit={handleCreateCustomerFromPOS} className="space-y-3.5 text-xs">
                  {newCustomerError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                      {newCustomerError}
                    </div>
                  )}

                  {/* Field 1: Account Name */}
                  <div>
                    <label className="block text-stone-300 font-semibold mb-1">
                      Account / Firm Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.name}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                      placeholder="e.g. AADI ART / Studio Vista Architecture"
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Fields 2 & 3: Billing Address & Pincode */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-stone-300 font-semibold mb-1">Billing Address</label>
                      <input
                        type="text"
                        value={newCustomerForm.billingAddress}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, billingAddress: e.target.value })}
                        placeholder="Showroom / Shop / Street address"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">Pincode</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={newCustomerForm.pincode}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, pincode: e.target.value.replace(/\D/g, '') })}
                        placeholder="395006"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Fields 4 & 5: Mobile Phone (Optional) & Email (Optional) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">Mobile Phone (Optional)</label>
                      <input
                        type="text"
                        value={newCustomerForm.mobile}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, mobile: e.target.value })}
                        placeholder="+91 98765 43210 (Leave blank if none)"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">Email Address (Optional)</label>
                      <input
                        type="email"
                        value={newCustomerForm.email}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                        placeholder="contact@client.com"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Fields 6 & 7: Billing State (Code) & GSTIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">
                        Billing State & Code
                      </label>
                      <select
                        value={newCustomerForm.state}
                        onChange={(e) => {
                          const s = e.target.value;
                          const match = INDIAN_STATES.find((st) => st.name === s);
                          setNewCustomerForm({
                            ...newCustomerForm,
                            state: s,
                            stateCode: match ? match.code : '24',
                          });
                        }}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st.code} value={st.name}>
                            {st.name} ({st.code}{st.code === '24' ? ' - Intra' : ' - Inter'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">
                        GSTIN (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={newCustomerForm.gstin}
                        onChange={(e) => handleGstinChange(e.target.value)}
                        placeholder="24AAAAA0000A1Z5 (Auto-detects State & PAN)"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Fields 8, 9 & 10: PAN No., GST Date, MSME No. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">PAN No.</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={newCustomerForm.panNo}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, panNo: e.target.value.toUpperCase() })}
                        placeholder="ABCDE1234F"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">GST Reg Date</label>
                      <input
                        type="text"
                        value={newCustomerForm.gstDate}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, gstDate: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">MSME / Udyam No.</label>
                      <input
                        type="text"
                        value={newCustomerForm.msmeNo}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, msmeNo: e.target.value })}
                        placeholder="UDYAM-GJ-01-XXXX"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Customer Category & Pricing Tier */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">Customer Category</label>
                      <select
                        value={newCustomerForm.customerType}
                        onChange={(e) => {
                          const t = e.target.value;
                          const next = { ...newCustomerForm, customerType: t };
                          if (t === 'INTERIOR_DESIGNER') {
                            const pb = pricebooks.find((p) => p.code === 'DESIGNER');
                            if (pb) next.pricebookId = pb.id;
                          }
                          setNewCustomerForm(next);
                        }}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                      >
                        <option value="RETAIL">Retail Customer</option>
                        <option value="INTERIOR_DESIGNER">Interior Designer / Architect</option>
                        <option value="CORPORATE">Corporate / Hotel Decor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-stone-300 font-semibold mb-1">Pricing Tier</label>
                      <select
                        value={newCustomerForm.pricebookId}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, pricebookId: e.target.value })}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-amber-400 font-medium text-xs focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Default Retail Tier</option>
                        {pricebooks.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.discountPercentage > 0 ? `-${p.discountPercentage}%` : 'MRP'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCustomerForm.saveToDirectory}
                      onChange={(e) =>
                        setNewCustomerForm({ ...newCustomerForm, saveToDirectory: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-amber-500 bg-stone-950 border-stone-700"
                    />
                    <span className="text-stone-300 text-xs font-semibold">
                      Save to Customer Directory for future visits
                    </span>
                  </label>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-800">
                    <button
                      type="button"
                      onClick={() => setCustomerModalTab('search')}
                      className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
                    >
                      Back to Search
                    </button>
                    <button
                      type="submit"
                      disabled={newCustomerSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40 disabled:opacity-50 cursor-pointer"
                    >
                      {newCustomerSubmitting ? 'Saving...' : 'Add & Select for Bill'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout / Payment Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-serif font-bold text-lg text-stone-100">POS Checkout & Payment</h3>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkoutError && (
              <div className="my-3 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="space-y-4 mt-4">
              {/* Grand Total Display */}
              <div className="p-4 bg-stone-950 border border-stone-800 rounded-xl text-center">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Amount Payable</p>
                <p className="text-3xl font-black text-amber-400 font-mono mt-1">
                  ₹{totals.grandTotal.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-400 mt-1">
                  {cart.length} items • {customer.name}
                </p>
              </div>

              {/* Settlement Type (Full vs Partial Payment) */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">Payment Type</label>
                <div className="grid grid-cols-2 gap-2 bg-stone-950 p-1 rounded-xl border border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('FULL');
                      setPartialAmount(totals.grandTotal.toString());
                      setCashTendered(totals.grandTotal.toString());
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentType === 'FULL'
                        ? 'bg-amber-500 text-stone-950 shadow-md'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Full Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('PARTIAL');
                      const half = Math.round(totals.grandTotal * 0.5);
                      setPartialAmount(half.toString());
                      setCashTendered(half.toString());
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentType === 'PARTIAL'
                        ? 'bg-amber-500 text-stone-950 shadow-md'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Partial / Advance Payment
                  </button>
                </div>
              </div>

              {/* Partial Amount Input & Live Outstanding Tracker */}
              {paymentType === 'PARTIAL' && (
                <div className="p-3.5 bg-stone-950/90 border border-amber-500/50 rounded-xl space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-amber-400">
                        Amount Received Now (₹)
                      </label>
                      <span className="text-[10px] text-stone-400 font-mono">
                        Total Bill: ₹{totals.grandTotal.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={totals.grandTotal}
                      value={partialAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPartialAmount(val);
                        setCashTendered(val);
                      }}
                      placeholder="Enter amount paid today..."
                      className="w-full px-3.5 py-2 bg-stone-900 border border-amber-500/60 rounded-lg text-amber-300 font-mono text-lg font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Quick percentage chips */}
                  <div className="flex gap-2 text-[11px]">
                    {[0.25, 0.5, 0.75].map((pct) => {
                      const amt = Math.round(totals.grandTotal * pct);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setPartialAmount(amt.toString());
                            setCashTendered(amt.toString());
                          }}
                          className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono cursor-pointer"
                        >
                          {pct * 100}% (₹{amt})
                        </button>
                      );
                    })}
                  </div>

                  {/* Summary Breakdown */}
                  <div className="pt-2 border-t border-stone-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400">Paying Now:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ₹{activePaidAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-stone-400">Balance Due (Pay Later):</span>
                        <p className="text-[10px] text-stone-500 font-sans">Recorded in Customer Account</p>
                      </div>
                      <span className="font-mono font-bold text-base text-rose-400">
                        ₹{activeBalanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {activeBalanceDue > 0 && customer.name === 'Walk-in Retail Customer' && (
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Tip: Press <strong>F4</strong> or click Customer to enter client details so this ₹{activeBalanceDue.toFixed(2)} balance is tracked in their account!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-2">Payment Mode</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'SPLIT', label: 'Split', icon: Layers },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                          paymentMethod === m.id
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : 'border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CASH Tender Calculator */}
              {paymentMethod === 'CASH' && (
                <div className="p-3.5 bg-stone-950/80 border border-stone-800 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">Cash Tendered (₹)</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full px-3.5 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Quick Tender Chips */}
                  <div className="flex gap-2 text-[11px]">
                    {[500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt.toString())}
                        className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono"
                      >
                        ₹{amt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(totals.grandTotal.toString())}
                      className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 font-semibold"
                    >
                      Exact
                    </button>
                  </div>

                  {/* Change Return Calculation */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs">
                    <span className="text-stone-300 font-semibold">Change to Return:</span>
                    <span className="font-mono font-bold text-base text-emerald-400">
                      ₹{changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* UPI Dynamic QR Code */}
              {paymentMethod === 'UPI' && (
                <div className="p-4 bg-stone-950/80 border border-stone-800 rounded-xl text-center space-y-2">
                  <div className="w-36 h-36 bg-white p-2 mx-auto rounded-xl shadow-md flex items-center justify-center">
                    <QrCode className="w-32 h-32 text-black" />
                  </div>
                  <p className="text-xs font-semibold text-stone-200">
                    Scan via PhonePe, GPay, Paytm, or BHIM
                  </p>
                  <p className="font-mono text-[11px] text-amber-500 font-semibold">
                    UPI ID: contact@curatedart.in
                  </p>
                </div>
              )}

              {/* Complete Action */}
              <div className="pt-2 flex justify-end gap-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-300 text-xs font-semibold hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkoutSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-amber-950/50 disabled:opacity-50 cursor-pointer"
                >
                  {checkoutSubmitting
                    ? 'Recording Sale...'
                    : activeBalanceDue > 0
                    ? `Complete Bill (₹${activePaidAmount.toFixed(2)} Paid • ₹${activeBalanceDue.toFixed(2)} Due)`
                    : 'Complete & Print Invoice (Enter)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          performSearch(searchQuery);
        }}
        invoice={completedInvoice}
        businessProfile={businessProfile}
        onNewSale={() => {
          setIsReceiptModalOpen(false);
          performSearch(searchQuery);
          searchInputRef.current?.focus();
        }}
      />

      {/* Printable / Shareable Estimate Modal */}
      <EstimateModal
        isOpen={isEstimateModalOpen}
        onClose={() => setIsEstimateModalOpen(false)}
        estimate={createdEstimate}
        businessProfile={businessProfile}
        onConvertToBill={handleConvertEstimateToBill}
      />
    </div>
  );
}

