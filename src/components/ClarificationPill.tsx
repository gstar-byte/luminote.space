import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckSquare, RefreshCw, FileText, Settings, Star, Pin } from 'lucide-react';
import { Capsule } from '../types';

interface ClarificationPillProps {
  capsule: Capsule;
  onResolve: (updates: Partial<Capsule>) => void;
  onUpdate?: (updates: Partial<Capsule>) => void;
}

type RepeatType = 'none' | 'once' | 'daily' | 'weekly' | 'monthly';

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getNextDayOfWeekAndTime(dayOfWeek: number, hours: number): Date {
  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, 0, 0, 0);
  const currentDay = now.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  
  if (daysToAdd === 0 && result.getTime() <= now.getTime()) {
    daysToAdd = 7;
  }
  
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

export function ClarificationPill({ capsule, onResolve, onUpdate }: ClarificationPillProps) {
  if (!capsule.isAmbiguous) return null;

  const [showCustom, setShowCustom] = useState(false);
  const [selectedTimeType, setSelectedTimeType] = useState<string | null>(() => {
    if (!capsule.reminder || capsule.reminder.type === 'none') return null;
    return capsule.reminder.type;
  });
  const [customDate, setCustomDate] = useState(() => {
    const now = new Date();
    const tomorrowNine = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
    return toLocalISOString(tomorrowNine);
  });
  const [customRepeat, setCustomRepeat] = useState<RepeatType>('once');
  const [customStarred, setCustomStarred] = useState(false);
  const [customPinned, setCustomPinned] = useState(false);

  const [withStar, setWithStar] = useState(() => !!capsule.isStarred);
  const [withPin, setWithPin] = useState(() => !!capsule.isPinned);

  const handleQuickSelect = (type: 'today' | 'tomorrow' | 'dayafter' | 'sat-am' | 'sat-pm' | 'sun-am' | 'sun-pm' | 'todo' | 'everyday' | 'everyweek' | 'justnote') => {
    const now = new Date();
    const baseUpdates: Partial<Capsule> = {};
    if (withStar) baseUpdates.isStarred = true;
    if (withPin) baseUpdates.isPinned = true;

    if (type === 'justnote') {
      onResolve({
        ...baseUpdates,
        isTodo: false,
        reminder: { type: 'none' },
        isAmbiguous: false,
        clarificationPrompt: null
      });
      return;
    }

    if (type === 'todo') {
      onResolve({
        ...baseUpdates,
        isTodo: true,
        reminder: { type: 'none' },
        isAmbiguous: false,
        clarificationPrompt: null
      });
      return;
    }

    let reminderUpdate: any = null;

    if (type === 'today') {
      const todaySix = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
      if (todaySix.getTime() <= now.getTime()) {
        todaySix.setHours(todaySix.getHours() + 3);
      }
      reminderUpdate = { type: 'once', date: todaySix.getTime() };
    } else if (type === 'tomorrow') {
      const tomorrowNine = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
      reminderUpdate = { type: 'once', date: tomorrowNine.getTime() };
    } else if (type === 'dayafter') {
      const dayAfterNine = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 9, 0, 0, 0);
      reminderUpdate = { type: 'once', date: dayAfterNine.getTime() };
    } else if (type === 'sat-am') {
      const target = getNextDayOfWeekAndTime(6, 9);
      reminderUpdate = { type: 'once', date: target.getTime() };
    } else if (type === 'sat-pm') {
      const target = getNextDayOfWeekAndTime(6, 15);
      reminderUpdate = { type: 'once', date: target.getTime() };
    } else if (type === 'sun-am') {
      const target = getNextDayOfWeekAndTime(0, 9);
      reminderUpdate = { type: 'once', date: target.getTime() };
    } else if (type === 'sun-pm') {
      const target = getNextDayOfWeekAndTime(0, 15);
      reminderUpdate = { type: 'once', date: target.getTime() };
    } else if (type === 'everyday') {
      const dailyEight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
      if (dailyEight.getTime() <= now.getTime()) {
        dailyEight.setDate(dailyEight.getDate() + 1);
      }
      reminderUpdate = { type: 'daily', date: dailyEight.getTime() };
    } else if (type === 'everyweek') {
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
      nextMon.setHours(9, 0, 0, 0);
      reminderUpdate = { type: 'weekly', date: nextMon.getTime() };
    }

    // 直接 onResolve 自动关闭面板，不需要点 Done
    if (reminderUpdate) {
      onResolve({
        ...baseUpdates,
        isTodo: true,
        reminder: reminderUpdate,
        isAmbiguous: false,
        clarificationPrompt: null
      });
    }
  };

  const handleCustomConfirm = () => {
    const date = new Date(customDate);
    const hasReminder = customRepeat !== 'none' && !isNaN(date.getTime());
    const updates: Partial<Capsule> = {
      isTodo: customRepeat !== 'none',
      isAmbiguous: false,
      clarificationPrompt: null,
      isStarred: customStarred || undefined,
      isPinned: customPinned || undefined,
    };

    if (hasReminder) {
      updates.reminder = {
        type: customRepeat,
        date: date.getTime()
      };
    } else {
      updates.reminder = { type: 'none' };
    }

    onResolve(updates);
    setShowCustom(false);
  };

  const repeatOptions: { value: RepeatType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'once', label: 'Once' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-3 p-3 bg-gradient-to-r from-[#F2F2F7] to-[#E5E5EA] dark:from-[#1C1C1E] dark:to-[#2C2C2E] rounded-2xl border border-[#D1D1D6]/40 dark:border-[#3A3A3C]/40 flex flex-col gap-2.5 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <span className="p-1.5 bg-[#007AFF]/10 text-[#007AFF] rounded-lg shrink-0">
          <Clock size={13} className="animate-pulse" />
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#8E8E93]">Quick Settings</span>
          <span className="text-xs text-[#1D1D1F] dark:text-[#F2F2F7] font-medium leading-normal mt-0.5">
            {capsule.clarificationPrompt || "Would you like to set a reminder, repeat loop, or keep it as a note?"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {/* Once Reminders */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('today')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'today'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Today 6 PM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('tomorrow')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'tomorrow'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Tomorrow 9 AM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('dayafter')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'dayafter'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Day After 9 AM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('sat-am')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'sat-am'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Sat 9 AM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('sat-pm')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'sat-pm'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Sat 3 PM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('sun-am')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'sun-am'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Sun 9 AM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('sun-pm')}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'sun-pm'
              ? 'bg-[#007AFF] text-white border-[#007AFF]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#007AFF] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#007AFF]/5'
          }`}
        >
          <span>Sun 3 PM</span>
        </motion.button>

        {/* Repeat Loops */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('everyday')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'everyday'
              ? 'bg-[#AF52DE] text-white border-[#AF52DE]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#AF52DE] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#AF52DE]/5'
          }`}
        >
          <RefreshCw size={10} />
          <span>Every Day 8 PM</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('everyweek')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'everyweek'
              ? 'bg-[#AF52DE] text-white border-[#AF52DE]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#AF52DE] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#AF52DE]/5'
          }`}
        >
          <RefreshCw size={10} />
          <span>Every Mon 9 AM</span>
        </motion.button>

        {/* Task & Plain Note */}
        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 59, 48, 0.08)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('todo')}
          className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#2C2C2E] text-[#FF3B30] text-[11px] font-bold rounded-xl shadow-sm border border-[#E5E5EA] dark:border-[#3A3A3C] transition-colors"
        >
          <CheckSquare size={10} />
          <span>Just Todo</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(142, 142, 147, 0.08)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleQuickSelect('justnote')}
          className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#2C2C2E] text-[#8E8E93] text-[11px] font-bold rounded-xl shadow-sm border border-[#E5E5EA] dark:border-[#3A3A3C] transition-colors"
        >
          <FileText size={10} />
          <span>Just Note</span>
        </motion.button>

        {/* Custom button */}
        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(52, 199, 89, 0.08)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCustom(!showCustom)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            selectedTimeType === 'custom'
              ? 'bg-[#34C759] text-white border-[#34C759]'
              : 'bg-white dark:bg-[#2C2C2E] text-[#34C759] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#34C759]/5'
          }`}
        >
          <Settings size={10} />
          <span>Custom</span>
        </motion.button>

        {/* Star & Pin toggles */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            const nextVal = !withStar;
            onResolve({
              isStarred: nextVal,
              isPinned: withPin || undefined,
              isAmbiguous: false,
              clarificationPrompt: null
            });
          }}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            withStar
              ? 'bg-[#FFCC00]/10 text-[#FF9500] border-[#FFCC00]/30'
              : 'bg-white dark:bg-[#2C2C2E] text-[#8E8E93] border-[#E5E5EA] dark:border-[#3A3A3C]'
          }`}
        >
          <Star size={10} className={withStar ? 'fill-[#FFCC00]' : ''} />
          {withStar ? 'Starred' : 'Star'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            const nextVal = !withPin;
            onResolve({
              isStarred: withStar || undefined,
              isPinned: nextVal,
              isAmbiguous: false,
              clarificationPrompt: null
            });
          }}
          className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-xl shadow-sm border transition-colors ${
            withPin
              ? 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/30'
              : 'bg-white dark:bg-[#2C2C2E] text-[#8E8E93] border-[#E5E5EA] dark:border-[#3A3A3C]'
          }`}
        >
          <Pin size={10} />
          {withPin ? 'Pinned' : 'Pin'}
        </motion.button>
      </div>

      {/* Custom Options Panel */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-white dark:bg-[#2C2C2E] rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] space-y-3">
              {/* Date & Time */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-[#8E8E93]">Date & Time</label>
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-[#F2F2F7] dark:bg-[#1C1C1E] border border-[#E5E5EA] dark:border-[#3A3A3C] rounded-lg px-3 py-2 text-xs text-[#1D1D1F] dark:text-[#F2F2F7] focus:ring-2 focus:ring-[#007AFF]/20 outline-none"
                />
              </div>

              {/* Repeat */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-[#8E8E93]">Repeat</label>
                <div className="flex flex-wrap gap-1.5">
                  {repeatOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCustomRepeat(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        customRepeat === opt.value
                          ? 'bg-[#007AFF] text-white border-[#007AFF]'
                          : 'bg-[#F2F2F7] dark:bg-[#1C1C1E] text-[#8E8E93] border-[#E5E5EA] dark:border-[#3A3A3C] hover:bg-[#E5E5EA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Star & Pin Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCustomStarred(!customStarred)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    customStarred
                      ? 'bg-[#FFCC00]/10 text-[#FF9500] border-[#FFCC00]/30'
                      : 'bg-[#F2F2F7] dark:bg-[#1C1C1E] text-[#8E8E93] border-[#E5E5EA] dark:border-[#3A3A3C]'
                  }`}
                >
                  <Star size={12} className={customStarred ? 'fill-[#FFCC00] text-[#FFCC00]' : ''} />
                  {customStarred ? 'Starred' : 'Star'}
                </button>
                <button
                  onClick={() => setCustomPinned(!customPinned)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    customPinned
                      ? 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/30'
                      : 'bg-[#F2F2F7] dark:bg-[#1C1C1E] text-[#8E8E93] border-[#E5E5EA] dark:border-[#3A3A3C]'
                  }`}
                >
                  <Pin size={12} />
                  {customPinned ? 'Pinned' : 'Pin'}
                </button>
              </div>

              {/* Confirm */}
              <button
                onClick={handleCustomConfirm}
                className="w-full py-2 bg-[#007AFF] text-white text-[11px] font-bold rounded-lg hover:bg-[#0051D5] transition-colors"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}