import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings as SettingsIcon,
  User as UserIcon,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { showSystemNotification } from '../lib/notifications';
import { subscribeToPush } from '../lib/webPush';

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
  
  const [isPushActive, setIsPushActive] = useState(false);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.active) {
          reg.pushManager.getSubscription().then(sub => {
            setIsPushActive(!!sub);
          }).catch(() => setIsPushActive(false));
        } else {
          setIsPushActive(false);
        }
      }).catch(() => setIsPushActive(false));
    }
  }, [isOpen]);

  const [provider, setProvider] = useState<'deepseek' | 'gemini' | 'local'>(() => {
    try {
      const saved = localStorage.getItem('luminote_nlp_provider');
      if (saved === 'deepseek' || saved === 'gemini' || saved === 'local') return saved;
    } catch {}
    return 'gemini'; // 默认直接使用 Gemini
  });

  const [geminiKey, setGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('luminote_gemini_api_key') || '';
    } catch {
      return '';
    }
  });

  const [deepseekKey, setDeepseekKey] = useState(() => {
    try {
      return localStorage.getItem('luminote_deepseek_api_key') || '';
    } catch {
      return '';
    }
  });

  const handleProviderChange = (val: 'deepseek' | 'gemini' | 'local') => {
    setProvider(val);
    try {
      localStorage.setItem('luminote_nlp_provider', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleGeminiKeyChange = (val: string) => {
    setGeminiKey(val);
    try {
      localStorage.setItem('luminote_gemini_api_key', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleDeepseekKeyChange = (val: string) => {
    setDeepseekKey(val);
    try {
      localStorage.setItem('luminote_deepseek_api_key', val);
    } catch (e) {
      console.warn(e);
    }
  };

  const requestPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((res) => {
        setPermission(res);
        if (res === 'granted' && user) {
          subscribeToPush(user.uid).catch((err) => 
            console.warn('[WebPush] subscribeToPush failed:', err)
          );
        }
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
                <div className="flex flex-col gap-3 w-full bg-[#F2F2F7] p-3 rounded-xl border border-[rgba(0,0,0,0.05)]">
                  {/* Row 1: Alerts Active */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.8)]" />
                      <span className="text-xs font-bold text-[#1D1D1F]">Alerts active</span>
                    </div>
                    <span className="text-[10px] font-black text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-md">OK</span>
                  </div>
                  
                  {/* Row 2: Sync Push */}
                  <div className="flex items-center justify-between gap-2 border-t border-[#E5E5EA] pt-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isPushActive ? 'bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.8)]' : 'bg-[#FF3B30] shadow-[0_0_8px_rgba(255,59,48,0.8)]'}`} />
                      <span className="text-xs font-bold text-[#1D1D1F]">Sync push</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (user) {
                          const ok = await subscribeToPush(user.uid);
                          if (ok) {
                            setIsPushActive(true);
                            alert('✅ System notification synchronized successfully!');
                          } else {
                            setIsPushActive(false);
                            alert('❌ Failed to synchronize. Check your connection (VPN may be required in some regions).');
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-[#E5E5EA] hover:bg-[#E5E5EA] text-[#2E7D32] text-xs font-black rounded-lg transition-colors cursor-pointer"
                    >
                      Sync Now
                    </button>
                  </div>
                  
                  {/* Row 3: Send Test */}
                  <div className="flex items-center justify-between gap-2 border-t border-[#E5E5EA] pt-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isPushActive ? 'bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.8)]' : 'bg-[#E5E5EA]'}`} />
                      <span className="text-xs font-bold text-[#1D1D1F]">Send test</span>
                    </div>
                    <button
                      type="button"
                      onClick={sendTestNotification}
                      className="px-2.5 py-1 bg-white border border-[#E5E5EA] hover:bg-[#E5E5EA] text-[#007AFF] text-xs font-black rounded-lg transition-colors cursor-pointer"
                    >
                      Test
                    </button>
                  </div>
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

            {/* AI Helper Settings */}
            <div className="bg-white rounded-2xl p-4">
              <span className="text-sm font-bold text-[#8E8E93] uppercase tracking-wider block mb-3">
                AI Helper Configuration
              </span>
              
              <div className="space-y-3">
                {/* Provider Selector */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[#1D1D1F]">AI Model</label>
                  <select
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value as any)}
                    className="text-xs bg-[#F2F2F7] border-none rounded-lg px-2 py-1.5 font-bold outline-none text-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/10 cursor-pointer"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="deepseek">DeepSeek AI</option>
                    <option value="local">Local Parser (No AI)</option>
                  </select>
                </div>

                {/* API Key Inputs */}
                {provider === 'gemini' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#8E8E93]">Gemini API Key</label>
                      <a 
                        href="https://aistudio.google.com/" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-[#007AFF] hover:underline font-bold"
                      >
                        Get Key ↗
                      </a>
                    </div>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => handleGeminiKeyChange(e.target.value)}
                      placeholder="Paste your Gemini API key here..."
                      className="w-full text-xs bg-[#F2F2F7] border-none rounded-lg px-3 py-2 outline-none text-[#1D1D1F] placeholder-[#8E8E93] focus:ring-1 focus:ring-[#007AFF]/10"
                    />
                  </div>
                )}

                {provider === 'deepseek' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#8E8E93]">DeepSeek API Key</label>
                      <a 
                        href="https://platform.deepseek.com/" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-[#007AFF] hover:underline font-bold"
                      >
                        Get Key ↗
                      </a>
                    </div>
                    <input
                      type="password"
                      value={deepseekKey}
                      onChange={(e) => handleDeepseekKeyChange(e.target.value)}
                      placeholder="Paste your DeepSeek API key here..."
                      className="w-full text-xs bg-[#F2F2F7] border-none rounded-lg px-3 py-2 outline-none text-[#1D1D1F] placeholder-[#8E8E93] focus:ring-1 focus:ring-[#007AFF]/10"
                    />
                  </div>
                )}
              </div>
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
