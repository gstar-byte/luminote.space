import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings as SettingsIcon,
  User as UserIcon,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { showSystemNotification } from '../lib/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export function SettingsModal({
  isOpen,
  onClose,
  user,
}: SettingsModalProps) {
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
              <SettingsIcon size={20} className="text-[#8E8E93]" />
              <h2 className="text-xl font-bold tracking-tight">Settings</h2>
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
