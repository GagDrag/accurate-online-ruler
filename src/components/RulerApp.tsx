import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Ruler from "./Ruler";
import CalibrationPanel from "./CalibrationPanel";
import MeasurementTool from "./MeasurementTool";
import { useTheme } from "../hooks/useTheme";
import { useScreenDimensions } from "../hooks/useScreenDimensions";
import { useFullscreen } from "../hooks/useFullscreen";

export type Unit = "cm" | "inch" | "px";
type RulerSide = "top" | "bottom" | "left" | "right";
export type CalibrationMethod = "auto" | "diagonal" | "creditcard" | "none";

interface CalibrationState {
  method: CalibrationMethod;
  ppi: number;
  confidence: "high" | "medium" | "low" | "none";
  deviceName: string;
}

const DEFAULT_PPI = 96;
const RULER_SIZE = 40;

function getScreenDimension(unit: Unit, pixels: number, ppi: number): string {
  if (unit === "px") return `${Math.round(pixels)}px`;
  if (unit === "cm") return `${((pixels * 25.4) / ppi / 10).toFixed(1)}cm`;
  return `${(pixels / ppi).toFixed(1)}"`;
}

export default function RulerApp() {
  const [unit, setUnit] = useState<Unit>("cm");
  const [rulerSides, setRulerSides] = useState<RulerSide[]>(["top", "left"]);
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [calibration, setCalibration] = useState<CalibrationState>({
    method: "none",
    ppi: DEFAULT_PPI,
    confidence: "none",
    deviceName: "",
  });
  const [showCalibration, setShowCalibration] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);
  const { width: screenWidth, height: screenHeight } = useScreenDimensions();
  const { theme, toggleTheme } = useTheme();

  // Detect browser zoom
  useEffect(() => {
    const checkZoom = () => {
      const zoomLevel = Math.round((window.outerWidth / window.innerWidth) * 100);
      setZoomWarning(zoomLevel !== 100);
    };
    checkZoom();
    window.addEventListener("resize", checkZoom);
    return () => window.removeEventListener("resize", checkZoom);
  }, []);

  // Load calibration from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ruler-calibration");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCalibration(parsed);
      } catch {}
    }
    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const ppiParam = params.get("ppi");
    const methodParam = params.get("method") as CalibrationMethod;
    if (ppiParam && !isNaN(Number(ppiParam))) {
      setCalibration({
        method: methodParam || "diagonal",
        ppi: Number(ppiParam),
        confidence: "medium",
        deviceName: "Shared calibration",
      });
    }
  }, []);

  // Save calibration
  useEffect(() => {
    if (calibration.method !== "none") {
      localStorage.setItem("ruler-calibration", JSON.stringify(calibration));
    }
  }, [calibration]);

  // Toggle ruler side
  const toggleSide = useCallback((side: RulerSide) => {
    setRulerSides((prev) =>
      prev.includes(side) ? prev.filter((s) => s !== side) : [...prev, side]
    );
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case "u":
          setUnit((prev) => (prev === "cm" ? "inch" : prev === "inch" ? "px" : "cm"));
          break;
        case "f":
          toggleFullscreen();
          break;
        case "c":
          setShowCalibration((prev) => !prev);
          break;
        case "m":
          setIsMeasuring((prev) => !prev);
          break;
        case "t":
          toggleTheme();
          break;
        case "escape":
          setShowCalibration(false);
          setIsMeasuring(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullscreen, toggleTheme]);

  const hasTopRuler = rulerSides.includes("top");
  const hasBottomRuler = rulerSides.includes("bottom");
  const hasLeftRuler = rulerSides.includes("left");
  const hasRightRuler = rulerSides.includes("right");

  return (
    <div className="relative w-full h-full overflow-hidden bg-canvas dark:bg-ink transition-colors duration-300">
      {/* Mesh gradient (Vercel style) - only shown when not measuring */}
      {!isMeasuring && (
        <div className="absolute top-0 left-0 right-0 h-[60vh] overflow-hidden pointer-events-none opacity-40 dark:opacity-20 transition-opacity duration-1000">
          <div 
            className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] opacity-50 blur-[100px]"
            style={{
              background: "radial-gradient(circle at 20% 30%, var(--color-gradient-develop-start) 0%, transparent 40%), radial-gradient(circle at 80% 20%, var(--color-gradient-preview-end) 0%, transparent 40%), radial-gradient(circle at 50% 80%, var(--color-gradient-ship-end) 0%, transparent 50%), radial-gradient(circle at 10% 90%, var(--color-cyan) 0%, transparent 30%)"
            }}
          />
        </div>
      )}

      {/* Central Hub (only when not measuring) */}
      <AnimatePresence>
        {!isMeasuring && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="flex flex-col items-center gap-10 w-full max-w-2xl px-6 pointer-events-auto">
              
              {/* Top Action Row: Measure, Calibrate, Theme */}
              <div className="flex items-center gap-8 md:gap-12">
                {/* Measure Button */}
                <button
                  onClick={() => setIsMeasuring(true)}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-canvas/80 dark:bg-white/5 border border-hairline dark:border-white/10 shadow-lg text-ink dark:text-white group-hover:scale-110 group-hover:bg-ink group-hover:text-canvas dark:group-hover:bg-white dark:group-hover:text-ink transition-all duration-300">
                    <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="2" cy="2" r="1.5" fill="currentColor"/>
                      <circle cx="14" cy="14" r="1.5" fill="currentColor"/>
                    </svg>
                  </div>
                  <span className="text-[10px] md:text-xs font-mono font-semibold uppercase tracking-widest text-mute group-hover:text-ink dark:group-hover:text-white transition-colors">Measure</span>
                </button>

                {/* Calibrate Button */}
                <button
                  onClick={() => setShowCalibration(true)}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-canvas/80 dark:bg-white/5 border border-hairline dark:border-white/10 shadow-lg text-ink dark:text-white group-hover:scale-110 group-hover:bg-ink group-hover:text-canvas dark:group-hover:bg-white dark:group-hover:text-ink transition-all duration-300">
                    <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-[10px] md:text-xs font-mono font-semibold uppercase tracking-widest text-mute group-hover:text-ink dark:group-hover:text-white transition-colors">Calibrate</span>
                </button>

                {/* Theme Button */}
                <button
                  onClick={toggleTheme}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-canvas/80 dark:bg-white/5 border border-hairline dark:border-white/10 shadow-lg text-ink dark:text-white group-hover:scale-110 group-hover:bg-ink group-hover:text-canvas dark:group-hover:bg-white dark:group-hover:text-ink transition-all duration-300">
                    {theme === "light" ? (
                      <svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12Z" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1V2.5M8 13.5V15M1 8H2.5M13.5 8H15M3.05025 3.05025L4.11091 4.11091M11.8891 11.8891L12.9497 12.9497M3.05025 12.9497L4.11091 11.8891M11.8891 4.11091L12.9497 3.05025" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M14.5 9.5C14.5 13.0899 11.5899 16 8 16C4.41015 16 1.5 13.0899 1.5 9.5C1.5 5.91015 4.41015 3 8 3C8.31828 3 8.63185 3.02283 8.93874 3.06678C8.59858 3.86873 8.41176 4.74714 8.41176 5.66667C8.41176 8.79628 10.9381 11.3333 14.0588 11.3333C14.2078 11.3333 14.3548 11.3276 14.5 11.3164C14.5 10.7431 14.5 10.1384 14.5 9.5Z" stroke="currentColor" strokeWidth="1.5"/></svg>
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs font-mono font-semibold uppercase tracking-widest text-mute group-hover:text-ink dark:group-hover:text-white transition-colors">{theme === "light" ? "Dark" : "Light"} Mode</span>
                </button>
              </div>

              {/* Headline & Info */}
              <div className="text-center select-none">
                <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter text-ink dark:text-white mb-4">
                  Accurate Online Ruler.
                </h1>
                <p className="text-sm md:text-base text-body dark:text-mute font-mono tracking-tight max-w-md mx-auto">
                  {calibration.method === "none"
                    ? "Calibrate your screen using a credit card or diagonal size for 100% physical accuracy."
                    : `${calibration.ppi.toFixed(1)} PPI · ${calibration.deviceName || "Calibrated"}`}
                </p>
              </div>

              {/* Unit Toggle */}
              <div className="flex items-center bg-canvas/40 dark:bg-white/5 backdrop-blur-sm border border-hairline dark:border-white/10 rounded-full p-1 gap-1 shadow-lg">
                {["cm", "inch", "px"].map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u as Unit)}
                    className={`px-6 py-2 text-xs font-semibold rounded-full transition-all ${
                      unit === u
                        ? "bg-ink dark:bg-white text-canvas dark:text-ink shadow-md"
                        : "text-body dark:text-mute hover:text-ink dark:hover:text-white"
                    }`}
                  >
                    {u === "cm" ? "cm/mm" : u === "inch" ? 'inches' : "pixels"}
                  </button>
                ))}
              </div>

              {/* Ruler Toggles & Fullscreen */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 bg-canvas/40 dark:bg-white/5 backdrop-blur-sm border border-hairline dark:border-white/10 p-1.5 rounded-full shadow-lg">
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-[10px] font-mono text-mute uppercase tracking-widest mr-2 ml-2 select-none hidden sm:inline">Rulers</span>
                    {(["top", "bottom", "left", "right"] as RulerSide[]).map((side) => (
                      <button
                        key={side}
                        onClick={() => toggleSide(side)}
                        className={`group flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
                          rulerSides.includes(side)
                            ? "bg-ink dark:bg-white text-canvas dark:text-ink border-ink dark:border-white shadow-md"
                            : "bg-canvas/50 dark:bg-transparent text-body dark:text-mute border-hairline dark:border-white/10 hover:border-hairline-strong dark:hover:border-white/20"
                        }`}
                        title={`Toggle ${side} ruler`}
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          {side === "top" && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5V7M8 5V9M12 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          {side === "bottom" && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="rotate-180"><rect x="2" y="2" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5V7M8 5V9M12 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          {side === "left" && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="-rotate-90"><rect x="2" y="2" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5V7M8 5V9M12 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          {side === "right" && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="rotate-90"><rect x="2" y="2" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5V7M8 5V9M12 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </div>
                        <span className="text-[9px] font-mono font-bold uppercase tracking-tighter leading-none">{side}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="h-4 w-px bg-hairline dark:bg-white/10 mx-1" />
                  
                  <button
                    onClick={toggleFullscreen}
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-hairline dark:border-white/10 text-ink dark:text-white hover:bg-canvas dark:hover:bg-white/5 transition-all"
                    title="Toggle Fullscreen (F)"
                  >
                    {isFullscreen ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3L7 7M9 9L13 13M7 3H3V7M9 13H13V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 7V3H7M9 3H13V7M3 9V13H7M13 9V13H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </button>
                </div>
                
                {/* Keyboard Shortcuts */}
                <div className="flex flex-wrap justify-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-500">
                  <kbd className="px-2 py-1 bg-canvas-soft-2 dark:bg-white/5 border border-hairline dark:border-white/10 rounded text-[10px] text-mute font-mono">U (units)</kbd>
                  <kbd className="px-2 py-1 bg-canvas-soft-2 dark:bg-white/5 border border-hairline dark:border-white/10 rounded text-[10px] text-mute font-mono">C (calibrate)</kbd>
                  <kbd className="px-2 py-1 bg-canvas-soft-2 dark:bg-white/5 border border-hairline dark:border-white/10 rounded text-[10px] text-mute font-mono">M (measure)</kbd>
                  <kbd className="px-2 py-1 bg-canvas-soft-2 dark:bg-white/5 border border-hairline dark:border-white/10 rounded text-[10px] text-mute font-mono">T (theme)</kbd>
                  <kbd className="px-2 py-1 bg-canvas-soft-2 dark:bg-white/5 border border-hairline dark:border-white/10 rounded text-[10px] text-mute font-mono">F (fullscreen)</kbd>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom warning */}
      {zoomWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-warning-soft dark:bg-warning/10 text-warning-deep dark:text-warning text-sm font-medium px-4 py-2 rounded-full border border-warning/30 flex items-center gap-2 backdrop-blur-md">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L14.5 13H1.5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/></svg>
          Browser zoom should be 100% for accurate measurements
        </div>
      )}

      {/* Ruler area */}
      <div className="absolute inset-0">
        <AnimatePresence>
          {hasTopRuler && (
            <motion.div
              initial={{ y: -RULER_SIZE }}
              animate={{ y: 0 }}
              exit={{ y: -RULER_SIZE }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 right-0 z-40"
            >
              <Ruler
                direction="horizontal"
                unit={unit}
                ppi={calibration.ppi}
                lengthPx={screenWidth}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasBottomRuler && (
            <motion.div
              initial={{ y: RULER_SIZE }}
              animate={{ y: 0 }}
              exit={{ y: RULER_SIZE }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 z-40"
            >
              <Ruler
                direction="horizontal"
                unit={unit}
                ppi={calibration.ppi}
                lengthPx={screenWidth}
                flip
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasLeftRuler && (
            <motion.div
              initial={{ x: -RULER_SIZE }}
              animate={{ x: 0 }}
              exit={{ x: -RULER_SIZE }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 bottom-0 z-40"
            >
              <Ruler
                direction="vertical"
                unit={unit}
                ppi={calibration.ppi}
                lengthPx={screenHeight}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasRightRuler && (
            <motion.div
              initial={{ x: RULER_SIZE }}
              animate={{ x: 0 }}
              exit={{ x: RULER_SIZE }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 z-40"
            >
              <Ruler
                direction="vertical"
                unit={unit}
                ppi={calibration.ppi}
                lengthPx={screenHeight}
                flip
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Measurement overlay */}
        {isMeasuring && (
          <MeasurementTool 
            ppi={calibration.ppi} 
            unit={unit} 
            topOffset={hasTopRuler ? RULER_SIZE + 56 : 56} 
          />
        )}
      </div>

      {/* Info bar (bottom) - dimensions and PPI */}
      <motion.div
        animate={{ y: hasBottomRuler ? -RULER_SIZE : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      >
        <div className="h-12 flex items-center justify-center px-5 gap-2">
          <div className="bg-canvas/60 dark:bg-ink/60 backdrop-blur-md border border-hairline dark:border-white/10 px-4 py-1.5 rounded-full text-[11px] font-mono text-mute flex items-center gap-4 shadow-sm select-none">
            <span className="text-body dark:text-mute">
              {getScreenDimension(unit, screenWidth, calibration.ppi)} × {getScreenDimension(unit, screenHeight, calibration.ppi)}
            </span>
            <span className="h-3 w-px bg-hairline dark:bg-white/20" />
            <span>
              {calibration.ppi.toFixed(0)} PPI
            </span>
          </div>
          
          <button
            onClick={() => {
              document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="pointer-events-auto group bg-canvas/60 dark:bg-ink/60 backdrop-blur-md border border-hairline dark:border-white/10 px-4 py-1.5 rounded-full text-[11px] font-mono text-mute hover:text-ink dark:hover:text-white hover:border-hairline-strong dark:hover:border-white/30 transition-all shadow-sm flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 11V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8 5V5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            About
          </button>
        </div>
      </motion.div>

      {/* Calibration panel (overlay) */}
      {showCalibration && (
        <CalibrationPanel
          calibration={calibration}
          setCalibration={setCalibration}
          onClose={() => setShowCalibration(false)}
        />
      )}
    </div>
  );
}
