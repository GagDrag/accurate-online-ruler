import { useState, useEffect, useRef } from "react";
import type { CalibrationMethod } from "./RulerApp";

interface CalibrationState {
  method: CalibrationMethod;
  ppi: number;
  confidence: "high" | "medium" | "low" | "none";
  deviceName: string;
}

interface CalibrationPanelProps {
  calibration: CalibrationState;
  setCalibration: (c: CalibrationState) => void;
  onClose: () => void;
}

type Tab = "auto" | "diagonal" | "creditcard";

// Device database: [brand, model, screenWidth, screenHeight, diagonalInches]
const DEVICE_DB: [string, string, number, number, number][] = [
  // Apple
  ["Apple", "MacBook Air 13\" M3", 2560, 1664, 13.6],
  ["Apple", "MacBook Air 15\" M3", 2880, 1864, 15.3],
  ["Apple", "MacBook Pro 14\" M3", 3024, 1964, 14.2],
  ["Apple", "MacBook Pro 16\" M3", 3456, 2234, 16.2],
  ["Apple", "MacBook Pro 14\" M3 Pro", 3024, 1964, 14.2],
  ["Apple", "MacBook Pro 16\" M3 Pro", 3456, 2234, 16.2],
  ["Apple", "iMac 24\"", 4480, 2520, 23.5],
  ["Apple", "Studio Display", 5120, 2880, 27],
  ["Apple", "Pro Display XDR", 6016, 3384, 32],
  ["Apple", "iPad Pro 12.9\" M2", 2048, 2732, 12.9],
  ["Apple", "iPad Pro 11\" M2", 1668, 2388, 11],
  ["Apple", "iPad Air 10.9\" M1", 1640, 2360, 10.9],
  ["Apple", "iPhone 15 Pro Max", 430, 932, 6.7],
  ["Apple", "iPhone 15 Pro", 393, 852, 6.1],
  ["Apple", "iPhone 15", 393, 852, 6.1],
  ["Apple", "iPhone 15 Plus", 430, 932, 6.7],
  ["Apple", "iPhone 14 Pro Max", 430, 932, 6.7],
  ["Apple", "iPhone 14 Pro", 393, 852, 6.1],
  ["Apple", "iPhone 14", 390, 844, 6.1],
  ["Apple", "iPhone SE 3rd gen", 375, 667, 4.7],
  // Samsung
  ["Samsung", "Galaxy S24 Ultra", 412, 915, 6.8],
  ["Samsung", "Galaxy S24+", 412, 915, 6.6],
  ["Samsung", "Galaxy S24", 360, 780, 6.2],
  ["Samsung", "Galaxy S23 Ultra", 412, 915, 6.8],
  ["Samsung", "Galaxy Z Fold5 (outer)", 373, 832, 6.2],
  ["Samsung", "Galaxy Z Fold5 (inner)", 884, 1104, 7.6],
  ["Samsung", "Galaxy Z Flip5", 360, 780, 6.7],
  ["Samsung", "Galaxy Tab S9+", 1280, 1772, 12.4],
  ["Samsung", "Galaxy Tab S9", 1200, 1600, 11],
  ["Samsung", "Galaxy A54", 393, 851, 6.4],
  // Google
  ["Google", "Pixel 8 Pro", 412, 892, 6.7],
  ["Google", "Pixel 8", 412, 892, 6.2],
  ["Google", "Pixel 7a", 393, 851, 6.1],
  ["Google", "Pixel Fold (outer)", 373, 832, 5.8],
  ["Google", "Pixel Fold (inner)", 820, 936, 7.6],
  ["Google", "Pixel Tablet", 1280, 800, 10.95],
  // Monitors
  ["Dell", "U2723QE 27\" 4K", 3840, 2160, 27],
  ["Dell", "U2422H 24\" FHD", 1920, 1080, 23.8],
  ["Dell", "U3223QE 32\" 4K", 3840, 2160, 31.5],
  ["LG", "27GP950 27\" 4K", 3840, 2160, 27],
  ["LG", "34WN80C 34\" UWQHD", 3440, 1440, 34],
  ["Samsung", "Odyssey G7 32\" QHD", 2560, 1440, 31.5],
  ["Samsung", "Odyssey G9 49\" DQHD", 5120, 1440, 49],
  ["ASUS", "ProArt PA278QV 27\" QHD", 2560, 1440, 27],
  ["BenQ", "PD2700U 27\" 4K", 3840, 2160, 27],
  // Microsoft
  ["Microsoft", "Surface Pro 9", 2880, 1920, 13],
  ["Microsoft", "Surface Laptop 5 13\"", 2256, 1504, 13.5],
  ["Microsoft", "Surface Laptop 5 15\"", 2496, 1664, 15],
  ["Microsoft", "Surface Studio 2+", 4500, 3000, 28],
];

