import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppLogo } from './AppLogo';
import { Zap, Mic, CheckSquare, Sparkles, Command, Shield, ArrowRight, Share2, Palette, Clock, Repeat, CalendarDays, Smartphone, Monitor, Tablet, Apple, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { getAuth, getGoogleProvider, signInWithPopup, signInWithRedirect } from '../lib/firebase';
import { Helmet } from 'react-helmet-async';

interface LandingPageProps {
  onLogin: (isRegistering?: boolean) => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const handleGoogleLogin = async () => {
    try {
      const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(getAuth(), getGoogleProvider());
      } else {
        await signInWithPopup(getAuth(), getGoogleProvider());
      }
    } catch (error) {
      console.error("Google login error", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-[#007AFF] selection:text-white overflow-x-hidden">
      <Helmet>
        <title>Lumi Note – Lightning Capture, AI‑Parsed Notes, To‑Do & Alerts</title>
        <meta name="description" content="Lumi Note is a lightning-fast, beautiful notepad that uses color to organize your mind. Categorize and prioritize instantly with chromative visual cues." />
        <meta property="og:title" content="Lumi Note – Lightning Capture, AI‑Parsed Notes, To‑Do & Alerts" />
        <meta property="og:description" content="Lumi Note is a lightning-fast, beautiful notepad that uses color to organize your mind. Categorize and prioritize instantly with chromative visual cues." />
        <meta property="og:url" content="https://luminote.space" />
        <meta property="og:image" content="https://luminote.space/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Lumi Note – Lightning Capture, AI‑Parsed Notes, To‑Do & Alerts" />
        <meta name="twitter:description" content="Lumi Note is a lightning-fast, beautiful notepad that uses color to organize your mind." />
        <meta name="twitter:image" content="https://luminote.space/og-image.png" />
        <link rel="canonical" href="https://luminote.space/" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": "https://luminote.space",
            "name": "Lumi Note",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://luminote.space/search?q={search_term_string}",
              "query-input": "required name=search_term_string"
            },
            "contactPoint": {
              "@type": "ContactPoint",
              "email": "mailto:hello@luminote.space",
              "url": "https://luminote.space/contact",
              "contactType": "customer support"
            }
          })}
        </script>
      </Helmet>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-2">
            <AppLogo className="w-[90px] h-[90px] md:w-[108px] md:h-[108px] shrink-0" />
            <span className="font-bold text-lg tracking-tight">Lumi Note</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => onLogin(false)} className="text-sm font-medium text-white/70 hover:text-white transition-colors">
              Log in
            </button>
            <button onClick={() => onLogin(true)} className="bg-white text-black px-3.5 py-1.5 md:px-5 md:py-2 rounded-full text-xs md:text-sm font-bold hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 relative overflow-hidden">
        {/* Animated Mesh Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-[#007AFF]/30 to-purple-600/30 blur-[120px] rounded-full mix-blend-screen animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-to-bl from-rose-500/30 to-orange-500/30 blur-[130px] rounded-full mix-blend-screen animate-blob animation-delay-2000" />
          <div className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-blue-500/20 to-teal-400/20 blur-[150px] rounded-full mix-blend-screen animate-blob animation-delay-4000" />
          
          {/* Subtle noise texture */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        </div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8">
              <Sparkles size={14} className="text-[#FF2D55]" />
              <span className="text-xs font-semibold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-[#00F0FF] via-[#FF2D55] to-[#FF9500]">THE NEXT-GEN COLOR AESTHETIC NOTEBOOK</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-8 leading-[1.05]">
              Create high-aesthetic notes, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-[#FF2D55] to-[#FF9500]">todos & reminders in a single breath.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              Lumi Note is a next-generation color-aesthetic capsule notepad designed for lightning-fast capture. Type a single sentence to instantly generate beautifully-styled notes, fluid to-dos, and smart reminders. Bring harmony to your daily flow—where rapid organization meets premium design.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button onClick={() => onLogin()} className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-all flex items-center justify-center gap-2 group">
              Start Free Capture
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={handleGoogleLogin} className="w-full sm:w-auto px-6 py-4 bg-white/10 border border-white/20 text-white backdrop-blur-md rounded-full font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Sign in with Google - Secure and Fast Authentication" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Google
            </button>
          </motion.div>

          {/* App Download Links (Demo) */}
          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.8, delay: 0.5 }}
             className="flex flex-col items-center border-t border-white/10 pt-8 mt-8"
          >
            <p className="text-sm text-white/40 font-medium mb-6 uppercase tracking-widest">Coming soon on mobile</p>
            <div className="flex flex-wrap justify-center gap-4">
               <a href="#demo-ios" className="flex items-center gap-3 px-5 py-3 bg-[#1D1D1F] border border-white/10 rounded-2xl hover:bg-black transition-colors w-[180px]">
                  <Apple size={28} className="text-white" />
                  <div className="text-left flex flex-col text-white">
                    <span className="text-[10px] opacity-70 leading-none mb-1">Download on the</span>
                    <span className="text-sm font-bold leading-none">App Store</span>
                  </div>
                </a>
                <a href="#demo-android" className="flex items-center gap-3 px-5 py-3 bg-[#1D1D1F] border border-white/10 rounded-2xl hover:bg-black transition-colors w-[180px]">
                  <Play size={24} className="text-white" fill="currentColor" />
                  <div className="text-left flex flex-col text-white">
                    <span className="text-[10px] opacity-70 leading-none mb-1">GET IT ON</span>
                    <span className="text-sm font-bold leading-none">Google Play</span>
                  </div>
                </a>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Brand Philosophy Section */}
      <section className="py-20 px-6 relative z-10 bg-gradient-to-b from-transparent to-black/30">
        <div className="max-w-5xl mx-auto border-t border-b border-white/10 py-16 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-left">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-4 text-white">
              Color + Mindflow <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">= Lumi Note</span>
            </h2>
            <p className="text-[#007AFF] font-semibold text-lg uppercase tracking-wider">Why color-coded note-taking works</p>
          </div>
          <div className="flex-1 text-left text-white/70 space-y-4 text-base font-light leading-relaxed">
            <p>
              Monochrome lists make all your thoughts look identical. But a fleeting inspiration shouldn't look exactly like a grocery list. Your brain naturally prioritizes by color, and your notes should do the same.
            </p>
            <p>
              <strong>Lumi Note</strong> combines minimalist card layouts with intuitive color keys. Categorize and prioritize instantly with beautiful chromative cues, keeping your daily capture fast, natural, and highly visual.
            </p>
          </div>
        </div>
      </section>

      {/* Multi-Device UI Previews Mockups */}
      <section className="py-24 relative overflow-hidden bg-black/40 border-y border-white/5">
         <div className="max-w-[1400px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black mb-4">Sleek layout. Fluid sync.</h2>
              <p className="text-white/60 text-lg">Experience the lightweight interface of Lumi Note—meticulously optimized for lists, grids, and multi-device cloud synchronization.</p>
            </div>

            <div className="relative h-auto xl:h-[600px] py-10 xl:py-0 w-full flex flex-col xl:flex-row items-center justify-center gap-16 xl:gap-8 perspective-[1500px]">
              
              {/* Desktop Mockup */}
              <motion.div 
                initial={{ opacity: 0, x: -50, rotateY: 20 }}
                whileInView={{ opacity: 1, x: 0, rotateY: 10 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1 }}
                className="w-[90%] md:w-[700px] max-w-full aspect-[16/10] bg-[#111] rounded-[24px] p-2 border border-[#333] shadow-2xl z-10 shrink-0 transform-gpu xl:translate-x-12 hover:rotateY-0 hover:z-30 hover:scale-105 transition-all duration-500"
              >
                <div className="w-full h-full bg-[#FAFAFC] rounded-[18px] overflow-hidden flex flex-col pointer-events-none">
                  {/* Browser minimal header */}
                  <div className="h-8 md:h-10 bg-white border-b border-black/5 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-400"></div><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-400"></div><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-400"></div></div>
                  </div>
                  {/* App Content */}
                  <div className="flex-1 p-4 md:p-6 bg-white overflow-hidden">
                    <div className="w-full max-w-2xl mx-auto space-y-4">
                       <div className="w-full h-12 md:h-14 rounded-full bg-[#F2F2F7] mb-6 md:mb-8 flex items-center px-4 md:px-6"><span className="text-black/30 text-xs md:text-sm">Capture anything...</span></div>
                       {/* List Mockup items */}
                       <div className="h-16 md:h-20 bg-[#FFCA28] rounded-2xl flex items-center px-4 md:px-6 relative overflow-hidden shadow-sm">
                          <div className="w-4 h-4 md:w-5 md:h-5 rounded border border-black/20 mr-4"></div>
                          <div className="w-1/2 h-4 bg-black/20 rounded-md"></div>
                          <div className="absolute right-4 md:right-6 px-2 md:px-3 py-1 bg-white/30 rounded-full text-[8px] md:text-[10px] font-bold">NOTE</div>
                       </div>
                       <div className="h-16 md:h-20 bg-[#AF52DE] rounded-2xl flex items-center px-4 md:px-6 relative overflow-hidden shadow-sm">
                          <div className="w-4 h-4 md:w-5 md:h-5 rounded border border-black/20 mr-4"></div>
                          <div className="w-2/3 h-4 bg-black/20 rounded-md"></div>
                       </div>
                       <div className="h-16 md:h-20 bg-[#007AFF] rounded-2xl flex items-center px-4 md:px-6 relative overflow-hidden shadow-sm">
                          <div className="w-4 h-4 md:w-5 md:h-5 rounded border-2 border-black/80 flex items-center justify-center mr-4 bg-white/20 text-white text-[8px] md:text-base">✔</div>
                          <div className="w-1/3 h-4 bg-black/20 rounded-md line-through opacity-60"></div>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Tablet Grid Mockup */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="w-[85%] md:w-[480px] max-w-full aspect-[4/3] bg-[#222] rounded-[24px] md:rounded-[32px] border-4 border-[#333] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 md:p-4 z-20 shrink-0 transform-gpu xl:-translate-y-12 hover:z-30 hover:scale-105 transition-all duration-500"
              >
                 <div className="w-full h-full bg-[#f4f4f5] rounded-[16px] md:rounded-[24px] overflow-hidden p-4 md:p-6">
                    <h3 className="text-black font-bold text-lg md:text-xl mb-3 md:mb-4">Grid View</h3>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div className="aspect-square bg-[#34C759] rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col justify-between">
                         <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-black/20"></div>
                         <div className="space-y-1.5 md:space-y-2"><div className="w-full h-2 md:h-3 bg-black/20 rounded"></div><div className="w-2/3 h-2 md:h-3 bg-black/20 rounded"></div></div>
                      </div>
                      <div className="aspect-square bg-[#FF2D55] rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col justify-between">
                         <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-black/20"></div>
                         <div className="space-y-1.5 md:space-y-2"><div className="w-full h-2 md:h-3 bg-black/20 rounded"></div><div className="w-4/5 h-2 md:h-3 bg-black/20 rounded"></div></div>
                      </div>
                      <div className="aspect-square bg-[#5856D6] rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col justify-between">
                         <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-black/20"></div>
                         <div className="space-y-1.5 md:space-y-2"><div className="w-3/4 h-2 md:h-3 bg-black/20 rounded"></div></div>
                      </div>
                      <div className="aspect-square bg-[#FF9500] rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col justify-between">
                         <div className="px-2 md:px-3 py-1 bg-white/30 rounded-full text-black/50 text-[8px] md:text-[10px] w-fit font-bold">NOTE</div>
                         <div className="space-y-1.5 md:space-y-2"><div className="w-full h-2 md:h-3 bg-black/20 rounded"></div></div>
                      </div>
                    </div>
                  </div>
              </motion.div>

              {/* Mobile Mockup */}
              <motion.div 
                initial={{ opacity: 0, x: 50, rotateY: -20 }}
                whileInView={{ opacity: 1, x: 0, rotateY: -10 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1, delay: 0.4 }}
                className="w-[280px] max-w-[75vw] aspect-[9/19.5] bg-black rounded-[46px] border-[6px] border-[#333] shadow-2xl p-2 z-10 shrink-0 transform-gpu xl:-translate-x-12 ring-1 ring-white/10 hover:rotateY-0 hover:z-30 hover:scale-105 transition-all duration-500"
              >
                  <div className="w-full h-full bg-white rounded-[34px] overflow-hidden relative pb-20 pt-12 px-4 shadow-inner pointer-events-none">
                     {/* Dynamic Island fake */}
                     <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full"></div>
                     <div className="flex justify-between items-center mb-6 mt-4">
                       <span className="font-bold text-black text-2xl tracking-tight">Today</span>
                       <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                     </div>
                     <div className="space-y-3">
                       <div className="bg-[#434343] p-4 rounded-2xl flex flex-col gap-2">
                         <div className="flex justify-between w-full items-center"><div className="w-4 h-4 rounded border border-white/30"></div><span className="text-white/50 text-xs">08:00 AM</span></div>
                         <div className="w-full h-3 bg-white/20 rounded mt-2"></div>
                       </div>
                       <div className="bg-[#007AFF] p-4 rounded-2xl flex flex-col gap-2 shadow-lg shadow-blue-500/20">
                         <div className="flex justify-between w-full items-center"><div className="w-4 h-4 rounded border-2 border-white flex items-center justify-center bg-white/20"><span className="text-white text-[8px]">✔</span></div><div className="flex items-center gap-1 text-white/80 text-[10px] bg-white/20 px-2 py-0.5 rounded-full"><Clock size={10} /> Repeat</div></div>
                         <div className="w-3/4 h-3 bg-white/30 rounded line-through mt-2"></div>
                       </div>
                       <div className="bg-[#FF9500] p-4 rounded-2xl flex flex-col gap-2">
                         <div className="flex justify-between w-full items-center"><div className="w-4 h-4 rounded border border-black/20"></div><div className="flex items-center gap-1 text-black/40 text-[10px] bg-white/30 px-2 py-0.5 rounded-full"><CalendarDays size={10} /> 5 days left</div></div>
                         <div className="w-full h-3 bg-black/20 rounded mt-2"></div>
                         <div className="w-1/2 h-3 bg-black/20 rounded"></div>
                       </div>
                     </div>
                     {/* Floating fake nav */}
                     <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 h-14 bg-black/90 backdrop-blur-xl rounded-full flex items-center justify-around px-4">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex justify-center items-center"><span className="text-white font-bold">+</span></div>
                     </div>
                  </div>
              </motion.div>

            </div>
         </div>
      </section>

      {/* Feature Section Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Built for fast minds.</h2>
            <p className="text-xl text-white/60">Clean, friction-free features to help you capture and organize without breaking your flow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<CalendarDays className="text-[#34C759]" size={28} />}
              title="Countdowns & Deadlines"
              desc="Keep track of high-priority tasks. See exactly how many days are left to execute."
            />
            <FeatureCard 
              icon={<Repeat className="text-[#007AFF]" size={28} />}
              title="Smart Recurrence"
              desc="Set notes to repeat daily, weekly, or monthly. Perfect for keeping track of your routines."
            />
            <FeatureCard 
              icon={<CheckSquare className="text-[#AF52DE]" size={28} />}
              title="Task Checklists"
              desc="Turn text into actionable check-boxes instantly. Clear tasks with zero friction."
            />
            <FeatureCard 
              icon={<Palette className="text-[#FF2D55]" size={28} />}
              title="Color-Coded Library"
              desc="Organize thoughts using custom color keys. Navigate your notes visually instead of reading through endless text."
            />
            <FeatureCard 
              icon={<Tablet className="text-[#FF9500]" size={28} />}
              title="List & Grid Layouts"
              desc="Switch instantly between a minimal chronological stream and an expansive visual grid."
            />
            <FeatureCard 
              icon={<Monitor className="text-white" size={28} />}
              title="Real-Time Cloud Sync"
              desc="Securely sync your notes across all devices instantly. Your ideas are always up to date."
            />
          </div>
        </div>
      </section>

      {/* Contact Form / About */}
      <section aria-labelledby="contact-heading" className="py-32 px-6 relative overflow-hidden bg-[#111] border-t border-white/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full" />

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 relative z-10">
          <div>
            <h2 id="contact-heading" className="text-4xl md:text-5xl font-black mb-8">About Lumi Note</h2>
            <p className="text-white/60 mb-8 leading-relaxed text-lg text-balance">
              Lumi Note is built for creators, thinkers, and makers who want a faster, more beautiful way to capture ideas. We believe software should be fast, quiet, and respect your attention. No bloated features—just your mind, organized.
            </p>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Company HQ</span>
                <span className="font-medium text-white/80">1440 Innovation Park Dr.</span>
                <span className="font-medium text-white/80">San Francisco, CA 94158</span>
                <span className="font-medium text-white/80">United States</span>
              </div>
              <div className="flex flex-col pt-4 border-t border-white/10">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Direct Contact</span>
                <a href="mailto:hello@luminote.space" className="text-[#007AFF] hover:underline font-medium text-lg">hello@luminote.space</a>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-md rounded-[32px] p-8 md:p-10 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <h3 className="text-2xl font-bold mb-8 relative z-10">Send a Message</h3>
            <form className="space-y-5 relative z-10" onSubmit={(e) => { e.preventDefault(); alert('Message sent (demo)!'); }}>
              <div>
                <input type="text" required placeholder="Your name" className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all text-white placeholder-white/30 font-medium" />
              </div>
              <div>
                <input type="email" required placeholder="Email address" className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all text-white placeholder-white/30 font-medium" />
              </div>
              <div>
                <textarea required rows={4} placeholder="What's on your mind?" className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] transition-all text-white placeholder-white/30 font-medium resize-none" />
              </div>
              <button type="submit" className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-gray-200 transition-colors shadow-lg active:scale-95 duration-200 text-lg">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-black text-center relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
             <AppLogo className="w-[72px] h-[72px] md:w-[81px] md:h-[81px] shrink-0" />
             <span className="font-bold text-white/80">Lumi Note</span>
          </div>
          <p className="text-white/40 text-sm">
            Capture thoughts in full color. © {new Date().getFullYear()} All rights reserved.
          </p>
          <div className="flex gap-4">
             <a href="/privacy.html" className="text-white/40 hover:text-white transition-colors text-sm">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 transition-all hover:scale-[1.02] hover:bg-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:border-white/20 group backdrop-blur-sm">
      <div className="w-16 h-16 bg-black/40 rounded-[20px] flex items-center justify-center shadow-inner mb-6 group-hover:scale-110 transition-transform duration-500 border border-white/5 group-hover:border-white/20">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-white/50 leading-relaxed font-light">{desc}</p>
    </div>
  );
}
