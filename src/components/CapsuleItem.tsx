import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Check, Trash2, X, Clock, Zap, Type, Keyboard, Lightbulb, FileText,
  AlertCircle, Archive, MoreVertical, Calendar, ChevronDown, Bell,
  ChevronLeft, RotateCcw, Square, CheckSquare, Palette, Edit2,
  Image as ImageIcon, Video, Paperclip, XCircle, PlayCircle,
  MessageSquare, BarChart3, ArrowDownNarrowWide, ArrowUpNarrowWide,
  RefreshCw, Pin, Star, Sparkles, Share2, Inbox, Undo,
} from 'lucide-react';
import { Capsule, ReminderType } from '../types';
import { PRESET_COLORS } from '../constants';
import { cn } from '../lib/utils';
import { CustomColorPicker } from './CustomColorPicker';
import { plainTextFromContent, formatNoteDateTime, repeatLabelForMenu, reminderBellTitle } from '../lib/capsuleUtils';

export interface CapsuleItemProps {
  index: number;
  key?: string | number;
  capsule: Capsule;
  patchCapsule: (id: string, updates: Partial<Capsule>) => void;
  onRemovePermanently: () => void;
  allCategories: string[];
  allTags: string[];
  viewMode: 'grid' | 'list';
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onViewDetail: () => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onSelectAll?: () => void;
  setNotificationPermission?: (permission: NotificationPermission) => void;
  onShowBatchMenu?: (x: number, y: number) => void;
}

