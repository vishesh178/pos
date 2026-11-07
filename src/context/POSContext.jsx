import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { calculateInvoiceTotals } from '../utils/clientGst';

const POSContext = createContext(null);

export function POSProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({
    id: null,
    name: 'Walk-in Retail Customer',
    mobile: '',
    gstin: '',
    state: 'Gujarat',
    stateCode: '24',
    customerType: 'RETAIL',
    pricebookId: null,
    pricebook: null,
  });
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [pricebooks, setPricebooks] = useState([]);
  const [activePricebook, setActivePricebook] = useState(null);

  // Fetch business profile and pricebook tiers on mount
  useEffect(() => {
    fetch('/api/business/profile')
      .then((res) => res.json())
      .then((data) => setBusinessProfile(data))
      .catch((err) => console.error('Failed to fetch business profile in POS:', err));

    fetch('/api/pricebooks')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPricebooks(data);
          const def = data.find((p) => p.isDefault) || data.find((p) => p.code === 'RETAIL') || data[0];
          setActivePricebook(def);
        }
      })
      .catch((err) => console.error('Failed to load pricebooks in POS:', err));
  }, []);

  const businessStateCode = businessProfile ? businessProfile.stateCode : '24';

  // Switch Active Pricebook Tier & Recalculate Cart Item Rates
  const selectPricebook = useCallback((pb) => {
    if (!pb) return;
    setActivePricebook(pb);
    const discount = pb.discountPercentage || 0;

    setCart((prev) =>
      prev.map((item) => {
        const base = item.mrp || item.unitPrice;
        const newRate = discount > 0 ? Math.round(base * (1 - discount / 100)) : base;
        return {
          ...item,
          unitPrice: newRate,
        };
      })
    );
  }, []);

  // When customer changes, automatically adapt active pricebook if customer has an assigned tier
  const setCustomerAndSyncPricebook = useCallback(
    (newCust) => {
      setCustomer(newCust);
      if (pricebooks.length > 0) {
        if (newCust.pricebookId || newCust.pricebook) {
          const matched = pricebooks.find(
            (p) => p.id === newCust.pricebookId || p.id === newCust.pricebook?.id
          );
          if (matched) {
            selectPricebook(matched);
            return;
          }
        }
        if (newCust.customerType === 'WHOLESALE') {
          const wholesalePb = pricebooks.find((p) => p.code === 'WHOLESALE');
          if (wholesalePb) {
            selectPricebook(wholesalePb);
            return;
          }
        }
        if (newCust.customerType === 'INTERIOR_DESIGNER') {
          const designerPb = pricebooks.find((p) => p.code === 'DESIGNER');
          if (designerPb) {
            selectPricebook(designerPb);
            return;
          }
        }
      }
    },
    [pricebooks, selectPricebook]
  );

  // Add product to cart (or increment quantity if already exists)
  const addToCart = useCallback(
    (product, qty = 1) => {
      setCart((prev) => {
        const existingIdx = prev.findIndex((item) => item.productId === product.id);
        const basePrice = product.mrp || product.sellingPrice || 0;
        const discount = activePricebook?.discountPercentage || 0;
        const calculatedRate =
          discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice;

        if (existingIdx > -1) {
          const next = [...prev];
          const existing = next[existingIdx];
          const newQty = existing.quantity + qty;
          next[existingIdx] = { ...existing, quantity: newQty };
          return next;
        } else {
          return [
            ...prev,
            {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              barcode: product.barcode,
              imageUrl: product.imageUrl || null,
              hsnCode: product.hsnCode || '9701',
              unitPrice: calculatedRate,
              mrp: basePrice,
              quantity: qty,
              discountAmount: 0,
              gstRate: product.gstRate !== undefined ? product.gstRate : 18,
              isTaxInclusive: false,
            },
          ];
        }
      });
    },
    [activePricebook]
  );

  const updateQuantity = (productId, quantity) => {
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: q } : item))
    );
  };

  const updateItemDiscount = (productId, discountAmount) => {
    const d = Math.max(0, parseFloat(discountAmount) || 0);
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, discountAmount: d } : item))
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setInvoiceDiscount(0);
    const def = pricebooks.find((p) => p.isDefault) || pricebooks.find((p) => p.code === 'RETAIL') || null;
    if (def) setActivePricebook(def);
    setCustomer({
      id: null,
      name: 'Walk-in Retail Customer',
      mobile: '',
      gstin: '',
      state: 'Gujarat',
      stateCode: '24',
      customerType: 'RETAIL',
      pricebookId: def?.id || null,
      pricebook: def || null,
    });
  };

  const loadEstimateIntoCart = useCallback(
    (estimate) => {
      if (!estimate) return;
      setCustomer({
        id: estimate.customerId || null,
        name: estimate.customerName || 'Walk-in Retail Customer',
        mobile: estimate.customerMobile || '',
        gstin: estimate.customerGstin || '',
        state:
          estimate.customer?.state ||
          (estimate.placeOfSupply?.includes('-') ? estimate.placeOfSupply.split('-')[1] : 'Gujarat'),
        stateCode:
          estimate.customer?.stateCode ||
          (estimate.placeOfSupply?.includes('-') ? estimate.placeOfSupply.split('-')[0] : '24'),
        customerType: estimate.customer?.customerType || 'RETAIL',
        pricebookId: estimate.pricebookId || null,
      });

      if (estimate.pricebookId && pricebooks.length > 0) {
        const pb = pricebooks.find((p) => p.id === estimate.pricebookId);
        if (pb) setActivePricebook(pb);
      }

      setInvoiceDiscount(estimate.discountTotal || 0);
      if (estimate.items && Array.isArray(estimate.items)) {
        setCart(
          estimate.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            barcode: item.product?.barcode || '',
            imageUrl: item.product?.imageUrl || item.imageUrl || null,
            hsnCode: item.hsnCode || '9701',
            unitPrice: item.unitPrice,
            mrp: item.mrp || item.unitPrice,
            quantity: item.quantity,
            discountAmount: item.discountAmount || 0,
            gstRate: item.taxRate !== undefined ? item.taxRate : 18,
            isTaxInclusive: false,
          }))
        );
      }
    },
    [pricebooks]
  );

  // Hardware Barcode Scanner Keystroke Buffer Listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Ignore normal typing in input/textarea unless it's very fast scanner speed
      const targetTag = e.target.tagName.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      if (e.key === 'Enter') {
        if (buffer.length >= 6) {
          // Barcode scanned!
          e.preventDefault();
          const scannedCode = buffer.trim();
          buffer = '';

          fetch(`/api/pos/search?q=${encodeURIComponent(scannedCode)}`)
            .then((res) => res.json())
            .then((products) => {
              if (products && products.length > 0) {
                addToCart(products[0], 1);
              }
            })
            .catch((err) => console.error('Scanner lookup error:', err));
        } else {
          buffer = '';
        }
      } else if (e.key.length === 1) {
        // Fast sequential keystrokes (< 50ms) indicates a hardware USB scanner
        if (diff < 50 || !isInput) {
          buffer += e.key;
        } else {
          buffer = e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addToCart]);

  // Live calculation of invoice totals
  const totals = calculateInvoiceTotals(cart, {
    businessStateCode,
    customerStateCode: customer.stateCode || businessStateCode,
    invoiceDiscount,
  });

  // Calculate savings compared to original MRP across all items in cart
  const tierSavings = cart.reduce((acc, it) => {
    const mrp = it.mrp || it.unitPrice;
    return acc + Math.max(0, mrp - it.unitPrice) * it.quantity;
  }, 0);

  return (
    <POSContext.Provider
      value={{
        cart,
        customer,
        setCustomer: setCustomerAndSyncPricebook,
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
        loadEstimateIntoCart,
        businessProfile,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) throw new Error('usePOS must be used within a POSProvider');
  return context;
}

