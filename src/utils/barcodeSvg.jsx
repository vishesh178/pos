import React from 'react';

/**
 * Standard GS1 EAN-13 Encoding Tables
 */
const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];

const EAN_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];

const EAN_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];

const EAN_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

/**
 * Compute GS1 standard check digit for 12-digit string
 */
export function calculateEan13CheckDigit(code12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Encode EAN-13 string into 95-module binary pattern with guard positions
 */
export function encodeEan13ToModules(code) {
  const clean = String(code || '').replace(/\D/g, '');
  let full13 = clean;
  if (clean.length === 12) {
    full13 = clean + calculateEan13CheckDigit(clean);
  } else if (clean.length !== 13) {
    // Pad or fallback
    full13 = clean.padStart(12, '0').slice(0, 12);
    full13 = full13 + calculateEan13CheckDigit(full13);
  }

  const digits = full13.split('').map(Number);
  const parity = EAN_PARITY[digits[0]];

  // Start guard (101)
  let modules = '101';

  // Left 6 digits
  for (let i = 1; i <= 6; i++) {
    const digit = digits[i];
    const isL = parity[i - 1] === 'L';
    modules += isL ? EAN_L[digit] : EAN_G[digit];
  }

  // Center guard (01010)
  modules += '01010';

  // Right 6 digits
  for (let i = 7; i <= 12; i++) {
    const digit = digits[i];
    modules += EAN_R[digit];
  }

  // Stop guard (101)
  modules += '101';

  return {
    modules, // length 95
    fullCode: full13,
    isGuard: (idx) => (idx >= 0 && idx <= 2) || (idx >= 45 && idx <= 49) || (idx >= 92 && idx <= 94),
  };
}

/**
 * Code 128 (Subset B) Fallback encoder for arbitrary strings / SKUs
 */
const C128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011' // 106 Stop
];

export function encodeCode128BToModules(text) {
  const str = String(text || '').trim();
  const startCode = 104; // Start B
  let checksum = startCode;
  let modules = C128_PATTERNS[startCode];

  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const value = Math.max(0, Math.min(charCode - 32, 95));
    checksum += value * (i + 1);
    modules += C128_PATTERNS[value];
  }

  const checkSymbol = checksum % 103;
  modules += C128_PATTERNS[checkSymbol];
  modules += C128_PATTERNS[106]; // Stop code (13 modules)

  return { modules, fullCode: str };
}

/**
 * Universal Barcode SVG Component
 * Produces crisp, laser/camera-scannable vector barcode SVGs
 */
export default function BarcodeSvg({
  value,
  width = 160,
  height = 42,
  showText = true,
  barColor = '#000000',
  className = '',
}) {
  if (!value) return null;

  const clean = String(value).trim().replace(/'/g, '');
  const isEan13Candidate = /^\d{12,13}$/.test(clean);

  let modules = '';
  let fullCode = clean;
  let isGuard = () => false;

  if (isEan13Candidate) {
    const res = encodeEan13ToModules(clean);
    modules = res.modules;
    fullCode = res.fullCode;
    isGuard = res.isGuard;
  } else {
    const res = encodeCode128BToModules(clean);
    modules = res.modules;
    fullCode = res.fullCode;
  }

  const totalModules = modules.length;
  const moduleWidth = 2; // SVG coordinate units
  const svgWidth = totalModules * moduleWidth;
  const standardBarHeight = 36;
  const guardBarHeight = 42;
  const textHeight = showText ? 12 : 0;
  const svgHeight = standardBarHeight + textHeight + 4;

  // Group contiguous '1' bits into single rects for cleaner SVG rendering
  const rects = [];
  let inBar = false;
  let startX = 0;
  let isCurrentGuard = false;

  for (let i = 0; i < totalModules; i++) {
    const bit = modules[i];
    const guard = isGuard(i);

    if (bit === '1') {
      if (!inBar) {
        inBar = true;
        startX = i * moduleWidth;
        isCurrentGuard = guard;
      } else if (guard !== isCurrentGuard) {
        // End current segment if guard status changes
        rects.push({
          x: startX,
          width: i * moduleWidth - startX,
          height: isCurrentGuard ? guardBarHeight : standardBarHeight,
        });
        startX = i * moduleWidth;
        isCurrentGuard = guard;
      }
    } else {
      if (inBar) {
        inBar = false;
        rects.push({
          x: startX,
          width: i * moduleWidth - startX,
          height: isCurrentGuard ? guardBarHeight : standardBarHeight,
        });
      }
    }
  }

  if (inBar) {
    rects.push({
      x: startX,
      width: totalModules * moduleWidth - startX,
      height: isCurrentGuard ? guardBarHeight : standardBarHeight,
    });
  }

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={width}
      height={height}
      className={`select-none ${className}`}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width={svgWidth} height={svgHeight} fill="#ffffff" />

      {/* Barcode Bars */}
      {rects.map((r, idx) => (
        <rect
          key={idx}
          x={r.x}
          y={0}
          width={r.width}
          height={r.height}
          fill={barColor}
        />
      ))}

      {/* Text Readout */}
      {showText && (
        <text
          x={svgWidth / 2}
          y={svgHeight - 1}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="11"
          fontWeight="bold"
          letterSpacing="2"
          fill={barColor}
        >
          {isEan13Candidate
            ? `${fullCode.slice(0, 1)} ${fullCode.slice(1, 7)} ${fullCode.slice(7)}`
            : fullCode}
        </text>
      )}
    </svg>
  );
}

