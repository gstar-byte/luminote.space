import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  LayoutGrid,
  MoveHorizontal,
  Settings as SettingsIcon,
  User as UserIcon,
  Volume2,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { PAYWALL_ACTIVE } from '../featureFlags';
import { showSystemNotification } from '../lib/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onUpgradeClick: () => void;
  onDowngradeClick?: () => void;
}

const PRO_FEATURES: { icon: React.ReactNode; title: string; description: string }[] = [
  {
    icon: <LayoutGrid size={20} />,
    title: 'Desktop home screen widget',
    description: 'Pin capture and glanceable notes on your launcher (Pro).',
  },
  {
    icon: <Bell size={20} />,
    title: 'Persistent notification',
    description: 'Shade shortcut or ongoing tile for one-tap capture.',
  },
  {
    icon: <MoveHorizontal size={20} />,
    title: 'Edge swipe capture',
    description: 'Swipe from the screen edge to start a quick note.',
  },
  {
    icon: <Volume2 size={20} />,
    title: 'Volume-key quick capture',
    description: 'Wake capture from hardware keys when the OS allows it.',
  },
];

export function SettingsModal({
  isOpen,
  onClose,
  user,
  onUpgradeClick,
  onDowngradeClick,
}: SettingsModalProps) {
  const [isConfirmingDowngrade, setIsConfirmingDowngrade] = useState(false);
  const isPro = !!user?.isPremium;

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const requestPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((res) => {
        setPermission(res);
      });
    }
  };

  const sendTestNotification = () => {
    showSystemNotification('🔔 Lumi Note Test', {
      body: 'System alerts are fully configured and active!',
      icon: '/favicon-192.png'
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#000000]/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-[#F2F2F7] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        >
          <div className="bg-white px-6 py-4 border-b border-[#E5E5EA] flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span
                className="text-2xl leading-none"
                style={{ filter: 'drop-shadow(0 0 5px #FFD700)', textShadow: '0 0 8px rgba(255,80,80,0.4)' }}
                aria-hidden
              >
                👑
              </span>
              <h2 className="text-xl font-bold tracking-tight">Pro</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-[#F2F2F7] hover:bg-[#E5E5EA] rounded-full transition-colors text-[#8E8E93]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
            {!PAYWALL_ACTIVE ? (
              <div className="flex items-center gap-2 bg-[#AF52DE]/10 rounded-2xl px-4 py-3 text-sm font-extrabold text-[#1D1D1F]">
                <span>👑</span>
                All features available. Paywall is off until billing is connected.
              </div>
            ) : !user?.isPremium ? (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="w-full flex items-center justify-center gap-2 bg-[#007AFF] text-white py-4 rounded-2xl font-black text-base shadow-sm active:scale-[0.98] transition-transform"
              >
                <span className="text-xl" style={{ filter: 'drop-shadow(0 0 4px gold)' }}>
                  👑
                </span>
                Upgrade to Pro
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-[#AF52DE]/10 rounded-2xl px-4 py-3 text-sm font-extrabold text-[#1D1D1F]">
                <span>👑</span>
                You have Lumi Note Pro
              </div>
            )}

            <div className="bg-white rounded-2xl p-4">
              <div className="flex items-center gap-4">
                {user?.photoURL ? (
                  <img
                    src={user?.photoURL}
                    alt=""
                    className="w-14 h-14 rounded-full border border-[#E5E5EA]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                    <UserIcon size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#1D1D1F] text-lg truncate">{user?.displayName || 'User'}</h3>
                  <p className="text-sm text-[#8E8E93] truncate">{user?.email}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#E5E5EA]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-[#8E8E93] uppercase tracking-wider block mb-0.5">
                      Account
                    </span>
                    {!PAYWALL_ACTIVE ? (
                      <span className="font-bold text-[#1D1D1F]">Full access</span>
                    ) : user?.isPremium ? (
                      <div className="flex items-center gap-1.5 text-[#AF52DE] font-bold">
                        <span>👑</span>
                        <span>Lumi Note Pro</span>
                      </div>
                    ) : (
                      <span className="font-bold text-[#1D1D1F]">Free</span>
                    )}
                  </div>
                  {PAYWALL_ACTIVE && user?.isPremium ? (
                    isConfirmingDowngrade ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDowngrade(false)}
                          className="text-xs text-[#8E8E93] hover:underline font-bold px-2 py-2"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDowngradeClick?.();
                            setIsConfirmingDowngrade(false);
                          }}
                          className="bg-[#FF3B30] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform"
                        >
                          Confirm
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingDowngrade(true)}
                        className="bg-transparent border border-[#FF3B30] text-[#FF3B30] px-4 py-2 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform hover:bg-red-50"
                      >
                        Downgrade
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4">
              <span className="text-sm font-bold text-[#8E8E93] uppercase tracking-wider block mb-2">
                System Notifications
              </span>
              {permission === 'granted' ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#34C759] animate-pulse" />
                    <span className="text-sm font-bold text-[#1D1D1F]">Desktop alerts active</span>
                  </div>
                  <button
                    type="button"
                    onClick={sendTestNotification}
                    className="px-3 py-1.5 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#007AFF] text-xs font-black rounded-lg transition-colors"
                  >
                    Send Test
                  </button>
                </div>
              ) : permission === 'denied' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF3B30]" />
                    <span className="text-sm font-bold text-[#FF3B30]">Blocked by browser</span>
                  </div>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    Please click the lock icon (🔒) or settings icon in your browser's address bar to re-allow notifications.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#AEAEB2]" />
                    <span className="text-sm font-bold text-[#8E8E93]">Permission not requested</span>
                  </div>
                  <button
                    type="button"
                    onClick={requestPermission}
                    className="px-3 py-1.5 bg-[#007AFF] hover:bg-[#0062CC] text-white text-xs font-black rounded-lg shadow-sm transition-colors"
                  >
                    Enable Alerts
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-[#1D1D1F] flex items-center gap-2">
                <span className="text-base">👑</span>
                <span className="text-white text-sm font-bold tracking-tight">Pro features</span>
              </div>

              <div className="divide-y divide-[#E5E5EA]">
                {PRO_FEATURES.map((f) => (
                  <ToggleRow
                    key={f.title}
                    icon={f.icon}
                    title={f.title}
                    description={f.description}
                    checked={isPro}
                    onChange={() => {
                      if (!isPro) onUpgradeClick();
                    }}
                    locked={isPro}
                  />
                ))}
              </div>
              {!isPro ? (
                <p className="text-xs font-semibold text-[#8E8E93] px-4 py-3 bg-white">
                  Flip a switch on to open checkout — subscribe to unlock these shortcuts.
                </p>
              ) : null}
            </div>

            <div className="pt-2 pb-6 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-[#8E8E93]">
                <SettingsIcon size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Lumi Note v1.0.4</span>
              </div>
              <button type="button" onClick={onClose} className="text-sm font-bold text-[#007AFF] hover:underline">
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  locked: boolean;
}) {
  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-[#1D1D1F]">{title}</h4>
          <p className="text-xs text-[#8E8E93] leading-tight mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        disabled={locked}
        className={`w-12 h-7 rounded-full p-1 transition-colors flex shrink-0 ${
          checked ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'
        } ${locked ? 'opacity-90 cursor-default' : ''}`}
        aria-pressed={checked}
      >
        <motion.div
          className="w-5 h-5 bg-white rounded-full shadow-sm"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
