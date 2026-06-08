import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  value: Date;
  onChange: (d: Date) => void;
};

/**
 * iOS：内联 spinner。Android：分步式选择（date -> time）以防 mode="datetime" 闪退。
 */
export function ReminderDateField({ value, onChange }: Props) {
  const [pickerMode, setPickerMode] = useState<'none' | 'date' | 'time'>('none');
  const [tempDate, setTempDate] = useState<Date | null>(null);

  if (Platform.OS === 'android') {
    return (
      <View style={styles.androidWrap}>
        <TouchableOpacity
          style={styles.androidBtn}
          onPress={() => setPickerMode('date')}
          activeOpacity={0.85}
        >
          <Text style={styles.androidBtnTxt}>{value.toLocaleString()}</Text>
          <Text style={styles.androidHint}>Tap to pick date and time</Text>
        </TouchableOpacity>
        
        {pickerMode === 'date' && (
          <DateTimePicker
            value={value}
            mode="date"
            display="default"
            onChange={(event, d) => {
              if (event.type === 'dismissed') {
                setPickerMode('none');
                return;
              }
              if (d) {
                setTempDate(d);
                setPickerMode('time'); // 自动进入时间拾取器
              } else {
                setPickerMode('none');
              }
            }}
          />
        )}

        {pickerMode === 'time' && (
          <DateTimePicker
            value={tempDate || value}
            mode="time"
            display="default"
            onChange={(event, d) => {
              setPickerMode('none');
              if (event.type === 'dismissed') return;
              if (d && tempDate) {
                const combined = new Date(tempDate);
                combined.setHours(d.getHours());
                combined.setMinutes(d.getMinutes());
                combined.setSeconds(0);
                combined.setMilliseconds(0);
                onChange(combined);
              }
            }}
          />
        )}
      </View>
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="datetime"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(_, d) => {
        if (d) onChange(d);
      }}
    />
  );
}

const styles = StyleSheet.create({
  androidWrap: { width: '100%', marginTop: 8 },
  androidBtn: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  androidBtnTxt: { fontSize: 15, fontWeight: '700', color: '#1D1D1F' },
  androidHint: { fontSize: 12, color: '#8E8E93', marginTop: 6, fontWeight: '600' },
});
