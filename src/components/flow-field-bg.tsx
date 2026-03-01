"use client";

import { useEffect, useRef } from "react";

export function FlowFieldBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const COLS = 50;
    const ROWS = 35;
    const NUM_PARTICLES = 280;
    const SPEED = 1.4;

    // Smooth pseudo-noise using layered sin/cos
    function flowAngle(x: number, y: number, t: number) {
      const nx = (x / COLS) * 4;
      const ny = (y / ROWS) * 4;
      return (
        Math.sin(nx + t) * Math.cos(ny + t * 0.6) +
        Math.sin(nx * 0.5 - t * 0.4) * Math.cos(ny * 0.7 + t * 0.3)
      ) * Math.PI;
    }

    const c = canvas; // capture non-null reference for closures

    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      life: Math.random(),
      maxLife: 0.6 + Math.random() * 0.4,
    }));

    let t = 0;

    function tick() {
      const w = c.width;
      const h = c.height;

      // Fade previous frame — lower alpha = longer trails
      ctx.fillStyle = "rgba(3, 7, 18, 0.06)";
      ctx.fillRect(0, 0, w, h);

      t += 0.0025;

      for (const p of particles) {
        const col = Math.floor((p.x / w) * COLS);
        const row = Math.floor((p.y / h) * ROWS);
        const angle = flowAngle(col, row, t);

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
        }

        const alpha = (p.life / p.maxLife) * 0.55;
        // Blue-teal gradient per particle
        const hue = 200 + Math.sin(p.x / w * Math.PI) * 30;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animId = requestAnimationFrame(tick);
    }

    // Initial dark fill
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
