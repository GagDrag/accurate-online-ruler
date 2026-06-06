import { useState, useEffect, useRef, useCallback } from "react";
import type { Unit } from "./RulerApp";

interface Point {
  x: number;
  y: number;
}

interface MeasurementToolProps {
  ppi: number;
  unit: Unit;
  topOffset?: number;
}

// --- Utils ---

function formatDistance(pixels: number, unit: Unit, ppi: number): string {
  if (unit === "px") return `${Math.round(pixels)} px`;
  if (unit === "cm") return `${((pixels * 2.54) / ppi).toFixed(1)} cm`;
  return `${(pixels / ppi).toFixed(2)}"`;
}

function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// --- Sub-components ---

function Crosshair({ x, y }: Point) {
  return (
    <>
      <div
        className="absolute w-px h-full bg-link/30 pointer-events-none"
        style={{ left: x }}
      />
      <div
        className="absolute h-px w-full bg-link/30 pointer-events-none"
        style={{ top: y }}
      />
    </>
  );
}

function MeasurementLine({ 
  start, 
  end, 
  isDragging 
}: { 
  start: Point, 
  end: Point, 
  isDragging: boolean 
}) {
  return (
    <>
      <div
        className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-link border-2 border-canvas dark:border-ink shadow-sm pointer-events-none"
        style={{ left: start.x, top: start.y }}
      />
      <div
        className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-link border-2 border-canvas dark:border-ink shadow-sm pointer-events-none"
        style={{ left: end.x, top: end.y }}
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#0070f3"
          strokeWidth="1.5"
          strokeDasharray={isDragging ? "4 2" : "none"}
        />
        {/* Horizontal & vertical projections (only when not dragging to keep it clean) */}
        {!isDragging && (
          <>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={start.y}
              stroke="currentColor"
              className="text-mute/50"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
            <line
              x1={end.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="currentColor"
              className="text-mute/50"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
          </>
        )}
      </svg>
    </>
  );
}

function Instructions({ startPoint, endPoint, topOffset }: { 
  startPoint: Point | null, 
  endPoint: Point | null, 
  topOffset: number 
}) {
  let text = "Click or drag to measure distance · Press Esc to exit";
  if (startPoint && !endPoint) text = "Click to set end point, or drag to start over";
  if (startPoint && endPoint) text = "Click or drag to measure again · Press Esc to exit";

  return (
    <div 
      className="absolute left-1/2 -translate-x-1/2 bg-ink/90 dark:bg-white text-canvas dark:text-ink text-xs font-mono px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm shadow-xl transition-all"
      style={{ top: topOffset + 16 }}
    >
      {text.includes("Esc") ? (
        <>
          {text.split("Esc")[0]}
          <kbd className="px-1 bg-white/10 dark:bg-black/10 rounded text-[10px]">Esc</kbd>
          {text.split("Esc")[1]}
        </>
      ) : text}
    </div>
  );
}

export default function MeasurementTool({ ppi, unit, topOffset = 0 }: MeasurementToolProps) {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPlacingEnd, setIsPlacingEnd] = useState(false);
  const mouseDownPos = useRef<Point | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getRelativePoint = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    const el = overlayRef.current;
    if (!el) return null;
    
    const rect = el.getBoundingClientRect();
    let clientX, clientY;
    
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const point = getRelativePoint(e);
    if (!point) return;
    
    mouseDownPos.current = point;

    if (isPlacingEnd) {
      setEndPoint(point);
      setIsPlacingEnd(false);
    } else {
      setStartPoint(point);
      setEndPoint(null);
      setIsDragging(true);
    }
  }, [isPlacingEnd, getRelativePoint]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const point = getRelativePoint(e);
    if (!point) return;
    
    setCurrentMouse(point);
    
    if (isDragging || isPlacingEnd) {
      setEndPoint(point);
    }
  }, [isDragging, isPlacingEnd, getRelativePoint]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!mouseDownPos.current || !isDragging) return;
    
    const point = getRelativePoint(e);
    if (!point) return;

    const dist = calculateDistance(mouseDownPos.current, point);
    setIsDragging(false);
    
    if (dist < 5) {
      setIsPlacingEnd(true);
    }
  }, [isDragging, getRelativePoint]);

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
      const point = getRelativePoint(e);
      if (!point) return;
      setStartPoint(point);
      setEndPoint(null);
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const point = getRelativePoint(e);
      if (!point) return;
      setCurrentMouse(point);
      if (isDragging) setEndPoint(point);
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
  }, [isDragging, getRelativePoint]);

  const activePoint = isDragging ? currentMouse : endPoint || currentMouse;
  const distance = startPoint ? calculateDistance(startPoint, activePoint) : null;
  const dx = startPoint ? Math.abs(activePoint.x - startPoint.x) : null;
  const dy = startPoint ? Math.abs(activePoint.y - startPoint.y) : null;

  return (
    <div
      ref={overlayRef}
      className="measure-overlay absolute inset-0 z-45 cursor-crosshair"
    >
      {!startPoint && <Crosshair {...currentMouse} />}

      {startPoint && (
        <>
          <MeasurementLine start={startPoint} end={activePoint} isDragging={isDragging} />
          
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

      <Instructions startPoint={startPoint} endPoint={endPoint} topOffset={topOffset} />
    </div>
  );
}
