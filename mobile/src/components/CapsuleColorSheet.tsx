import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, RotateCcw } from 'lucide-react-native';
import { PRESET_COLORS } from '../constants';
import type { Capsule } from '../types';
import { CustomColorInput } from './CustomColorInput';

type Props = {
  capsule: Capsule;
  onSelectPreset: (hex: string) => void;
  onReset: () => void;
  onCustomColor: (hex: string) => void;
  onClose: () => void;
  hidePresets?: boolean;
};

/** 与 web CapsuleItem 颜色面板一致：Presets + Reset + Custom */
export function CapsuleColorSheet({
  capsule,
  onSelectPreset,
  onReset,
  onCustomColor,
  onClose,
  hidePresets = false,
}: Props) {
  const selected = capsule.color;

  return (
    <View style={s.sheet}>
      <Text style={s.title}>Change Color</Text>
      
      {!hidePresets && (
        <View style={s.presetGrid}>
          {PRESET_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                s.dot,
                { backgroundColor: color },
                selected === color && s.dotOn,
              ]}
              onPress={() => onSelectPreset(color)}
              activeOpacity={0.8}
            >
              {selected === color && (
                <Check size={14} color="#FFF" />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.resetDot, !selected && s.resetDotOn]}
            onPress={onReset}
            accessibilityLabel="Reset to default"
            activeOpacity={0.8}
          >
            <RotateCcw size={14} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}
      
      <CustomColorInput
        value={selected || '#6BCB77'}
        onChange={(hex) => onCustomColor(hex)}
      />
      
      <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={s.closeTxt}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    width: '100%',
  },
  title: { fontSize: 16, fontWeight: '900', color: '#1D1D1F', marginBottom: 16 },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'flex-start',
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { borderColor: '#007AFF' },
  resetDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D1D6',
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetDotOn: { borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.08)' },
  closeBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  closeTxt: { color: '#007AFF', fontWeight: '800', fontSize: 15 },
});
