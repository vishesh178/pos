import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Wifi,
  Copy,
  Check,
  QrCode,
  Share2,
  ExternalLink,
  Sparkles,
  Layers,
  Globe,
  Info,
} from 'lucide-react';

export default function MobileConnectModal({ isOpen, onClose }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/network-info')
        .then((res) => res.json())
        .then((data) => {
          setNetworkInfo(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to get network info:', err);
          // Fallback
          setNetworkInfo({
            primaryUrl: window.location.origin.replace('localhost', '192.168.29.67'),
            primaryIp: '192.168.29.67',
            port: 5001,
          });
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const mobileUrl = networkInfo?.primaryUrl || `http://192.168.29.67:5001`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Scannable QR Code image URL via secure QR generator service with fallback
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    mobileUrl
  )}&bgcolor=ffffff&color=000000&margin=12`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative my-auto"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close mobile connection modal"
          title="Close"
          className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-lg shadow-amber-950/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
              <span>Use Curated Art on Mobile</span>
            </h3>
            <p className="text-xs text-stone-400">
              iPhone, Android, iPad & Tablet live showroom access
            </p>
          </div>
        </div>

        {/* QR Code and Quick URL Box */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-48 h-48 bg-white p-2 mx-auto rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border-2 border-amber-500/30">
            <img
              src={qrCodeUrl}
              alt="Scan to open on phone"
              className="w-full h-full object-contain"
              onError={(e) => {
                // If offline, hide image and show icon with instructions
                e.target.style.display = 'none';
              }}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
              Scan with your Phone Camera or Open:
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono font-bold text-sm text-stone-100 bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-800 select-all">
                {mobileUrl}
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="mt-6 space-y-3 text-xs">
          <h4 className="font-semibold text-stone-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-amber-500" />
            <span>Quick Setup (Same Wi-Fi Network)</span>
          </h4>

          <ol className="space-y-2.5 text-stone-300 pl-1">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Connect your mobile phone or tablet to the <strong>same Wi-Fi network</strong> as this computer.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Open your phone's camera, scan the QR code above, and tap the link to open in Safari or Chrome.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-stone-100">Add to Home Screen (Install Fullscreen App):</strong>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  &bull; <strong>iPhone/iPad</strong>: Tap Safari Share button <Share2 className="w-3 h-3 inline mx-0.5 text-stone-300" /> &rarr; Tap <strong>"Add to Home Screen"</strong>.
                  <br />
                  &bull; <strong>Android</strong>: Tap Chrome 3 dots menu &rarr; Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Remote Access Note */}
        <div className="mt-5 p-3 rounded-xl bg-stone-950/60 border border-stone-800/80 text-[11px] text-stone-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong>Outside the showroom?</strong> To access the ERP over mobile 4G/5G cellular data when away from your Wi-Fi, you can use free tools like Cloudflare Tunnel or Tailscale to securely connect anytime.
          </span>
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
}

