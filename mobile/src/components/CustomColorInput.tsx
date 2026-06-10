import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

// 24 个精选莫兰迪/马卡龙糖果粉雅色盘，作为快捷选取
const RECOMMEND_COLORS = [
  '#FFD1D1', '#FFE3D1', '#FFF2CC', '#E2F0D9', '#D9EAD3', '#D0E1FD', '#E4D0FA', '#F4D0EA',
  '#FBC4C4', '#FBD5B7', '#FCE8B2', '#C2E0B4', '#B6D7A8', '#A4C2F4', '#B4A7D6', '#D5A6BD',
  '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6FA8DC', '#8E7CC3', '#C27BA0',
];

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
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) {
    return { h: 120, s: 70, v: 80 }; // 默认
  }
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
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

function normalizeHex(s: string): string {
  const x = s.replace('#', '').trim();
  if (/^[0-9A-Fa-f]{6}$/.test(x)) return `#${x.toUpperCase()}`;
  return '';
}

// 二维 S-V 调色区组件
function CustomColorBoard({
  hue,
  sat,
  val,
  onChange,
  onRelease,
}: {
  hue: number;
  sat: number;
  val: number;
  onChange: (s: number, v: number) => void;
  onRelease: () => void;
}) {
  const [boardWidth, setBoardWidth] = useState(0);
  const boardHeight = 150;

  const handleTouch = (evt: any) => {
    if (boardWidth <= 0) return;
    const x = Math.max(0, Math.min(boardWidth, evt.nativeEvent.locationX));
    const y = Math.max(0, Math.min(boardHeight, evt.nativeEvent.locationY));
    
    const s = Math.round((x / boardWidth) * 100);
    const v = Math.round((1 - y / boardHeight) * 100);
    onChange(s, v);
  };

  const indicatorSize = 16;
  const left = (sat / 100) * boardWidth;
  const top = (1 - val / 100) * boardHeight;
  const basePureColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <View
      style={[boardStyles.board, { backgroundColor: basePureColor }]}
      onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={onRelease}
    >
      <LinearGradient
        colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {boardWidth > 0 && (
        <View
          style={[
            boardStyles.indicator,
            {
              left: left - indicatorSize / 2,
              top: top - indicatorSize / 2,
              width: indicatorSize,
              height: indicatorSize,
            }
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

// 色相一维滑轨组件
function CustomHueSlider({
  value,
  onChange,
  onRelease,
}: {
  value: number;
  onChange: (h: number) => void;
  onRelease: () => void;
}) {
  const [width, setWidth] = useState(0);

  const handleTouch = (evt: any) => {
    if (width <= 0) return;
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / width));
    onChange(Math.round(pct * 360));
  };

  const pct = value / 360;
  const handleLeft = pct * width;
  const rainbow = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.header}>
        <Text style={sliderStyles.label}>Hue (Color Tone)</Text>
        <Text style={sliderStyles.value}>{value}°</Text>
      </View>
      <View
        style={sliderStyles.trackWrapper}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={onRelease}
      >
        <LinearGradient
          colors={rainbow as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={sliderStyles.track}
        />
        <View
          style={[
            sliderStyles.handle,
            { left: Math.max(0, Math.min(width - 16, handleLeft - 8)) }
          ]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

export function CustomColorInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState(() => value || '#6BCB77');
  const [expanded, setExpanded] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#6BCB77'));

  useEffect(() => {
    const activeVal = value || '#6BCB77';
    setDraft(activeVal);
    setHsv(hexToHsv(activeVal));
  }, [value]);

  const applyHex = () => {
    const h = normalizeHex(draft);
    if (h) {
      onChange(h);
      setHsv(hexToHsv(h));
    }
  };

  const handlePickPreset = (color: string) => {
    setDraft(color);
    setHsv(hexToHsv(color));
    onChange(color);
  };

  const handleBoardChange = (s: number, v: number) => {
    const nextHsv = { ...hsv, s, v };
    setHsv(nextHsv);
    setDraft(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v));
  };

  const handleHueChange = (h: number) => {
    const nextHsv = { ...hsv, h };
    setHsv(nextHsv);
    setDraft(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v));
  };

  const handleRelease = () => {
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    onChange(hex);
  };

  const previewColor = normalizeHex(draft) || value || '#6BCB77';

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.rowBtn}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <Text style={s.emoji}>🎨</Text>
        <Text style={s.title}>Custom color</Text>
        <View style={[s.swatch, { backgroundColor: previewColor }]} />
      </TouchableOpacity>

      {expanded && (
        <View style={s.editorArea}>
          {/* 1. 二维选色大面板 (参考 PC Web 端原生外观) */}
          <CustomColorBoard
            hue={hsv.h}
            sat={hsv.s}
            val={hsv.v}
            onChange={handleBoardChange}
            onRelease={handleRelease}
          />

          {/* 2. 色相彩虹滑条 */}
          <CustomHueSlider
            value={hsv.h}
            onChange={handleHueChange}
            onRelease={handleRelease}
          />


          {/* 4. HEX 文本输入备份 */}
          <View style={s.inputWrapper}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              onBlur={applyHex}
              onSubmitEditing={applyHex}
              placeholder="#RRGGBB"
              autoCapitalize="characters"
              maxLength={7}
            />
            <TouchableOpacity style={s.applyBtn} onPress={applyHex} activeOpacity={0.7}>
              <Text style={s.applyBtnTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 8,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  emoji: { fontSize: 18, marginRight: 10, lineHeight: 18 },
  title: { fontSize: 13, fontWeight: '700', color: '#1D1D1F' },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginLeft: 'auto',
  },
  editorArea: {
    paddingHorizontal: 4,
    paddingBottom: 10,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  colorGridItem: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  colorGridItemActive: {
    borderColor: '#007AFF',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#1D1D1F',
  },
  applyBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

const boardStyles = StyleSheet.create({
  board: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  indicator: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 4,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
  },
  value: {
    fontSize: 10,
    color: '#48484A',
    fontWeight: '700',
  },
  trackWrapper: {
    height: 16,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 6,
    borderRadius: 3,
    width: '100%',
  },
  handle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1.5,
    elevation: 2,
    top: 0,
  },
});
