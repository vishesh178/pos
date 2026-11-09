import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Zap,
  ZapOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Barcode,
  ShoppingBag,
  ArrowRight,
  Search,
  Sparkles,
} from 'lucide-react';

// Web Audio API instant chime on successful barcode detection
function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 tone
    osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onProductScanned,
  cartCount = 0,
  cartTotal = 0,
  onReviewCart,
}) {
  const [scannerReady, setScannerReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHttpOrigin, setIsHttpOrigin] = useState(false);
  const [lastScanned, setLastScanned] = useState(null); // { code, product, timestamp, status: 'found'|'not_found' }
  const [manualCode, setManualCode] = useState('');
  const [searchingManual, setSearchingManual] = useState(false);
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScannedTimeRef = useRef({});
  const isProcessingRef = useRef(false);

  // Look up scanned code in backend POS catalog and add to estimate/cart
  const handleLookupAndAdd = useCallback(
    async (rawCode) => {
      const code = String(rawCode || '').trim();
      if (!code) return;

      // Debounce: prevent same code scanning repeatedly within 1.5 seconds
      const now = Date.now();
      const lastTime = lastScannedTimeRef.current[code] || 0;
      if (now - lastTime < 1500) return;
      lastScannedTimeRef.current[code] = now;

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        playScanBeep();
        if (navigator.vibrate) navigator.vibrate(60);

        const res = await fetch(`/api/pos/search?q=${encodeURIComponent(code)}`);
        const items = await res.json();

        if (Array.isArray(items) && items.length > 0) {
          const matched = items[0];
          onProductScanned?.(matched);
          setLastScanned({
            code,
            product: matched,
            status: 'found',
            timestamp: Date.now(),
          });
        } else {
          setLastScanned({
            code,
            product: null,
            status: 'not_found',
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error('Scan lookup error:', err);
        setLastScanned({
          code,
          product: null,
          status: 'error',
          error: err.message,
          timestamp: Date.now(),
        });
      } finally {
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 600);
      }
    },
    [onProductScanned]
  );

  // Snap photo file fallback (works 100% on HTTP and all mobile browsers)
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningPhoto(true);
    setErrorMessage('');

    try {
      const scannerId = 'curated-art-barcode-reader';
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        html5QrCodeRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, false);
      await handleLookupAndAdd(decodedText);
    } catch (err) {
      console.warn('Barcode photo decode error:', err);
      setLastScanned({
        code: 'Photo Tag',
        product: null,
        status: 'not_found',
        timestamp: Date.now(),
      });
    } finally {
      setScanningPhoto(false);
      e.target.value = '';
    }
  };

  // Initialize camera scanner when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setErrorMessage('');
    setLastScanned(null);
    setScannerReady(false);
    setIsHttpOrigin(false);

    const initScanner = async () => {
      // Check if browser allows live camera streaming on this origin
      const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const isSecure = window.isSecureContext || isLocal;

      if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setIsHttpOrigin(true);
          setErrorMessage(
            'Live continuous video requires HTTPS. Use the direct Camera Snap button below (works over local Wi-Fi HTTP):'
          );
        }
        return;
      }

      try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error('No camera found on this device.');
        }

        if (isMounted) setCameras(devices);

        let selectedCam = devices[0].id;
        const rearCamIdx = devices.findIndex(
          (d) =>
            d.label?.toLowerCase().includes('back') ||
            d.label?.toLowerCase().includes('rear') ||
            d.label?.toLowerCase().includes('environment')
        );
        if (rearCamIdx > -1) {
          selectedCam = devices[rearCamIdx].id;
          if (isMounted) setActiveCameraIdx(rearCamIdx);
        }

        const scannerId = 'curated-art-barcode-reader';
        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });

        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(viewfinderWidth * 0.85, 320);
            const height = Math.min(viewfinderHeight * 0.45, 180);
            return { width: Math.round(width), height: Math.round(height) };
          },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          selectedCam,
          config,
          (decodedText) => {
            handleLookupAndAdd(decodedText);
          },
          () => {}
        );

        if (isMounted) {
          setScannerReady(true);
          try {
            const track = html5QrCode.getRunningTrackCameraCapabilities?.();
            if (track && track.torchFeature?.().isSupported?.()) {
              setHasTorch(true);
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to start barcode camera:', err);
        if (isMounted) {
          setIsHttpOrigin(true);
          setErrorMessage(
            'Live video stream is restricted on HTTP. Tap the Camera Snap button below to take a quick photo of the barcode:'
          );
        }
      }
    };

    const timer = setTimeout(initScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        const scanner = html5QrCodeRef.current;
        html5QrCodeRef.current = null;
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
        }
      }
    };
  }, [isOpen, handleLookupAndAdd]);

  // Toggle Torch / Flashlight
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Flip Camera (Front / Back)
  const handleFlipCamera = async () => {
    if (cameras.length <= 1 || !html5QrCodeRef.current) return;
    try {
      const nextIdx = (activeCameraIdx + 1) % cameras.length;
      setActiveCameraIdx(nextIdx);

      const scanner = html5QrCodeRef.current;
      if (scanner.isScanning) {
        await scanner.stop();
      }

      await scanner.start(
        cameras[nextIdx].id,
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
        },
        (decodedText) => handleLookupAndAdd(decodedText),
        () => {}
      );
    } catch (e) {
      console.error('Camera switch error:', e);
    }
  };

  // Manual fallback code submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setSearchingManual(true);
    await handleLookupAndAdd(manualCode.trim());
    setManualCode('');
    setSearchingManual(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-stone-100 animate-in fade-in duration-200">
      {/* Hidden Native Camera Photo Input (Works 100% on HTTP and all devices) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Top Mobile App Bar */}
      <div className="h-14 px-4 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-stone-100 flex items-center gap-1.5">
              <span>Scan Barcode for Quote</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-[10px] text-stone-400">Point phone camera at tag barcode</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                torchOn ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'
              }`}
              title="Toggle Flashlight"
            >
              {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {cameras.length > 1 && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-stone-100 cursor-pointer"
              title="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-stone-100 cursor-pointer"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Section */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black p-4">
        {/* html5-qrcode video viewport container */}
        <div
          id="curated-art-barcode-reader"
          className="w-full max-w-md h-full max-h-[70vh] overflow-hidden flex items-center justify-center"
        />

        {/* Laser HUD Frame Overlay (When Live Video is Running) */}
        {scannerReady && !errorMessage && !isHttpOrigin && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-72 h-44 border-2 border-amber-500/80 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.35)] flex items-center justify-center overflow-hidden">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />

              <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce" />

              <span className="text-[11px] font-mono font-semibold text-amber-300/80 tracking-wider uppercase bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                Align Barcode Here
              </span>
            </div>
          </div>
        )}

        {/* HTTP / Mobile Fallback UI (Instant Camera Snap Button) */}
        {(isHttpOrigin || errorMessage) && (
          <div className="absolute inset-x-4 max-w-sm mx-auto p-6 bg-stone-900 border-2 border-amber-500/50 rounded-3xl text-center space-y-4 shadow-2xl z-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-950/50">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h4 className="font-serif font-bold text-base text-stone-100">
                Snap Barcode with Phone Camera
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed">
                Mobile browsers require HTTPS for live video on local IP (<code className="text-amber-400 font-mono text-[11px] bg-stone-950 px-1 py-0.5 rounded">192.168.1.43</code>).
              </p>
              <p className="text-[11px] text-amber-300/90 font-medium">
                Tap below to open your phone camera and snap the barcode tag:
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanningPhoto}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm tracking-wide shadow-xl shadow-amber-950/60 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>{scanningPhoto ? 'Decoding Barcode...' : 'Open Camera to Snap Barcode'}</span>
            </button>
          </div>
        )}

        {/* Real-time Scan Notification Badge Banner */}
        {lastScanned && (
          <div className="absolute top-4 inset-x-4 max-w-md mx-auto z-30 animate-in slide-in-from-top-4 duration-150">
            {lastScanned.status === 'found' ? (
              <div className="p-3 bg-emerald-950/95 border border-emerald-500/60 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-stone-900 border border-emerald-500/40 overflow-hidden shrink-0 flex items-center justify-center">
                  {lastScanned.product?.imageUrl ? (
                    <img
                      src={lastScanned.product.imageUrl}
                      alt={lastScanned.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Added to Quote (+1)</span>
                  </div>
                  <p className="text-xs font-semibold text-stone-100 truncate">
                    {lastScanned.product?.name}
                  </p>
                  <p className="text-xs font-mono font-bold text-amber-400">
                    ₹{Number(lastScanned.product?.mrp || lastScanned.product?.sellingPrice || 0).toLocaleString('en-IN')}
                    <span className="text-[10px] text-stone-400 font-normal ml-2">SKU: {lastScanned.product?.sku}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-stone-900/95 border border-amber-500/60 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-bold text-amber-300">Barcode Not Found</p>
                  <p className="text-[11px] text-stone-400 truncate">
                    No active product matches <span className="font-mono text-stone-200">{lastScanned.code}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Control & Cart Tray */}
      <div className="p-4 bg-stone-900 border-t border-stone-800 space-y-3 shrink-0">
        {/* Quick Snap & Manual Code Input Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanningPhoto}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-400 hover:text-stone-950 text-xs font-bold shrink-0 transition-colors cursor-pointer"
            title="Snap photo with camera"
          >
            <Camera className="w-4 h-4" />
            <span>Snap Tag</span>
          </button>

          <form onSubmit={handleManualSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type SKU (e.g. BK-2224)..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-xs font-mono focus:outline-none focus:border-amber-500 placeholder:text-stone-500"
              />
            </div>
            <button
              type="submit"
              disabled={searchingManual || !manualCode.trim()}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 text-xs font-semibold cursor-pointer shrink-0"
            >
              {searchingManual ? '...' : 'Add'}
            </button>
          </form>
        </div>

        {/* Live Estimate Summary & Review CTA */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Estimate Cart</p>
              <p className="text-sm font-bold text-stone-100 font-mono truncate">
                {cartCount} {cartCount === 1 ? 'piece' : 'pieces'} • <span className="text-amber-400">₹{cartTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onReviewCart?.();
            }}
            disabled={cartCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-stone-800 disabled:to-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed text-stone-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <span>Review Quote</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
