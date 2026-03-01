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

    const NUM_PARTICLES = 320;
    const SPEED = 0.55; // slow = short line segments per frame = no laser beams

    // Low-frequency noise so the flow field curves gently
    function flowAngle(x: number, y: number, t: number) {
      const nx = x * 0.003;
      const ny = y * 0.003;
      return (
        Math.sin(nx + t * 0.4) * Math.cos(ny + t * 0.3) +
        Math.sin(nx * 0.5 - t * 0.2) * 0.5
      ) * Math.PI * 2;
    }

    const c = canvas; // capture non-null reference for closures

    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      life: Math.random(),
      maxLife: 0.5 + Math.random() * 0.5,
    }));

    let t = 0;

    function tick() {
      const w = c.width;
      const h = c.height;

      // Fast fade = short trails, no laser streaks
      ctx.fillStyle = "rgba(3, 7, 18, 0.18)";
      ctx.fillRect(0, 0, w, h);

      t += 0.0015;

      for (const p of particles) {
        const angle = flowAngle(p.x, p.y, t);

        const prevX = p.x;
        const prevY = p.y;
        p.x += Math.cos(angle) * SPEED;
        p.y += Math.sin(angle) * SPEED;
        p.life -= 0.003;

        if (
          p.life <= 0 ||
          p.x < -2 || p.x > w + 2 ||
          p.y < -2 || p.y > h + 2
        ) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = p.maxLife;
        }

        const alpha = (p.life / p.maxLife) * 0.4;
        const hue = 205 + Math.sin(p.x * 0.005) * 20; // gentle blue-teal shift
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `hsla(${hue}, 75%, 65%, ${alpha})`;
        ctx.lineWidth = 0.8;
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
