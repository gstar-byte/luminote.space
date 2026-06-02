import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { X, LayoutGrid, Bell, MoveHorizontal, Volume2 } from 'lucide-react';
import { UserProfile } from '../types';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess: () => void;
  hideFeatures?: boolean;
}

export function PremiumModal({ isOpen, onClose, user, onSuccess, hideFeatures = false }: PremiumModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#000000]/60 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className={cn(
            "relative w-full flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden",
            hideFeatures ? "max-w-sm" : "max-w-lg max-h-[90dvh]"
          )}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-[#007AFF] to-[#AF52DE] shrink-0 p-5 md:p-6 text-white relative">
             <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors text-white z-10"
             >
               <X size={18} />
             </button>
             
             <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 md:mb-4 shadow-sm backdrop-blur-sm">
                <span
                  className="text-2xl md:text-3xl leading-none"
                  style={{ filter: 'drop-shadow(0 0 6px #FFD700)', textShadow: '0 0 10px rgba(255,80,80,0.55)' }}
                  aria-hidden
                >
                  👑
                </span>
             </div>
             
              <h2 className="text-xl md:text-2xl font-extrabold mb-1 tracking-tight">Upgrade to Pro</h2>
              <p className="text-white/85 font-medium text-xs md:text-sm leading-tight">Unlock the full power of Lumi Note. One-time payment. Lifetime access.</p>
          </div>
          
          <div className="p-5 md:p-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
             {!hideFeatures && (
               <div className="space-y-4 mb-8">
                 <Feature icon={<LayoutGrid size={20} />} title="Desktop home screen widget" description="Pin capture and glanceable notes on your launcher." />
                 <Feature icon={<Bell size={20} />} title="Persistent notification" description="Shade shortcut or ongoing tile for one-tap capture." />
                 <Feature icon={<MoveHorizontal size={20} />} title="Edge swipe capture" description="Swipe from the screen edge to start a quick note." />
                 <Feature icon={<Volume2 size={20} />} title="Volume-key quick capture" description="Hardware keys wake capture where the OS allows." />
               </div>
             )}
             
             <div className="bg-[#F2F2F7] rounded-2xl p-4 mb-5 flex flex-col items-center">
                 <p className="text-[#8E8E93] text-[10px] font-bold uppercase tracking-wider mb-1">Lifetime Deal</p>
                 <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#1D1D1F]">$88.99</span>
                    <span className="text-lg font-bold text-[#8E8E93] line-through">$129.99</span>
                 </div>
             </div>
             
             {error && (
               <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                 {error}
               </div>
             )}
             
             {isProcessing ? (
               <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold text-[#8E8E93] animate-pulse">Processing your payment...</p>
               </div>
             ) : (
                <>
                  <PayPalScriptProvider options={{ 
                     clientId: (import.meta as any).env.VITE_PAYPAL_CLIENT_ID || "test", // Uses sandbox ID "test" by default
                     currency: "USD",
                     intent: "capture"
                  }}>
                    <PayPalButtons 
                      style={{ layout: "vertical", shape: "pill", color: "blue", label: "pay" }}
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          intent: "CAPTURE",
                          purchase_units: [
                            {
                              description: "Lumi Note Pro - Lifetime Deal",
                              amount: {
                                currency_code: "USD",
                                value: "88.99"
                              }
                            }
                          ]
                        });
                      }}
                      onApprove={async (data, actions) => {
                         setIsProcessing(true);
                         try {
                            if (actions.order) {
                               const details = await actions.order.capture();
                               if (details.status === "COMPLETED") {
                                  onSuccess();
                               } else {
                                  setError("Payment was not completed. Status: " + details.status);
                               }
                            }
                         } catch (err: any) {
                            setError(err.message || "An error occurred during payment processing.");
                         } finally {
                            setIsProcessing(false);
                         }
                      }}
                      onError={(err) => {
                         console.error("PayPal Checkout onError", err);
                         setError("Failed to load PayPal checkout. Check your connection or try again.");
                      }}
                    />
                  </PayPalScriptProvider>
                  
                  {/* Mock Payment Button for Testing */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#E5E5EA]"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white text-[#8E8E93] font-medium">Or for testing</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onSuccess()}
                    className="w-full py-3 bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-lg leading-none" style={{ filter: 'drop-shadow(0 0 4px #FFD700)' }} aria-hidden>👑</span>
                    Unlock VIP for Free (Test Mode)
                  </button>
                </>
             )}
             <p className="text-center text-[10px] text-[#8E8E93] font-medium mt-3">Secure payment via PayPal. 100% money-back guarantee.</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex items-start gap-4">
       <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
         {icon}
       </div>
       <div>
         <h4 className="font-bold text-[#1D1D1F]">{title}</h4>
         <p className="text-sm text-[#8E8E93] leading-relaxed">{description}</p>
       </div>
    </div>
  );
}
