import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  View,
  useWindowDimensions,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import type { Capsule, ReminderConfig, ReminderType } from '../types';
import { ReminderDateField } from './ReminderDateField';
import { requestNotificationPermissions } from '../lib/notificationsMobile';

const REPEAT_OPTIONS: ReminderType[] = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'custom',
];

function repeatLabel(t: ReminderType): string {
  if (t === 'once') return 'No repeat';
  if (t === 'custom') return 'Custom';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Props = {
  capsule: Capsule;
  onSave: (reminder: ReminderConfig | undefined) => void;
  onClose: () => void;
};

/** 与 web/src/App.tsx CapsuleItem 提醒面板行为对齐 */
export function CapsuleReminderSheet({ capsule, onSave, onClose }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [dateMs, setDateMs] = useState<number | null>(capsule.reminder?.date ?? null);
  const [repeatType, setRepeatType] = useState<ReminderType>(
    (capsule.reminder?.type as ReminderType) || 'none',
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [customInterval, setCustomInterval] = useState(capsule.reminder?.customInterval ?? 1);
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>(
    capsule.reminder?.customUnit ?? 'day',
  );

  useEffect(() => {
    setDateMs(capsule.reminder?.date ?? null);
    setRepeatType((capsule.reminder?.type as ReminderType) || 'none');
    setCustomInterval(capsule.reminder?.customInterval ?? 1);
    setCustomUnit(capsule.reminder?.customUnit ?? 'day');
    setCustomOpen(false);
  }, [
    capsule.id,
    capsule.reminder?.date,
    capsule.reminder?.type,
    capsule.reminder?.customInterval,
    capsule.reminder?.customUnit,
  ]);

  const pickerDate = new Date(dateMs ?? Date.now());

  const handleTimeChange = (d: Date) => {
    setDateMs(d.getTime());
    if (repeatType === 'none') setRepeatType('once');
  };

  const handleRepeatSelect = (type: ReminderType) => {
    if (type === 'custom') {
      setRepeatType('custom');
      setCustomOpen(true);
    } else {
      setRepeatType(type);
      setCustomOpen(false);
    }
  };

  const buildAndSave = () => {
    const tempReminderDate = dateMs;
    const tempReminderType = repeatType;

    if (tempReminderType === 'none' && !tempReminderDate) {
      onSave(undefined);
      onClose();
      return;
    }

    if (Platform.OS !== 'web') {
      void requestNotificationPermissions();
    }

    const next: ReminderConfig = {
      type:
        tempReminderType === 'none' && tempReminderDate ? 'once' : tempReminderType,
      date: tempReminderDate ?? Date.now() + 86400000,
      ...(tempReminderType === 'custom'
        ? { customInterval, customUnit }
        : {}),
    };

    onSave(next);
    onClose();
  };

  const clearReminder = () => {
    onSave(undefined);
    onClose();
  };

  const isSelected = (type: ReminderType) =>
    repeatType === type || (repeatType === 'none' && type === 'once');

  if (customOpen) {
    return (
      <View style={styles.card}>
        <View style={styles.customHeader}>
          <TouchableOpacity
            onPress={() => setCustomOpen(false)}
            hitSlop={12}
            style={styles.iconPadded}
          >
            <X size={18} color="#1D1D1F" />
          </TouchableOpacity>
          <Text style={styles.customTitle}>CUSTOM REPEAT</Text>
        </View>
        <Text style={styles.inputLbl}>EVERY</Text>
        <View style={styles.everyRow}>
          <TextInput
            style={styles.numInput}
            keyboardType="number-pad"
            value={String(customInterval)}
            onChangeText={(t) => setCustomInterval(Math.max(1, parseInt(t, 10) || 1))}
          />
          <View style={styles.unitRow}>
            {(['day', 'week', 'month'] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitChip, customUnit === u && styles.unitChipOn]}
                onPress={() => setCustomUnit(u)}
              >
                <Text style={[styles.unitTxt, customUnit === u && styles.unitTxtOn]}>
                  {u === 'day' ? 'Days' : u === 'week' ? 'Weeks' : 'Months'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.saveBlue} onPress={buildAndSave}>
          <Text style={styles.saveBlueTxt}>Save</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Set Reminder</Text>
      <ScrollView
        style={{ maxHeight: windowHeight * 0.55 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.timeBlock}>
          <Text style={styles.secLbl}>SPECIFIC TIME</Text>
          <ReminderDateField value={pickerDate} onChange={handleTimeChange} />
        </View>
        <Text style={[styles.secLbl, { marginTop: 14 }]}>REPEAT</Text>
        {REPEAT_OPTIONS.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.repeatRow, isSelected(type) && styles.repeatRowOn]}
            onPress={() => handleRepeatSelect(type)}
          >
            <Text style={[styles.repeatTxt, isSelected(type) && styles.repeatTxtOn]}>
              {repeatLabel(type)}
            </Text>
            {isSelected(type) ? <Check size={14} color="#007AFF" /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.footerBtns}>
        <TouchableOpacity style={styles.clearBtn} onPress={clearReminder}>
          <Text style={styles.clearTxt}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBlue} onPress={buildAndSave}>
          <Text style={styles.saveBlueTxt}>Save</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.cancelTxt}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    width: '100%',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#1D1D1F', marginBottom: 8 },
  timeBlock: { marginTop: 4 },
  secLbl: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 6,
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  repeatRowOn: { backgroundColor: 'rgba(0,122,255,0.08)' },
  repeatTxt: { fontSize: 13, fontWeight: '700', color: '#1D1D1F' },
  repeatTxtOn: { color: '#007AFF' },
  footerBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  clearBtn: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearTxt: { color: '#FF3B30', fontWeight: '800', fontSize: 14 },
  saveBlue: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBlueTxt: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  cancelTxt: {
    color: '#8E8E93',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  iconPadded: { padding: 4 },
  customTitle: { fontSize: 13, fontWeight: '900', color: '#1D1D1F' },
  inputLbl: {
    fontSize: 9,
    fontWeight: '900',
    color: '#8E8E93',
    marginBottom: 6,
  },
  everyRow: { gap: 10 },
  numInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  unitChipOn: { backgroundColor: 'rgba(0,122,255,0.15)' },
  unitTxt: { fontSize: 12, fontWeight: '700', color: '#1D1D1F' },
  unitTxtOn: { color: '#007AFF' },
});