export const CapsuleItem = memo(function CapsuleItem({
  capsule,
  index,
  viewMode,
  patchCapsule,
  onRemovePermanently,
  allCategories,
  allTags,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  onViewDetail,
  showToast,
  onSelectAll,
  setNotificationPermission,
  onShowBatchMenu,
}: CapsuleItemProps) {
  const capsuleColor = capsule.color || PRESET_COLORS[index % PRESET_COLORS.length] || '#E65100';
  const [showOptions, setShowOptions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [isConfiguringCustom, setIsConfiguringCustom] = useState(false);
  const [showTagCat, setShowTagCat] = useState(false);
  const [showCustomColorPanel, setShowCustomColorPanel] = useState(false);
  const [menuMode, setMenuMode] = useState<'actions' | 'batch' | 'context'>('actions');

  const [tempCategory, setTempCategory] = useState(capsule.category || '');
  const [tempTag, setTempTag] = useState(capsule.tag || (capsule.tags && capsule.tags.length > 0 ? capsule.tags[0] : ''));
  const [tempReminderDate, setTempReminderDate] = useState<number | null>(capsule.reminder?.date || null);
  const [tempReminderType, setTempReminderType] = useState<ReminderType>(capsule.reminder?.type || 'none');

  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);

  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef(false);

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const cardRootRef = useRef<HTMLDivElement>(null);
  const hasVibratedRef = useRef(false); // 防止同一次滑动多次震动
  const isTouchRef = useRef(false);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const MENU_WIDTH = 230;
  const closeMenu = useCallback(() => {
    setShowOptions(false);
    setShowReminderPicker(false);
    setIsConfiguringCustom(false);
    setShowColorPicker(false);
    setShowCustomColorPanel(false);
    setShowTagCat(false);
    setMenuMode('actions');
    setMenuPos(null);
  }, []);

  const openMenuAt = useCallback((x: number, y: number, mode: 'actions' | 'batch' | 'context' = 'actions') => {
    const budgetH = 360;
    let left = x;
    let top = y;
    if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + budgetH > window.innerHeight - 8) top = Math.max(8, y - budgetH);
    if (top < 8) top = 8;
    setShowReminderPicker(false);
    setIsConfiguringCustom(false);
    setShowColorPicker(false);
    setShowCustomColorPanel(false);
    setShowTagCat(false);
    setMenuMode(mode);
    setMenuPos({ left, top });
    setShowOptions(true);
  }, []);

  const openMenuFromButton = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      openMenuAt(r.right - MENU_WIDTH, r.bottom + 6);
    } else {
      openMenuAt(window.innerWidth / 2 - MENU_WIDTH / 2, window.innerHeight / 2);
    }
  }, [openMenuAt]);

  const handleTouchStartSwipe = (e: React.TouchEvent) => {
    isTouchRef.current = true;
    if (showOptions || showColorPicker || showReminderPicker) return;
    if (e.touches.length === 0) return;
    if (isSelectionMode) return;

    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHorizontalSwipe.current = null;
    hasVibratedRef.current = false; // 每次新滑动开始重置
    setIsSwiping(true);

    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      if (!isSelected) {
        onToggleSelection();
      }
      const x = touchStartPos.current?.x ?? window.innerWidth / 2;
      const y = touchStartPos.current?.y ?? window.innerHeight / 2;
      onShowBatchMenu?.(x, y);

      suppressNextClickRef.current = true;
      setIsSwiping(false);
      setSwipeX(0);
      touchStartPos.current = null;
    }, 480);
  };

  const handleTouchMoveSwipe = (e: React.TouchEvent) => {
    if (!touchStartPos.current || e.touches.length === 0) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartPos.current.x;
    const dy = currentY - touchStartPos.current.y;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
    }

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();

    if (isHorizontalSwipe.current === true) {
      if (e.cancelable) e.preventDefault();
      let targetX = dx;
      if (targetX > 160) {
        targetX = 160 + (targetX - 160) * 0.15;
      } else if (targetX < -160) {
        targetX = -160 + (targetX + 160) * 0.15;
      }
      // 越过操作阈値时触发短震动反馈
      if (!hasVibratedRef.current && Math.abs(targetX) >= 100) {
        if (navigator.vibrate) navigator.vibrate([40]);
        hasVibratedRef.current = true;
      }
      setSwipeX(targetX);
    }
  };

  const handleTouchEndSwipe = () => {
    clearLongPress();
    setIsSwiping(false);
    hasVibratedRef.current = false;
    if (!touchStartPos.current) return;
    touchStartPos.current = null;

    if (isHorizontalSwipe.current === true) {
      if (swipeX > 100) {
        if (navigator.vibrate) navigator.vibrate([30]);
        if (capsule.isArchived) {
          void onUpdate({ isArchived: false });
          if (showToast) {
            showToast('Note restored!', 'success');
          }
        } else {
          let updates: Partial<Capsule> = {};
          let toastMsg = '';
          if (!capsule.isTodo) {
            updates = { isTodo: true, completed: false };
            toastMsg = 'Task created!';
          } else if (!capsule.completed) {
            updates = { completed: true };
            toastMsg = 'Task completed!';
          } else {
            updates = { completed: false };
            toastMsg = 'Task activated!';
          }
          void onUpdate(updates);
          if (showToast) {
            showToast(toastMsg, 'success');
          }
        }
      } else if (swipeX < -100) {
        if (navigator.vibrate) navigator.vibrate([30]);
        if (capsule.isArchived) {
          void onUpdate({ isDeleted: true });
          if (showToast) {
            showToast('Note deleted!', 'success');
          }
        } else {
          const nextArchivedStatus = !capsule.isArchived;
          void onUpdate({ isArchived: nextArchivedStatus });
          if (showToast) {
            showToast(nextArchivedStatus ? 'Note archived!' : 'Note unarchived!', 'success');
          }
        }
      }
    }
    setSwipeX(0);
    isHorizontalSwipe.current = null;
  };

  const handleMouseDownCard = (e: React.MouseEvent) => {
    isTouchRef.current = false;
    if (e.button !== 0) return;
    if (isSelectionMode) return;
    if (showOptions || showColorPicker || showReminderPicker) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, label, [data-no-longpress]')) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    mouseDownPos.current = { x: clientX, y: clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      if (!isSelected) {
        onToggleSelection();
      }
      onShowBatchMenu?.(clientX, clientY);
      suppressNextClickRef.current = true;
      mouseDownPos.current = null;
    }, 480);
  };
  const handleMouseMoveCard = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;
    if (
      Math.abs(e.clientX - mouseDownPos.current.x) > 6 ||
      Math.abs(e.clientY - mouseDownPos.current.y) > 6
    ) {
      clearLongPress();
      mouseDownPos.current = null;
    }
  };
  const handleMouseUpLeaveCard = () => {
    clearLongPress();
    mouseDownPos.current = null;
  };

  useEffect(() => {
    setTempCategory(capsule.category || '');
    setTempTag(capsule.tag || (capsule.tags && capsule.tags.length > 0 ? capsule.tags[0] : ''));
    setTempReminderDate(capsule.reminder?.date || null);
    setTempReminderType(capsule.reminder?.type || 'none');
  }, [capsule]);

  const onUpdate = useCallback(
    (updates: Partial<Capsule>) => {
      return patchCapsule(capsule.id, updates);
    },
    [capsule.id, patchCapsule],
  );

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (portalMenuRef.current && portalMenuRef.current.contains(target)) return;
      const insideThisCard = !!(cardRootRef.current && cardRootRef.current.contains(target));
      if ((showOptions || showReminderPicker) && insideThisCard) {
        suppressNextClickRef.current = true;
      }
      setShowOptions(false);
      setShowColorPicker(false);
      setShowCustomColorPanel(false);
      setShowReminderPicker(false);
      setIsConfiguringCustom(false);
      setShowTagCat(false);
      setMenuMode('actions');
      setMenuPos(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showOptions, showColorPicker, showReminderPicker]);

  const [customInterval, setCustomInterval] = useState(capsule.reminder?.customInterval || 1);
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>(capsule.reminder?.customUnit || 'day');

  const handleReminderSelect = (type: ReminderType) => {
    if (type === 'custom') {
      setIsConfiguringCustom(true);
    } else {
      setTempReminderType(type);
    }
  };

  const saveReminder = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission?.(permission);
      });
    }

    if (tempReminderType === 'none' && !tempReminderDate) {
      void onUpdate({ reminder: undefined });
    } else {
      const type = tempReminderType === 'none' ? 'once' : tempReminderType;
      const date = tempReminderDate || (Date.now() + 3600000);

      const reminderObj: any = {
        type,
        date
      };
      if (type === 'custom') {
        reminderObj.customInterval = customInterval;
        reminderObj.customUnit = customUnit;
      }

      void onUpdate({
        reminder: reminderObj
      });
    }
    setShowReminderPicker(false);
    setIsConfiguringCustom(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setTempReminderDate(null);
    } else {
      setTempReminderDate(new Date(val).getTime());
    }
  };

  return (
    <div
      id={`capsule-item-wrapper-${index}`}
      className={cn(
        "w-full rounded-2xl md:rounded-[24px] capsule-item-wrapper relative transition-all duration-200",
        isSelected
          ? "is-selected ring-2 ring-[#007AFF] border-transparent"
          : "",
        (showOptions || showColorPicker || showReminderPicker) ? "z-[70]" : "z-10"
      )}
    >
      <div
        id={`capsule-item-${index}`}
        className="relative overflow-hidden w-full rounded-2xl md:rounded-[24px]"
      >
      {window.innerWidth <= 768 && isSwiping && Math.abs(swipeX) > 10 && (
        <div className="absolute inset-0 z-0 flex overflow-hidden rounded-2xl md:rounded-[24px]">
          {/* 左半区 — 右滑时露出（Todo / Complete / Restore） */}
          <div className="flex-1 flex items-center pl-6 bg-transparent transition-all">
            <div className={cn(
              "flex items-center gap-2 transition-all duration-150",
              swipeX > 30 ? "opacity-100 translate-x-0 scale-100" : "opacity-0 -translate-x-4 scale-90",
              swipeX > 100 ? "scale-110" : ""
            )}>
              {capsule.isArchived ? (
                <>
                  <RotateCcw size={18} className="shrink-0 text-[#007AFF]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#007AFF]">Restore</span>
                </>
              ) : !capsule.isTodo ? (
                <>
                  <Check size={18} className="shrink-0 text-[#30D158]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#30D158]">Todo</span>
                </>
              ) : capsule.completed ? (
                <>
                  <Undo size={18} className="shrink-0 text-[#FF9500]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FF9500]">Activate</span>
                </>
              ) : (
                <>
                  <Check size={18} className="shrink-0 text-[#30D158]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#30D158]">Complete</span>
                </>
              )}
            </div>
          </div>

          {/* 右半区 — 左滑时露出（Archive / Delete） */}
          <div className="flex-1 flex items-center justify-end pr-6 bg-transparent transition-all">
            <div className={cn(
              "flex items-center gap-2 transition-all duration-150",
              swipeX < -30 ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-4 scale-90",
              swipeX < -100 ? "scale-110" : ""
            )}>
              {capsule.isArchived ? (
                <>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FF3B30] mr-0.5">Delete</span>
                  <Trash2 size={18} className="shrink-0 text-[#FF3B30]" />
                </>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#007AFF] mr-0.5">Archive</span>
                  <Archive size={18} className="shrink-0 text-[#007AFF]" />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={cardRootRef}
        className={cn(
          "group w-full shrink-0 flex relative select-none rounded-2xl md:rounded-[24px] border border-black/5 dark:border-white/5",
          viewMode === 'grid'
            ? "flex-col justify-between"
            : "items-center gap-1.5 p-2.5 md:gap-3 md:p-6",
          capsule.isTodo &&
          capsule.completed &&
          !(showOptions || showColorPicker || showReminderPicker)
            ? "opacity-60"
            : "",
          isSwiping ? "transition-none" : "transition-transform duration-200 ease-out"
        )}
        style={{
          backgroundColor: capsuleColor,
          transform: window.innerWidth <= 768 ? `translateX(${swipeX}px)` : 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'pan-y', // 允许竖向滚动传递给父容器，横向手势由我们接管
        }}
        onTouchStart={handleTouchStartSwipe}
        onTouchMove={handleTouchMoveSwipe}
        onTouchEnd={handleTouchEndSwipe}
        onTouchCancel={handleTouchEndSwipe}
        onMouseDown={handleMouseDownCard}
        onMouseMove={handleMouseMoveCard}
        onMouseUp={handleMouseUpLeaveCard}
        onMouseLeave={handleMouseUpLeaveCard}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, a, input, textarea, label, [data-no-longpress]')) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (isTouchRef.current) {
            return;
          }
          if (!isSelected) {
            onToggleSelection();
          }
          onShowBatchMenu?.(e.clientX, e.clientY);
          suppressNextClickRef.current = true;
        }}
        onClick={(e) => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            e.stopPropagation();
            return;
          }
          if (isSelectionMode) {
            e.stopPropagation();
            onToggleSelection();
          } else {
            onViewDetail();
          }
        }}
      >
        {capsule.isAmbiguous && (
          <div className="absolute inset-0 bg-black/5 dark:bg-white/5 backdrop-blur-[3.5px] z-10 flex flex-col items-center justify-center rounded-2xl md:rounded-[24px] pointer-events-none transition-all duration-300">
            <div className="bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-lg flex items-center gap-1.5 animate-pulse">
              <Sparkles size={11} className="text-[#007AFF] fill-[#007AFF]/25" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#007AFF]">Intent Pending</span>
            </div>
          </div>
        )}
        {(capsule.isPinned || capsule.isStarred || (capsule.reminder && capsule.reminder.type !== 'none' && capsule.reminder.date)) && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
            {capsule.isPinned && (
              <Pin size={13} className="text-white/80 fill-white/80 rotate-45 shrink-0 transition-opacity" />
            )}
            {capsule.isStarred && (
              <Star size={13} className="text-[#FFCC00] fill-[#FFCC00] shrink-0 transition-opacity" />
            )}
            {capsule.reminder && capsule.reminder.type !== 'none' && capsule.reminder.date && (
              <span
                title={`Reminder: ${new Date(capsule.reminder.date).toLocaleString('en-US')} (${capsule.reminder.type.charAt(0).toUpperCase() + capsule.reminder.type.slice(1)})`}
                className="inline-flex shrink-0 cursor-help"
              >
                <Bell
                  size={13}
                  className={cn(capsule.reminder.date <= Date.now() ? "text-red-200 animate-pulse" : "text-white/80")}
                />
              </span>
            )}
          </div>
        )}

        <div className={cn(
          "flex flex-col items-center gap-2 z-[20] shrink-0 transition-all",
          viewMode === 'grid' ? "absolute top-4 left-4" : "pl-1"
        )}>
          {capsule.isTodo && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelectionMode) {
                  onToggleSelection();
                } else {
                  onUpdate({ completed: !capsule.completed });
                }
              }}
              className={cn(
                "flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-white/20 border-white/40 hover:bg-white/40 hover:border-white/60",
                capsule.completed ? "bg-white/90 border-transparent text-[#007AFF]" : "text-transparent"
              )}
            >
              {capsule.completed && <Check size={16} strokeWidth={4} />}
            </button>
          )}
        </div>

        <div className={cn(
          "flex-1 min-w-0 flex flex-col h-full",
          viewMode === 'grid' ? "pt-1 justify-end text-center px-1 pb-3 md:pb-4" : "justify-end text-left pb-2"
        )}>
          <div className={cn(
            "text-base sm:text-lg md:text-xl font-bold leading-tight transition-all break-words select-none flex items-center gap-1.5 flex-wrap",
            capsule.isTodo && capsule.completed ? "line-through opacity-50 text-white/70" : "text-white",
            viewMode === 'grid' ? "whitespace-pre-wrap line-clamp-[12]" : "whitespace-pre-wrap line-clamp-3"
          )}>
            <span>{capsule.subject || plainTextFromContent(capsule.content) || 'Untitled Note'}</span>
          </div>

          <div className={cn(
            "flex flex-col gap-2 shrink-0 w-full mt-3 opacity-100 pointer-events-auto",
            viewMode === 'grid' ? "items-center" : ""
          )}>
            <div
              className={cn(
                "flex flex-wrap gap-1 md:gap-1.5",
                viewMode === 'grid' ? "justify-center" : ""
              )}
            >
              {capsule.category && (
                <span className="text-[9px] font-black uppercase bg-white/25 px-2 py-0.5 rounded-md tracking-wider text-white/90">
                  {capsule.category}
                </span>
              )}
              {(() => {
                const currentTag = capsule.tag || (capsule.tags && capsule.tags.length > 0 ? capsule.tags[0] : undefined);
                if (!currentTag) return null;
                return (
                  <span
                    key={currentTag}
                    className="text-[9px] font-black bg-black/10 px-2 py-0.5 rounded-md text-white/80"
                  >
                    #{currentTag}
                  </span>
                );
              })()}
            </div>

            <div className={cn(
              "flex flex-wrap items-center gap-2 text-[10px] text-white/60 select-none font-bold",
              viewMode === 'grid' ? "justify-center" : ""
            )}>
              <span className="inline-flex items-center gap-1">
                <Clock size={10} className="shrink-0" />
                <span className="uppercase tracking-wider">
                  {new Date(capsule.createdAt || Date.now()).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </span>
            </div>
          </div>

          <div className={cn(
            "flex flex-wrap items-center gap-2",
            viewMode === 'grid' ? "justify-center" : ""
          )}>
            {capsule.attachments && capsule.attachments.length > 0 && (
              <div className="flex items-center gap-1 text-white/60">
                <Paperclip size={12} />
                <span className="text-[10px] font-bold">{capsule.attachments.length}</span>
              </div>
            )}
          </div>
        </div>

        <div ref={menuRef} className={cn(
          "flex items-center gap-1 transition-opacity relative",
          showOptions || showReminderPicker ? "z-[110]" : "z-40",
          viewMode === 'grid' ? "absolute bottom-4 right-4" : "flex-shrink-0",
          "opacity-100"
        )}>
          <button
            id={`capsule-options-btn-${index}`}
            ref={triggerRef}
            type="button"
            aria-label="Note options"
            onClick={(e) => {
              e.stopPropagation();
              if (showOptions || showReminderPicker) { closeMenu(); } else { openMenuFromButton(); }
            }}
            className="p-2 text-white/70 hover:bg-white/25 hover:text-white rounded-full transition-colors flex items-center justify-center"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {showOptions && menuPos && createPortal(
          <motion.div
            ref={portalMenuRef}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed z-[2000] w-[200px] max-w-[calc(100vw-16px)] bg-white border border-[#E5E5EA] rounded-xl shadow-2xl overflow-hidden text-[#1D1D1F]"
            style={{ left: menuPos.left, top: menuPos.top }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {showTagCat ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1 mb-1">
                  <button onClick={(e) => { e.stopPropagation(); setShowTagCat(false); }} className="p-1 hover:bg-[#F2F2F7] rounded-md">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-tight">Tags &amp; Category</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-[#8E8E93] uppercase block mb-1">Category</label>
                    <input
                      type="text"
                      value={tempCategory}
                      onChange={(e) => setTempCategory(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. Work"
                      className="w-full px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-[#8E8E93] uppercase block mb-1">Tag</label>
                    <input
                      type="text"
                      value={tempTag}
                      onChange={(e) => setTempTag(e.target.value.replace(/,/g, ''))}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. Work"
                      className="w-full px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const cat = tempCategory.trim();
                      const tag = tempTag.trim();
                      void onUpdate({ category: cat || undefined, tag: tag || undefined });
                      closeMenu();
                    }}
                    className="w-full py-2 bg-[#007AFF] text-white rounded-lg text-xs font-bold shadow-md hover:bg-[#0051FF] transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : showColorPicker ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1 mb-1">
                  <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(false); }} className="p-1 hover:bg-[#F2F2F7] rounded-md">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-tight">Change Color</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Set color ${c}`}
                      onClick={(e) => { e.stopPropagation(); void onUpdate({ color: c }); closeMenu(); }}
                      className="w-7 h-7 rounded-full shadow-sm transition-transform hover:scale-110 flex items-center justify-center"
                      style={{
                        backgroundColor: c,
                        outline: (capsule.color || '') === c ? '2px solid #007AFF' : '2px solid transparent',
                        outlineOffset: '2px',
                      }}
                    >
                      {(capsule.color || '') === c && <Check size={12} className="text-white drop-shadow" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Reset color"
                    onClick={(e) => { e.stopPropagation(); void onUpdate({ color: null as unknown as string }); closeMenu(); }}
                    className="w-7 h-7 rounded-full border-2 border-dashed border-[#D1D1D6] bg-[#F2F2F7] text-[#8E8E93] flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    title="Reset color"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 py-1.5 px-2 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] rounded-xl cursor-pointer transition-colors relative"
                  onClick={(e) => { e.stopPropagation(); setShowCustomColorPanel(!showCustomColorPanel); }}
                >
                  <span className="text-lg select-none shrink-0 leading-none">🎨</span>
                  <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F2F2F7]">Custom color</span>

                  <span
                    className="w-5 h-5 rounded-full border border-black/10 shadow-sm ml-auto shrink-0 transition-transform hover:scale-105"
                    style={{ backgroundColor: capsule.color || '#FFD60A' }}
                  />
                </button>
                {showCustomColorPanel && (
                  <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <CustomColorPicker
                      color={capsule.color || '#FFD60A'}
                      onChange={(hex) => void onUpdate({ color: hex })}
                    />
                  </div>
                )}
              </div>
            ) : !showReminderPicker ? (
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isTodo: !capsule.isTodo }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  {capsule.isTodo ? <CheckSquare size={16} className="text-[#007AFF]" /> : <Square size={16} className="text-[#8E8E93]" />}
                  {capsule.isTodo ? 'Cancel To-do' : 'Set To-do'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReminderPicker(true); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Calendar size={16} className="text-[#8E8E93]" />
                  Set Reminder
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowColorPicker(true); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Palette size={16} className="text-[#8E8E93]" />
                  Change Color
                </button>
                {menuMode !== 'actions' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void onUpdate({ isArchived: !capsule.isArchived }); closeMenu(); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                  >
                    <Archive size={16} className="text-[#8E8E93]" />
                    {capsule.isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                )}
                {menuMode === 'context' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelection(); closeMenu(); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                  >
                    <CheckSquare size={16} className="text-[#8E8E93]" />
                    Select Note
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isStarred: !capsule.isStarred }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Star size={16} className={capsule.isStarred ? "text-[#FFCC00] fill-[#FFCC00]" : "text-[#8E8E93]"} />
                  {capsule.isStarred ? 'Unstar' : 'Star'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void onUpdate({ isPinned: !capsule.isPinned }); closeMenu(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors"
                >
                  <Pin size={16} className={capsule.isPinned ? "text-[#007AFF] fill-[#007AFF] rotate-45" : "text-[#8E8E93]"} />
                  {capsule.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const shareText = plainTextFromContent(capsule.content);
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      try { await navigator.share({ title: 'Lumi Note Share', text: shareText }); } catch (err) { console.log('Share failed or aborted', err); }
                    } else {
                      try { await navigator.clipboard.writeText(shareText); showToast('Note content copied to clipboard!', 'success'); } catch (err) { console.error('Copy to clipboard failed: ', err); }
                    }
                    closeMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm hover:bg-[#F2F2F7] font-medium rounded-lg transition-colors border-b border-[#F2F2F7] pb-1.5"
                >
                  <Share2 size={16} className="text-[#8E8E93]" />
                  Share
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); closeMenu(); }}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-sm font-semibold text-[#FF3B30] hover:bg-[#F2F2F7] rounded-lg transition-colors mt-0.5"
                >
                  Cancel
                </button>
              </div>
            ) : !isConfiguringCustom ? (
              <div className="p-1">
                <div className="px-3 py-2 border-b border-[#F2F2F7]">
                  <div className="text-[9px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">Specific Time</div>
                  <input
                    type="datetime-local"
                    value={tempReminderDate ? new Date(tempReminderDate - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={handleTimeChange}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 bg-[#F2F2F7] rounded-md text-[10px] sm:text-[11px] border-none focus:ring-2 focus:ring-[#007AFF] outline-none"
                  />
                </div>
                <div className="px-3 py-1.5 text-[9px] font-bold text-[#8E8E93] uppercase tracking-wider">Repeat</div>
                {(['once', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as ReminderType[]).map(type => (
                  <button
                    key={type}
                    onClick={(e) => { e.stopPropagation(); handleReminderSelect(type); }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-[#F2F2F7] capitalize font-medium rounded-lg transition-colors ${(tempReminderType === type || (tempReminderType === 'none' && type === 'once')) ? 'text-[#007AFF] bg-[#007AFF]/5' : 'text-[#1D1D1F]'}`}
                  >
                    <span>{type === 'once' ? 'No repeat' : type}</span>
                    {(tempReminderType === type || (tempReminderType === 'none' && type === 'once')) && <Check size={12} />}
                  </button>
                ))}
                <div className="p-2 border-t border-[#F2F2F7] mt-1 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUpdate({ reminder: undefined }); closeMenu(); }}
                    className="flex-1 py-1.5 bg-[#F2F2F7] text-[#FF3B30] rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => { saveReminder(e); closeMenu(); }}
                    className="flex-1 py-1.5 bg-[#007AFF] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#0051FF] transition-all"
                  >
                    Save
                  </button>
                </div>
                <div className="h-px bg-[#F2F2F7] mx-2 mt-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReminderPicker(false); setIsConfiguringCustom(false); }}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-[11px] hover:bg-[#F2F2F7] text-[#8E8E93] font-bold rounded-lg transition-colors"
                >
                  <ChevronLeft size={12} />
                  Back
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1 mb-1">
                  <button onClick={(e) => { e.stopPropagation(); setIsConfiguringCustom(false); }} className="p-1 hover:bg-[#F2F2F7] rounded-md">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-tight">Custom Repeat</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-[#8E8E93] uppercase block mb-1">Every</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={customInterval}
                        onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF] text-center"
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1.5 bg-[#F2F2F7] rounded-md text-xs border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
                      >
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { saveReminder(e); closeMenu(); }}
                    className="w-full py-2 bg-[#007AFF] text-white rounded-lg text-xs font-bold shadow-md hover:bg-[#0051FF] transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </motion.div>,
          document.body
        )}
      </div>
    </div>
  </div>
  );
});
