"use client";

import { useEffect, useRef } from "react";

export function FlowFieldBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const c = canvas;
    const NUM_PARTICLES = 350;
    const SPEED = 1.0;

    function flowAngle(x: number, y: number, t: number) {
      const nx = x * 0.0025;
      const ny = y * 0.0025;
      return (
        Math.sin(nx + t * 0.35) * Math.cos(ny + t * 0.25) +
        Math.sin(nx * 0.4 - t * 0.15) * 0.6
      ) * Math.PI * 2;
    }

    // Assign color per particle at birth — red or blue
    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      life: Math.random(),
      maxLife: 0.6 + Math.random() * 0.4,
      isRed: Math.random() > 0.5,
    }));

    let t = 0;

    function tick() {
      const w = c.width;
      const h = c.height;

      // Moderate fade — trails visible but don't persist as laser beams
      ctx.fillStyle = "rgba(3, 7, 18, 0.08)";
      ctx.fillRect(0, 0, w, h);

      t += 0.002;

      for (const p of particles) {
        const angle = flowAngle(p.x, p.y, t);

        const prevX = p.x;
        const prevY = p.y;
        p.x += Math.cos(angle) * SPEED;
        p.y += Math.sin(angle) * SPEED;
        p.life -= 0.004;

        if (
          p.life <= 0 ||
          p.x < -2 || p.x > w + 2 ||
          p.y < -2 || p.y > h + 2
        ) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = p.maxLife;
          p.isRed = Math.random() > 0.5;
        }

        const alpha = (p.life / p.maxLife) * 0.7;
        // Red: hsl(5, 90%, 60%) — Blue: hsl(215, 90%, 65%)
        const color = p.isRed
          ? `hsla(5, 90%, 60%, ${alpha})`
          : `hsla(215, 90%, 65%, ${alpha})`;

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      animId = requestAnimationFrame(tick);
    }

    ctx.fillStyle = "rgb(3, 7, 18)";
    ctx.fillRect(0, 0, c.width, c.height);
    tick();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
