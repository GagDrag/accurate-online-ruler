import { useRef, useEffect, useMemo, useState } from "react";
import type { Unit } from "./RulerApp";

interface RulerProps {
  direction: "horizontal" | "vertical";
  unit: Unit;
  ppi: number;
  lengthPx: number;
  flip?: boolean;
}

interface Tick {
  pos: number;
  isMajor: boolean;
  isMid: boolean;
  label: string;
}

const RULER_SIZE = 40; // px thickness of the ruler bar

// --- Tick Generation Helpers ---

function getPxTicks(lengthPx: number): Tick[] {
  const result: Tick[] = [];
  const step = 10;
  for (let px = 0; px <= lengthPx; px += step) {
    const isMajor = px % 100 === 0;
    const isMid = px % 50 === 0 && !isMajor;
    const label = isMajor ? `${px}` : "";
    result.push({ pos: px, isMajor, isMid, label });
  }
  return result;
}

function getCmTicks(lengthPx: number, ppi: number): Tick[] {
  const result: Tick[] = [];
  const mmPerPx = 25.4 / ppi;
  const totalMm = lengthPx * mmPerPx;
  for (let mm = 0; mm <= totalMm; mm += 1) {
    const px = mm / mmPerPx;
    const isMajor = mm % 10 === 0;
    const isMid = mm % 5 === 0 && !isMajor;
    const cm = mm / 10;
    const label = isMajor ? `${cm}` : "";
    result.push({ pos: px, isMajor, isMid, label });
  }
  return result;
}

function getInchTicks(lengthPx: number, ppi: number): Tick[] {
  const result: Tick[] = [];
  const inchPerPx = 1 / ppi;
  const totalInch = lengthPx * inchPerPx;
  const sixteenth = 1 / 16;
  for (let i = 0; i * sixteenth <= totalInch + sixteenth; i += 1) {
    const inchVal = i * sixteenth;
    const px = inchVal / inchPerPx;
    const isMajor = i % 16 === 0;
    const isMid = i % 8 === 0 && !isMajor;
    const isQuarter = i % 4 === 0 && !isMajor && !isMid;
    let label = "";
    if (isMajor) {
      label = `${Math.round(inchVal)}`;
    } else if (i % 8 === 0) {
      label = `${inchVal.toFixed(1)}`;
    }
    result.push({ pos: px, isMajor, isMid: isMid || isQuarter, label });
  }
  return result;
}

// --- Drawing Helpers ---

function getTickStyle(tick: Tick, isDarkMode: boolean) {
  if (tick.isMajor) {
    return {
      color: isDarkMode ? "#ffffff" : "#171717",
      lineWidth: 1.2,
      height: RULER_SIZE * 0.45,
    };
  }
  if (tick.isMid) {
    return {
      color: isDarkMode ? "#666666" : "#888888",
      lineWidth: 0.8,
      height: RULER_SIZE * 0.28,
    };
  }
  return {
    color: isDarkMode ? "#444444" : "#c0c0c0",
    lineWidth: 0.8,
    height: RULER_SIZE * 0.15,
  };
}

function drawLabel(
  ctx: CanvasRenderingContext2D, 
  label: string, 
  pos: number, 
  isHorizontal: boolean, 
  flip: boolean, 
  isDarkMode: boolean
) {
  ctx.fillStyle = isDarkMode ? "#ffffff" : "#171717";
  ctx.textAlign = "center";
  const labelPos = flip ? 12 : RULER_SIZE - 12;

  if (isHorizontal) {
    ctx.fillText(label, pos, labelPos);
  } else {
    ctx.save();
    ctx.translate(labelPos, pos);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

export default function Ruler({ direction, unit, ppi, lengthPx, flip = false }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const isHorizontal = direction === "horizontal";
  const canvasWidth = isHorizontal ? lengthPx : RULER_SIZE;
  const canvasHeight = isHorizontal ? RULER_SIZE : lengthPx;

  // Track dark mode
  useEffect(() => {
    const checkDark = () => setIsDarkMode(document.documentElement.classList.contains("dark"));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Calculate tick data
  const ticks = useMemo(() => {
    if (unit === "px") return getPxTicks(lengthPx);
    if (unit === "cm") return getCmTicks(lengthPx, ppi);
    return getInchTicks(lengthPx, ppi);
  }, [unit, ppi, lengthPx]);

  // Draw ticks on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 1. Draw Background
    ctx.fillStyle = isDarkMode ? "#171717" : "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw Border
    ctx.strokeStyle = isDarkMode ? "#333333" : "#ebebeb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (isHorizontal) {
      const y = flip ? RULER_SIZE : 0;
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
    } else {
      const x = flip ? RULER_SIZE : 0;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
    }
    ctx.stroke();

    // 3. Draw Ticks
    ctx.font = "10px Geist Mono, ui-monospace, monospace";
    ctx.textBaseline = "middle";

    for (const tick of ticks) {
      const style = getTickStyle(tick, isDarkMode);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.lineWidth;

      ctx.beginPath();
      if (isHorizontal) {
        const startY = flip ? RULER_SIZE : 0;
        const endY = flip ? RULER_SIZE - style.height : style.height;
        ctx.moveTo(tick.pos, startY);
        ctx.lineTo(tick.pos, endY);
      } else {
        const startX = flip ? RULER_SIZE : 0;
        const endX = flip ? RULER_SIZE - style.height : style.height;
        ctx.moveTo(startX, tick.pos);
        ctx.lineTo(endX, tick.pos);
      }
      ctx.stroke();

      if (tick.label) {
        drawLabel(ctx, tick.label, tick.pos, isHorizontal, flip, isDarkMode);
      }
    }
  }, [canvasWidth, canvasHeight, isHorizontal, isDarkMode, flip, ticks]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        display: "block",
      }}
      className={isHorizontal ? "w-full" : "h-full"}
    />
  );
}
