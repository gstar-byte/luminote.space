import React from 'react';

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

function padHex(c: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c;
  return '#FFD60A';
}

export function CustomColorInput({ value, onChange }: Props) {
  const v = padHex(value);

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 12,
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'transparent',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span style={{ fontSize: 18, userSelect: 'none', flexShrink: 0, lineHeight: 1 }}>🎨</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>
        Custom color
      </span>

      {/* 圆形颜色预览球 */}
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginLeft: 'auto',
          flexShrink: 0,
          backgroundColor: v,
        }}
      />

      {/* 隐藏的原生取色器 */}
      <input
        type="color"
        value={v}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0,
        }}
      />
    </label>
  );
}
