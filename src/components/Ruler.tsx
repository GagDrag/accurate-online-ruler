import { useRef, useEffect, useMemo, useState } from "react";
import type { Unit } from "./RulerApp";

interface RulerProps {
  direction: "horizontal" | "vertical";
  unit: Unit;
  ppi: number;
  lengthPx: number;
  flip?: boolean;
}

const RULER_SIZE = 40; // px thickness of the ruler bar

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
    const result: { pos: number; isMajor: boolean; isMid: boolean; label: string }[] = [];
    if (unit === "px") {
      // Pixel ticks every 100px, minor every 50px, sub every 10px
      const step = 10;
      for (let px = 0; px <= lengthPx; px += step) {
        const isMajor = px % 100 === 0;
        const isMid = px % 50 === 0 && !isMajor;
        const label = isMajor ? `${px}` : "";
        result.push({ pos: px, isMajor, isMid, label });
      }
    } else if (unit === "cm") {
      // Metric: major every cm, mid every 5mm, minor every mm
      const mmPerPx = 25.4 / ppi;
      const totalMm = lengthPx * mmPerPx;
      for (let mm = 0; mm <= totalMm; mm += 1) {
        const px = mm / mmPerPx;
        const isMajor = mm % 10 === 0;
        const isMid = mm % 5 === 0 && !isMajor;
        const cm = mm / 10;
        const label = isMajor ? (Number.isInteger(cm) ? `${cm}` : `${cm}`) : "";
        result.push({ pos: px, isMajor, isMid, label });
      }
    } else {
      // Imperial: major every inch, mid every half-inch, minor every 1/8", sub every 1/16"
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
    }
    return result;
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

    // Background
    ctx.fillStyle = isDarkMode ? "#171717" : "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Border line
    ctx.strokeStyle = isDarkMode ? "#333333" : "#ebebeb";
    ctx.lineWidth = 1;
    if (isHorizontal) {
      const y = flip ? RULER_SIZE : 0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    } else {
      const x = flip ? RULER_SIZE : 0;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Draw ticks
    ctx.font = "10px Geist Mono, ui-monospace, monospace";
    ctx.textBaseline = "middle";

    for (const tick of ticks) {
      const tickHeight = tick.isMajor ? RULER_SIZE * 0.45 : tick.isMid ? RULER_SIZE * 0.28 : RULER_SIZE * 0.15;

      ctx.strokeStyle = tick.isMajor 
        ? (isDarkMode ? "#ffffff" : "#171717") 
        : tick.isMid 
          ? (isDarkMode ? "#666666" : "#888888") 
          : (isDarkMode ? "#444444" : "#c0c0c0");
      ctx.lineWidth = tick.isMajor ? 1.2 : 0.8;

      if (isHorizontal) {
        const startY = flip ? RULER_SIZE : 0;
        const endY = flip ? RULER_SIZE - tickHeight : tickHeight;
        ctx.beginPath();
        ctx.moveTo(tick.pos, startY);
        ctx.lineTo(tick.pos, endY);
        ctx.stroke();

        if (tick.label) {
          ctx.fillStyle = isDarkMode ? "#ffffff" : "#171717";
          ctx.textAlign = "center";
          // Position label away from ticks
          const labelY = flip ? 12 : RULER_SIZE - 12;
          ctx.fillText(tick.label, tick.pos, labelY);
        }
      } else {
        const startX = flip ? RULER_SIZE : 0;
        const endX = flip ? RULER_SIZE - tickHeight : tickHeight;
        ctx.beginPath();
        ctx.moveTo(startX, tick.pos);
        ctx.lineTo(endX, tick.pos);
        ctx.stroke();

        if (tick.label) {
          ctx.fillStyle = isDarkMode ? "#ffffff" : "#171717";
          ctx.save();
          const labelX = flip ? 12 : RULER_SIZE - 12;
          ctx.translate(labelX, tick.pos);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = "center";
          ctx.fillText(tick.label, 0, 0);
          ctx.restore();
        }
      }
    }
  }, [ticks, canvasWidth, canvasHeight, isHorizontal, flip, isDarkMode]);

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
