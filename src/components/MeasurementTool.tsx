import { useState, useEffect, useRef, useCallback } from "react";
import type { Unit } from "./RulerApp";

interface MeasurementToolProps {
  ppi: number;
  unit: Unit;
  topOffset?: number;
}

interface Point {
  x: number;
  y: number;
}

function formatDistance(pixels: number, unit: Unit, ppi: number): string {
  if (unit === "px") return `${Math.round(pixels)} px`;
  if (unit === "cm") return `${((pixels * 2.54) / ppi).toFixed(1)} cm`;
  return `${(pixels / ppi).toFixed(2)}"`;
}

export default function MeasurementTool({ ppi, unit, topOffset = 0 }: MeasurementToolProps) {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPlacingEnd, setIsPlacingEnd] = useState(false);
  const mouseDownPos = useRef<Point | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const rect = (e.target as HTMLElement).closest(".measure-overlay")?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mouseDownPos.current = { x, y };

    if (isPlacingEnd) {
      setEndPoint({ x, y });
      setIsPlacingEnd(false);
    } else {
      setStartPoint({ x, y });
      setEndPoint(null);
      setIsDragging(true);
    }
  }, [isPlacingEnd]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = (e.target as HTMLElement).closest(".measure-overlay")?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentMouse({ x, y });
    
    if (isDragging || isPlacingEnd) {
      setEndPoint({ x, y });
    }
  }, [isDragging, isPlacingEnd]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!mouseDownPos.current || !isDragging) return;
    
    const rect = (e.target as HTMLElement).closest(".measure-overlay")?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dist = Math.sqrt((x - mouseDownPos.current.x) ** 2 + (y - mouseDownPos.current.y) ** 2);
    
    setIsDragging(false);
    
    // If it was a tiny movement, assume it's the first click of a two-click sequence
    if (dist < 5) {
      setIsPlacingEnd(true);
    }
  }, [isDragging]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  // Touch support
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      setStartPoint({ x, y });
      setEndPoint(null);
      setIsDragging(true);
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      setCurrentMouse({ x, y });
      if (isDragging) setEndPoint({ x, y });
    };
    const handleTouchEnd = () => setIsDragging(false);
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  const activePoint = isDragging ? currentMouse : endPoint || currentMouse;
  const distance =
    startPoint && endPoint
      ? Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2)
      : startPoint && isDragging
        ? Math.sqrt((currentMouse.x - startPoint.x) ** 2 + (currentMouse.y - startPoint.y) ** 2)
        : null;

  const dx = startPoint && (endPoint || (isDragging ? currentMouse : null))
    ? Math.abs((endPoint || currentMouse).x - startPoint.x)
    : null;
  const dy = startPoint && (endPoint || (isDragging ? currentMouse : null))
    ? Math.abs((endPoint || currentMouse).y - startPoint.y)
    : null;

  return (
    <div
      ref={overlayRef}
      className="measure-overlay absolute inset-0 z-45 cursor-crosshair"
    >
      {/* Crosshair at current mouse position */}
      {!startPoint && (
        <>
          <div
            className="absolute w-px h-full bg-link/30 pointer-events-none"
            style={{ left: currentMouse.x }}
          />
          <div
            className="absolute h-px w-full bg-link/30 pointer-events-none"
            style={{ top: currentMouse.y }}
          />
        </>
      )}

      {/* Measurement line */}
      {startPoint && (
        <>
          {/* Start point */}
          <div
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-link border-2 border-canvas dark:border-ink shadow-sm pointer-events-none"
            style={{ left: startPoint.x, top: startPoint.y }}
          />
          {/* End/current point */}
          <div
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-link border-2 border-canvas dark:border-ink shadow-sm pointer-events-none"
            style={{ left: activePoint.x, top: activePoint.y }}
          />
          {/* Line */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={activePoint.x}
              y2={activePoint.y}
              stroke="#0070f3"
              strokeWidth="1.5"
              strokeDasharray={isDragging ? "4 2" : "none"}
            />
            {/* Horizontal & vertical projections */}
            {endPoint && (
              <>
                <line
                  x1={startPoint.x}
                  y1={startPoint.y}
                  x2={endPoint.x}
                  y2={startPoint.y}
                  stroke="currentColor"
                  className="text-mute/50"
                  strokeWidth="0.5"
                  strokeDasharray="3 3"
                />
                <line
                  x1={endPoint.x}
                  y1={startPoint.y}
                  x2={endPoint.x}
                  y2={endPoint.y}
                  stroke="currentColor"
                  className="text-mute/50"
                  strokeWidth="0.5"
                  strokeDasharray="3 3"
                />
              </>
            )}
          </svg>
          {/* Distance label */}
          <div
            className="absolute bg-ink dark:bg-white text-canvas dark:text-ink text-xs font-mono px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: (startPoint.x + activePoint.x) / 2,
              top: (startPoint.y + activePoint.y) / 2 - 28,
              transform: "translateX(-50%)",
            }}
          >
            {distance !== null ? formatDistance(distance, unit, ppi) : "—"}
            {dx !== null && dy !== null && (
              <span className="text-[10px] text-canvas/60 dark:text-ink/60 ml-1.5">
                ({formatDistance(dx, unit, ppi)} × {formatDistance(dy, unit, ppi)})
              </span>
            )}
          </div>
        </>
      )}

      {/* Instructions */}
      {!startPoint && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 bg-ink/90 dark:bg-white text-canvas dark:text-ink text-xs font-mono px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm shadow-xl transition-all"
          style={{ top: topOffset + 16 }}
        >
          Click or drag to measure distance · Press <kbd className="px-1 bg-white/10 dark:bg-black/10 rounded text-[10px]">Esc</kbd> to exit
        </div>
      )}
      {startPoint && !endPoint && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 bg-ink/90 dark:bg-white text-canvas dark:text-ink text-xs font-mono px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm shadow-xl transition-all"
          style={{ top: topOffset + 16 }}
        >
          Click to set end point, or drag to start over
        </div>
      )}
      {startPoint && endPoint && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 bg-ink/90 dark:bg-white text-canvas dark:text-ink text-xs font-mono px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm shadow-xl transition-all"
          style={{ top: topOffset + 16 }}
        >
          Click or drag to measure again · Press <kbd className="px-1 bg-white/10 dark:bg-black/10 rounded text-[10px]">Esc</kbd> to exit
        </div>
      )}
    </div>
  );
}
