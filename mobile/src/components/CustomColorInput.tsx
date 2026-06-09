import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

function normalizeHex(s: string): string {
  const x = s.replace('#', '').trim();
  if (/^[0-9A-Fa-f]{6}$/.test(x)) return `#${x.toUpperCase()}`;
  return '';
}

export function CustomColorInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState(() => value || '#6BCB77');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDraft(value || '#6BCB77');
  }, [value]);

  const apply = () => {
    const h = normalizeHex(draft);
    if (h) onChange(h);
  };

  const previewColor = normalizeHex(draft) || value || '#6BCB77';

  return (
    <View style={s.container}>
      {/* 顶层单行条，点击展开/收起输入框 */}
      <TouchableOpacity
        style={s.rowBtn}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <Text style={s.emoji}>🎨</Text>
        <Text style={s.title}>Custom color</Text>
        
        {/* 圆形颜色预览球 */}
        <View style={[s.swatch, { backgroundColor: previewColor }]} />
      </TouchableOpacity>

      {/* 展开的编辑输入区 */}
      {expanded && (
        <View style={s.editorArea}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              onBlur={apply}
              onSubmitEditing={apply}
              placeholder="#RRGGBB"
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>
          <Text style={s.hint}>Enter 6 hex digits; applies on blur</Text>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1D1D1F',
  },
  hint: { fontSize: 10, color: '#8E8E93', marginTop: 4, fontWeight: '600' },
});