function calculatePPI(widthPx: number, heightPx: number, diagonalInches: number): number {
  const diagonalPx = Math.sqrt(widthPx * widthPx + heightPx * heightPx);
  return diagonalPx / diagonalInches;
}

function autoDetectDevice(): { device: [string, string, number, number, number] | null; confidence: "high" | "medium" | "low" } {
  const w = window.screen.width * window.devicePixelRatio;
  const h = window.screen.height * window.devicePixelRatio;

  // Exact match
  for (const device of DEVICE_DB) {
    if ((device[2] === w && device[3] === h) || (device[2] === h && device[3] === w)) {
      return { device, confidence: "high" };
    }
  }

  // Close match (within 5%)
  let closest: [string, string, number, number, number] | null = null;
  let closestDist = Infinity;
  for (const device of DEVICE_DB) {
    const d1 = Math.sqrt((device[2] - w) ** 2 + (device[3] - h) ** 2);
    const d2 = Math.sqrt((device[2] - h) ** 2 + (device[3] - w) ** 2);
    const d = Math.min(d1, d2);
    if (d < closestDist) {
      closestDist = d;
      closest = device;
    }
  }
  if (closest && closestDist / Math.sqrt(w * w + h * h) < 0.05) {
    return { device: closest, confidence: "medium" };
  }

  return { device: null, confidence: "low" };
}

const CREDIT_CARD_WIDTH_MM = 85.6;
const CREDIT_CARD_HEIGHT_MM = 53.98;

