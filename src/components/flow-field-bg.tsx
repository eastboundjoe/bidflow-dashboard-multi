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
    const c = canvas;

    const resize = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();

    const NUM_PARTICLES = 400;
    const SPEED = 1.3;

    // Spiral vortex flow: particles orbit the center with organic perturbation
    function flowAngle(x: number, y: number, t: number) {
      const cx = c.width / 2;
      const cy = c.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular to radius = pure spiral
      const spiral = Math.atan2(dy, dx) + Math.PI / 2;

      // Organic noise layered on top
      const noise =
        Math.sin(x * 0.008 + t * 0.5) * 0.6 +
        Math.sin(y * 0.006 - t * 0.4) * 0.4 +
        Math.sin(dist * 0.012 + t * 0.3) * 0.5;

      return spiral + noise;
    }

    const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      life: Math.random(),
      maxLife: 0.6 + Math.random() * 0.4,
      hueOffset: (i / NUM_PARTICLES) * 360, // spread rainbow across all particles
    }));

    let t = 0;

    function tick() {
      const w = c.width;
      const h = c.height;

      // Slow fade = longer wispy trails behind each dot
      ctx.fillStyle = "rgba(3, 7, 18, 0.07)";
      ctx.fillRect(0, 0, w, h);

      t += 0.008;

      for (const p of particles) {
        const angle = flowAngle(p.x, p.y, t);

        p.x += Math.cos(angle) * SPEED;
        p.y += Math.sin(angle) * SPEED;
        p.life -= 0.004;

        if (
          p.life <= 0 ||
          p.x < -4 || p.x > w + 4 ||
          p.y < -4 || p.y > h + 4
        ) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = p.maxLife;
        }

        const alpha = (p.life / p.maxLife) * 0.8;
        // Rainbow cycling: each particle has an offset, hue shifts over time
        const hue = (p.hueOffset + t * 40) % 360;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 90%, 65%, ${alpha})`;
        ctx.fill();
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
