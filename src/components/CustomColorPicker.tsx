import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

// HSV 与 HEX 互相转换算法
function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => {
    const kVal = k(n);
    const color = v * (1 - s * Math.max(Math.min(kVal, 4 - kVal, 1), 0));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return { h: 120, s: 70, v: 80 }; // 默认
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function normalizeHex(s: string): string {
  const x = s.replace('#', '').trim();
  if (/^[0-9A-Fa-f]{6}$/.test(x)) return `#${x.toUpperCase()}`;
  return '';
}

interface CustomColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function CustomColorPicker({ color, onChange }: CustomColorPickerProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(color || '#FFD60A'));
  const [draft, setDraft] = useState(color || '#FFD60A');

  useEffect(() => {
    setHsv(hexToHsv(color || '#FFD60A'));
    setDraft(color || '#FFD60A');
  }, [color]);

  const updateColor = (newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setDraft(hex);
    onChange(hex);
  };

  const applyHex = () => {
    const valid = normalizeHex(draft);
    if (valid) {
      onChange(valid);
      setHsv(hexToHsv(valid));
    } else {
      setDraft(hsvToHex(hsv.h, hsv.s, hsv.v));
    }
  };

  // 2D Board Handling
  const boardRef = useRef<HTMLDivElement>(null);
  const handleBoardPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown') return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(rect.width, x));
    y = Math.max(0, Math.min(rect.height, y));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);
    updateColor({ ...hsv, s, v });
  };

  // 1D Slider Handling
  const sliderRef = useRef<HTMLDivElement>(null);
  const handleSliderPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown') return;
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));

    const h = Math.round((x / rect.width) * 360);
    updateColor({ ...hsv, h });
  };

  const baseHueColor = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <div className="flex flex-col gap-3 mt-2 px-1 pb-1">
      {/* 2D S-V Board */}
      <div
        ref={boardRef}
        onPointerDown={handleBoardPointer}
        onPointerMove={handleBoardPointer}
        className="w-full h-36 rounded-xl relative overflow-hidden cursor-crosshair shadow-inner select-none"
        style={{ backgroundColor: baseHueColor, touchAction: 'none' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, white, transparent)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, black, transparent)' }} />
        <div
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-md pointer-events-none transition-none"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v),
          }}
        />
      </div>

      {/* 1D Hue Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center text-[10px] font-bold text-[#8E8E93] uppercase">
          <span>Hue</span>
          <span className="text-[#1D1D1F] dark:text-[#F2F2F7]">{hsv.h}°</span>
        </div>
        <div
          ref={sliderRef}
          onPointerDown={handleSliderPointer}
          onPointerMove={handleSliderPointer}
          className="w-full h-4 rounded-full relative cursor-ew-resize shadow-inner select-none"
          style={{
            background: 'linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
            touchAction: 'none'
          }}
        >
          <div
            className="absolute w-5 h-5 -ml-2.5 top-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none bg-white transition-none"
            style={{ left: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>

      {/* Hex Input */}
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={applyHex}
          onKeyDown={(e) => e.key === 'Enter' && applyHex()}
          placeholder="#RRGGBB"
          className="flex-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs font-bold text-[#1D1D1F] dark:text-white uppercase focus:ring-2 focus:ring-[#007AFF] outline-none transition-all"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); applyHex(); }}
          className="bg-[#007AFF] text-white rounded-lg px-4 py-1.5 text-xs font-bold shadow-md hover:bg-[#0051FF] transition-all"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