export default function CalibrationPanel({ calibration, setCalibration, onClose }: CalibrationPanelProps) {
  const [tab, setTab] = useState<Tab>("auto");
  const [detectedDevice, setDetectedDevice] = useState<{
    device: [string, string, number, number, number] | null;
    confidence: "high" | "medium" | "low";
  } | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<[string, string, number, number, number] | null>(null);
  const [diagonalInput, setDiagonalInput] = useState("");
  const [cardWidthPx, setCardWidthPx] = useState(0);
  const [cardHeightPx, setCardHeightPx] = useState(0);
  const cardOverlayRef = useRef<HTMLDivElement>(null);

  // Auto-detect on mount
  useEffect(() => {
    const result = autoDetectDevice();
    setDetectedDevice(result);
    if (result.device) {
      setSelectedDevice(result.device);
    }
  }, []);

  // Filtered device list
  const filteredDevices = (() => {
    if (!deviceSearch.trim()) return DEVICE_DB;
    const q = deviceSearch.toLowerCase();
    return DEVICE_DB.filter(
      (d) => d[0].toLowerCase().includes(q) || d[1].toLowerCase().includes(q)
    );
  })();

  // Apply auto-detect calibration
  const applyAutoDetect = () => {
    if (!selectedDevice) return;
    const ppi = calculatePPI(selectedDevice[2], selectedDevice[3], selectedDevice[4]);
    setCalibration({
      method: "auto",
      ppi,
      confidence: detectedDevice?.device === selectedDevice ? detectedDevice.confidence : "medium",
      deviceName: `${selectedDevice[0]} ${selectedDevice[1]}`,
    });
    onClose();
  };

  // Apply diagonal calibration
  const applyDiagonal = () => {
    const diagonal = parseFloat(diagonalInput);
    if (isNaN(diagonal) || diagonal <= 0) return;
    const w = window.screen.width * window.devicePixelRatio;
    const h = window.screen.height * window.devicePixelRatio;
    const ppi = calculatePPI(w, h, diagonal);
    setCalibration({
      method: "diagonal",
      ppi,
      confidence: "medium",
      deviceName: `${diagonal}" diagonal`,
    });
    onClose();
  };

  // Credit card calibration
  const applyCreditCard = () => {
    if (cardWidthPx <= 0 || cardHeightPx <= 0) return;
    // Use both dimensions and average the resulting PPI
    const ppiFromWidth = (cardWidthPx / CREDIT_CARD_WIDTH_MM) * 25.4;
    const ppiFromHeight = (cardHeightPx / CREDIT_CARD_HEIGHT_MM) * 25.4;
    const ppi = (ppiFromWidth + ppiFromHeight) / 2;
    setCalibration({
      method: "creditcard",
      ppi,
      confidence: "high",
      deviceName: "Credit card calibrated",
    });
    onClose();
  };

  // Card overlay drag/sizing
  useEffect(() => {
    const el = cardOverlayRef.current;
    if (!el || tab !== "creditcard") return;

    let startX = 0, startY = 0, startW = 0;
    let mode: "move" | "resize" | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const isNearBottomRight =
        Math.abs(e.clientX - (rect.right)) < 16 &&
        Math.abs(e.clientY - (rect.bottom)) < 16;
      mode = isNearBottomRight ? "resize" : "move";
      startX = e.clientX;
      startY = e.clientY;
      startW = rect.width;
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mode) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (mode === "resize") {
        const newW = Math.max(100, startW + dx);
        const ratio = CREDIT_CARD_HEIGHT_MM / CREDIT_CARD_WIDTH_MM;
        const newH = newW * ratio;
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
      } else {
        const rect = el.getBoundingClientRect();
        el.style.left = `${rect.left + dx}px`;
        el.style.top = `${rect.top + dy}px`;
        startX = e.clientX;
        startY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      if (mode === "resize" || mode === "move") {
        const rect = el.getBoundingClientRect();
        setCardWidthPx(rect.width);
        setCardHeightPx(rect.height);
      }
      mode = null;
    };

    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [tab]);

  // Initialize card overlay size
  useEffect(() => {
    if (tab !== "creditcard") return;
    const el = cardOverlayRef.current;
    if (!el) return;
    const defaultWidth = CREDIT_CARD_WIDTH_MM * (calibration.ppi / 25.4);
    const defaultHeight = CREDIT_CARD_HEIGHT_MM * (calibration.ppi / 25.4);
    el.style.width = `${defaultWidth}px`;
    el.style.height = `${defaultHeight}px`;
    el.style.left = `${(window.innerWidth - defaultWidth) / 2}px`;
    el.style.top = `${(window.innerHeight - defaultHeight) / 2}px`;
  }, [tab, calibration.ppi]);

  const tabs: { key: Tab; label: string; description: string }[] = [
    { key: "auto", label: "Auto-Detect", description: "Select your device" },
    { key: "diagonal", label: "Screen Diagonal", description: "Enter screen size" },
    { key: "creditcard", label: "Credit Card", description: "Match a card" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 md:pt-24">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg mx-3 bg-canvas dark:bg-ink rounded-xl border border-hairline dark:border-hairline-strong/30 overflow-hidden"
        style={{ boxShadow: "0px 1px 1px #00000005, 0px 8px 16px -4px #0000000a, 0px 24px 32px -8px #0000000f, inset 0 0 0 1px #00000014" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline dark:border-hairline-strong/30">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink dark:text-white">Calibrate Ruler</h2>
            <p className="text-xs text-mute mt-0.5">Choose a method to calibrate your screen</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-canvas-soft dark:hover:bg-white/5 transition-colors text-ink dark:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-hairline dark:border-hairline-strong/30 px-3">
          {tabs.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-3 text-center transition-all border-b-2 ${
                tab === key
                  ? "border-ink dark:border-white text-ink dark:text-white"
                  : "border-transparent text-mute hover:text-body dark:hover:text-mute/80"
              }`}
            >
              <span className="text-xs font-medium block">{label}</span>
              <span className="text-[10px] text-mute block mt-0.5">{description}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* Auto-Detect */}
          {tab === "auto" && (
            <div>
              {detectedDevice?.device && (
                <div className="mb-4 p-3 rounded-lg bg-success-soft dark:bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="#0070f3" strokeWidth="1.5"/>
                      <path d="M5 8L7 10L11 6" stroke="#0070f3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-xs font-medium text-link">
                      Detected: {detectedDevice.device[0]} {detectedDevice.device[1]}
                    </span>
                  </div>
                </div>
              )}

              <label className="block text-xs font-mono text-mute mb-2">SEARCH YOUR DEVICE</label>
              <input
                type="text"
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                placeholder="Search brand or model..."
                className="w-full h-10 px-3 text-sm rounded-md border border-hairline dark:border-hairline-strong/30 bg-canvas-soft dark:bg-white/5 text-ink dark:text-white focus:outline-none focus:border-link focus:ring-1 focus:ring-link/20 transition-all"
              />

              <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-hairline dark:border-hairline-strong/30">
                {filteredDevices.map((device, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDevice(device)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-hairline dark:border-hairline-strong/30 last:border-b-0 transition-colors ${
                      selectedDevice === device
                        ? "bg-link-bg-soft dark:bg-link/20 text-link dark:text-link"
                        : "hover:bg-canvas-soft dark:hover:bg-white/5 text-body dark:text-mute"
                    }`}
                  >
                    <span className="font-medium text-mute w-16 shrink-0">{device[0]}</span>
                    <span className="truncate text-ink dark:text-white">{device[1]}</span>
                    <span className="ml-auto text-[10px] text-mute font-mono shrink-0">
                      {calculatePPI(device[2], device[3], device[4]).toFixed(0)} PPI
                    </span>
                  </button>
                ))}
                {filteredDevices.length === 0 && (
                  <p className="p-3 text-xs text-mute text-center">No devices found</p>
                )}
              </div>

              <button
                onClick={applyAutoDetect}
                disabled={!selectedDevice}
                className="mt-4 w-full h-10 rounded-full bg-ink dark:bg-white text-canvas dark:text-ink font-medium text-sm hover:bg-ink/90 dark:hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Device Settings
              </button>
            </div>
          )}

          {/* Screen Diagonal */}
          {tab === "diagonal" && (
            <div>
              <p className="text-sm text-body dark:text-mute mb-4">
                Enter your screen's diagonal size in inches. You can find this in your device specs or by searching your monitor model number.
              </p>

              <label className="block text-xs font-mono text-mute mb-2">SCREEN DIAGONAL (INCHES)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={diagonalInput}
                  onChange={(e) => setDiagonalInput(e.target.value)}
                  placeholder="e.g. 15.6"
                  step="0.1"
                  min="1"
                  className="flex-1 h-10 px-3 text-sm rounded-md border border-hairline dark:border-hairline-strong/30 bg-canvas-soft dark:bg-white/5 text-ink dark:text-white focus:outline-none focus:border-link focus:ring-1 focus:ring-link/20 transition-all"
                />
                <button
                  onClick={applyDiagonal}
                  disabled={!diagonalInput || parseFloat(diagonalInput) <= 0}
                  className="h-10 px-5 rounded-full bg-ink dark:bg-white text-canvas dark:text-ink font-medium text-sm hover:bg-ink/90 dark:hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>

              {diagonalInput && parseFloat(diagonalInput) > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-canvas-soft dark:bg-white/5 text-xs font-mono">
                  <span className="text-mute">Estimated PPI: </span>
                  <span className="text-ink dark:text-white font-medium">
                    {calculatePPI(
                      window.screen.width * window.devicePixelRatio,
                      window.screen.height * window.devicePixelRatio,
                      parseFloat(diagonalInput)
                    ).toFixed(1)}
                  </span>
                  <span className="text-mute ml-2">· ~2% accuracy</span>
                </div>
              )}

              <div className="mt-4 p-3 rounded-lg bg-canvas-soft-2 dark:bg-white/5 text-xs text-mute">
                <strong className="text-body dark:text-mute font-medium">Common sizes:</strong>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[13.3, 14, 15.6, 21.5, 23.8, 24, 27, 31.5, 32, 34].map((size) => (
                    <button
                      key={size}
                      onClick={() => setDiagonalInput(String(size))}
                      className="px-2 py-1 bg-canvas dark:bg-white/5 border border-hairline dark:border-hairline-strong/30 rounded text-[11px] font-mono text-ink dark:text-white hover:border-hairline-strong transition-colors"
                    >
                      {size}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Credit Card */}
          {tab === "creditcard" && (
            <div>
              <p className="text-sm text-body dark:text-mute mb-3">
                Place a credit card on the blue rectangle below and drag the bottom-right corner until they match exactly.
              </p>

              <div className="p-3 rounded-lg bg-canvas-soft-2 dark:bg-white/5 text-xs text-mute mb-3">
                <strong className="text-body dark:text-mute font-medium">Standard card: </strong>
                85.60 mm × 53.98 mm (3.375" × 2.125")
              </div>

              {cardWidthPx > 0 && (
                <div className="p-3 rounded-lg bg-link-bg-soft dark:bg-link/20 text-xs font-mono mb-3">
                  <span className="text-mute">Current PPI: </span>
                  <span className="text-link font-medium">
                    {((cardWidthPx / CREDIT_CARD_WIDTH_MM) * 25.4).toFixed(1)}
                  </span>
                  <span className="text-mute ml-2">
                    ({(cardWidthPx / window.devicePixelRatio).toFixed(0)} × {(cardHeightPx / window.devicePixelRatio).toFixed(0)} CSS px)
                  </span>
                </div>
              )}

              <button
                onClick={applyCreditCard}
                disabled={cardWidthPx <= 0}
                className="w-full h-10 rounded-full bg-ink dark:bg-white text-canvas dark:text-ink font-medium text-sm hover:bg-ink/90 dark:hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Calibration
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Credit card overlay (shown behind the panel, on the ruler area) */}
      {tab === "creditcard" && (
        <div
          ref={cardOverlayRef}
          className="fixed z-[55] border-2 border-link border-dashed rounded-md bg-link/5 cursor-move"
          style={{
            width: `${CREDIT_CARD_WIDTH_MM * (calibration.ppi / 25.4)}px`,
            height: `${CREDIT_CARD_HEIGHT_MM * (calibration.ppi / 25.4)}px`,
            left: `${(window.innerWidth - CREDIT_CARD_WIDTH_MM * (calibration.ppi / 25.4)) / 2}px`,
            top: `${(window.innerHeight - CREDIT_CARD_HEIGHT_MM * (calibration.ppi / 25.4)) / 2}px`,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono text-link/80 bg-canvas/80 px-2 py-0.5 rounded pointer-events-none">
              Place card here
            </span>
          </div>
          {/* Resize handle */}
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-link">
              <path d="M14 6L6 14M14 10L10 14M14 14L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
