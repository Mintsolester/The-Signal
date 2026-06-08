import React, { useRef, useEffect } from 'react';

interface SignalFrequencyProps {
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type?: 'text' | 'coordinates' | 'audio' | 'symbol' | 'all';
  solved?: boolean;
  modifier1?: number; // e.g. carrierFreq or current slide value
  modifier2?: number; // e.g. modulatorFreq or current slider
}

export default function SignalFrequency({
  difficulty = 'LOW',
  type = 'all',
  solved = false,
  modifier1 = 0,
  modifier2 = 0,
}: SignalFrequencyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;

    // Handle Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Colors
    const getAccentColor = () => {
      if (solved) return '#06b6d4'; // bright Cyan resolved
      if (type === 'audio') return '#3b82f6'; // Deep space blue
      if (type === 'coordinates') return '#10b981'; // Green matrix tracking
      if (type === 'symbol') return '#ec4899'; // Magenta glyphs
      return '#f59e0b'; // Amber warning
    };

    // Render loop
    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, width, height);

      // Draw faint background coordinate grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw horizontal center baseline
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const accentColor = getAccentColor();

      // Configure frequencies based on active puzzle modes
      let waveCount = 3;
      let primarySpeed = 0.04;
      let secondarySpeed = 0.015;

      if (solved) {
        // Solved state is a clean, hyper-focused steady harmonic resonance
        waveCount = 1;
        primarySpeed = 0.01;
      } else if (type === 'audio') {
        // Adjust parameters linearly based on interactive modifiers
        waveCount = 2;
        primarySpeed = 0.06 * (modifier1 / 500); 
      } else if (type === 'coordinates') {
        waveCount = 4;
        primarySpeed = 0.02;
      }

      // Draw actual signal wave traces
      for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        ctx.lineWidth = i === 0 ? 2 : 1;
        
        // Dynamic opacity
        const opacity = solved
          ? 0.8
          : i === 0
          ? 0.6
          : 0.25 - (i * 0.05);
        ctx.strokeStyle = accentColor + Math.floor(opacity * 255).toString(16).padStart(2, '0');

        const amplitude = solved
          ? 25
          : (25 + i * 15) * (type === 'audio' ? 0.5 + modifier2 * 1.5 : 1);

        const frequency = solved
          ? 0.015
          : 0.01 + (i * 0.005) + (type === 'audio' ? (modifier1 * 0.0001) : 0);

        for (let x = 0; x < width; x++) {
          // Complex orbital waveform synthesis
          const phase = offset * (i === 0 ? primarySpeed : secondarySpeed);
          const y =
            height / 2 +
            Math.sin(x * frequency + phase) * amplitude +
            Math.cos(x * 0.003 - phase * 0.7) * (amplitude * 0.4);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // Draw vertical alignment bar or target reticle
      if (!solved) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // lock radar line
        ctx.lineWidth = 1;
        const lockPos = (width * 0.5) + Math.sin(offset * 0.01) * (width * 0.2);
        ctx.beginPath();
        ctx.moveTo(lockPos, 0);
        ctx.lineTo(lockPos, height);
        ctx.stroke();

        // draw tiny tag
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.font = '8px monospace';
        ctx.fillText('RADAR_SWEEP_LOCK', lockPos + 5, 12);
      } else {
        // Stable Lock Badge
        ctx.fillStyle = '#06b6d4';
        ctx.font = '9px monospace';
        ctx.fillText('▶ COHERENT HARMONIC COUPLING DETECTED', 10, 20);
      }

      offset += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [type, solved, modifier1, modifier2]);

  return (
    <div id="frequency-panel" className="relative w-full h-40 bg-zinc-950/60 rounded-lg overflow-hidden border border-zinc-800/80">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute top-2 right-3 flex items-center gap-1.5 pointer-events-none">
        <span className={`w-1.5 h-1.5 rounded-full ${solved ? 'bg-cyan-500 animate-pulse' : 'bg-amber-500 animate-ping'}`} />
        <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest leading-none">
          {solved ? 'Link Established' : `TELESCOPE STREAM // ${type}`}
        </span>
      </div>
    </div>
  );
}
