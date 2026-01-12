import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Settings, Activity, Server, ShieldCheck, ArrowRight, Loader2, Minus, X, Square as MaximizeIcon } from "lucide-react";

const StarShape = ({ className, style }) => (
  <svg viewBox="0 0 100 100" className={className} style={style}>
    <path
      d="M50 0 L61 35 L98 35 L68 57 L79 92 L50 70 L21 92 L32 57 L2 35 L39 35 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isEnteringDashboard, setIsEnteringDashboard] = useState(false);
  const [status, setStatus] = useState({ running: false, port: 8080 });

  const pullStatus = async () => {
    try {
      const currentStatus = await window.electronAPI.getProxyStatus();
      setStatus(currentStatus);
      setIsRunning(currentStatus.running);
      if (!currentStatus.running && showDashboard) setShowDashboard(false);
    } catch (err) {
      console.error('Failed to get status:', err);
    }
  };

  useEffect(() => {
    pullStatus();
    const interval = setInterval(pullStatus, 3000);
    return () => clearInterval(interval);
  }, [showDashboard]);

  const handleToggleProxy = async () => {
    setIsLoading(true);
    try {
      if (isRunning) {
        await window.electronAPI.stopProxy();
      } else {
        await window.electronAPI.startProxy();
      }
      await pullStatus();
    } catch (err) {
      console.error('Proxy toggle failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMinimize = () => window.electronAPI.minimize();
  const handleMaximize = () => window.electronAPI.maximize();
  const handleClose = () => window.electronAPI.close();

  const handleAccessDashboard = () => {
    setIsEnteringDashboard(true);
    setTimeout(() => {
      setShowDashboard(true);
      setIsEnteringDashboard(false);
    }, 2000);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#e07b62] text-[#3d2e2a] flex flex-col relative font-['Outfit'] select-none">
      {/* Anthropic Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#e07b62] via-[#e89a7a] to-[#f4d1b5] z-0" />

      {/* Decorative Stars (Static for now, can animate with framer) */}
      <StarShape className="absolute top-[20%] left-[15%] w-16 h-16 text-white/40 blur-[1px]" />
      <StarShape className="absolute top-[30%] right-[10%] w-24 h-24 text-white/40" />
      <StarShape className="absolute bottom-[15%] left-[10%] w-20 h-20 text-white/40" />

      {/* Custom Title Bar Drag Region */}
      <div className="h-10 w-full drag-region flex items-center justify-between px-6 z-50">
        <span className="text-[10px] font-bold tracking-[0.2em] text-white flex items-center gap-2 drop-shadow-sm">
          <img src="/claude-star.png" className="w-4 h-4 rounded-sm" alt="logo" />
          ACROXY
        </span>
        <div className="flex items-center gap-4 no-drag text-[11px] font-semibold text-white/90">
          <span className="cursor-pointer hover:text-white transition-colors">Research</span>
          <span className="cursor-pointer hover:text-white transition-colors">Company</span>
          <span className="cursor-pointer hover:text-white transition-colors">Help</span>

          <div className="flex items-center gap-1 ml-4 border-l border-white/20 pl-4">
            <button onClick={handleMinimize} className="p-1.5 hover:bg-white/10 rounded transition-colors"><Minus className="w-3 h-3" /></button>
            <button onClick={handleMaximize} className="p-1.5 hover:bg-white/10 rounded transition-colors"><MaximizeIcon className="w-3 h-3 text-[10px]" /></button>
            <button onClick={handleClose} className="p-1.5 hover:bg-red-500/80 hover:text-white rounded transition-colors"><X className="w-3 h-3" /></button>
          </div>
        </div>
      </div>

      <main className="flex-grow flex flex-col items-center justify-center p-8 z-10 relative">
        <AnimatePresence mode="wait">
          {!showDashboard ? (
            <motion.div
              key="control"
              className="w-full max-w-2xl flex flex-col items-center text-center space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm text-sm font-medium border border-white/20">
                <span className="text-[#e07b62]">Claude Code Free!</span>
                <ArrowRight className="w-4 h-4 text-[#e07b62]" />
              </div>

              <h1 className="text-8xl font-serif text-white tracking-tight leading-tight italic drop-shadow-xl">
                <span className="not-italic">ACROXY</span>
              </h1>

              <p className="max-w-md text-lg text-[#3d2e2a]/80 font-medium leading-relaxed drop-shadow-sm">
                Next-generation proxy infrastructure by Infused Arts. Whether you're building alone or with a team, ACROXY is here to empower you.
              </p>

              <div className="flex items-center gap-4 pt-4 no-drag">
                <button
                  onClick={handleToggleProxy}
                  disabled={isLoading}
                  className={`px - 8 py - 4 rounded - full text - lg font - bold transition - all duration - 300 shadow - lg flex items - center gap - 3 ${isRunning
                    ? 'bg-transparent border-2 border-white text-white hover:bg-white hover:text-[#e07b62]'
                    : 'bg-white text-[#e07b62] hover:bg-[#3d2e2a] hover:text-white'
                    } `}
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isRunning ? (
                    <><Square className="w-5 h-5 fill-current" /> STOP ACROXY</>
                  ) : (
                    <>START ACROXY</>
                  )}
                </button>

                {isRunning && (
                  <button
                    onClick={handleAccessDashboard}
                    className="px-8 py-4 rounded-full text-lg font-bold text-white border-white/20 hover:bg-white/10 transition-colors bg-white/5 backdrop-blur-md"
                  >
                    ACCESS DASHBOARD
                  </button>
                )}
              </div>

              {isRunning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-8 flex items-center gap-6"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-[#3d2e2a]/40 tracking-widest uppercase">Status</span>
                    <span className="text-white font-bold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> ONLINE
                    </span>
                  </div>
                  <div className="w-[1px] h-8 bg-[#3d2e2a]/10" />
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-[#3d2e2a]/40 tracking-widest uppercase">Port</span>
                    <span className="text-white font-bold">{status.port}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              className="absolute inset-0 flex flex-col bg-white no-drag"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: "circOut" }}
            >
              <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-[#e07b62] text-white">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-white" />
                  <span className="font-bold tracking-tight text-lg">ACROXY DASHBOARD</span>
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <button
                  onClick={() => setShowDashboard(false)}
                  className="text-white/80 hover:text-white font-bold text-sm tracking-tight flex items-center h-full px-4"
                >
                  RETURN TO CONTROLLER <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>
              <div className="flex-grow w-full h-full relative overflow-hidden bg-white">
                <iframe
                  src={`http://localhost:${status.port}`}
                  className="w-full h-full border-none"
                  title="Dashboard"
                />
              </div >
            </motion.div >
          )}
        </AnimatePresence >

        {/* Premium Loading Splash Screen */}
        <AnimatePresence>
          {isEnteringDashboard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#e07b62] via-[#3d2e2a] to-[#3d2e2a]"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  ease: [0, 0.71, 0.2, 1.01],
                  scale: {
                    type: "spring",
                    damping: 12,
                    stiffness: 100,
                    restDelta: 0.001
                  }
                }}
                className="flex flex-col items-center gap-6"
              >
                <div className="w-32 h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center overflow-hidden border-4 border-white/20">
                  <img src="/claude-star.png" className="w-[80%] h-[80%] object-contain" alt="Claude Code" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <h2 className="text-white text-2xl font-bold tracking-widest uppercase">Initializing Console</h2>
                  <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.8, ease: "easeInOut" }}
                    />
                  </div>
                  <span className="text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase mt-2">Connecting to ACROXY Backend</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main >

      <footer className="h-10 px-8 flex items-center justify-between z-10 text-[9px] font-bold text-[#3d2e2a]/40 tracking-widest uppercase">
        <span>© 2026 INFUSED ARTS TEAM</span>
        <div className="flex gap-4">
          <span>Rebranded as ACROXY</span>
          <span>Privacy</span>
        </div>
      </footer>
    </div >
  );
}

export default App;
