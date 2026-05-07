'use client';

import { useRef, useEffect, useCallback } from 'react';
import useSimulationStore from '@/store/simulationStore';

/* =============================================
   Sunlight Angle View — Side view showing angle of sunlight
   ============================================= */
function drawSunlightAngle(ctx, width, height, altitude) {
  ctx.clearRect(0, 0, width, height);

  const groundY = height * 0.85;
  const groundHeight = height * 0.15;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, '#1e3a5f');
  skyGrad.addColorStop(1, '#87ceeb');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, groundY);

  // Ground
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
  groundGrad.addColorStop(0, '#4a7c3f');
  groundGrad.addColorStop(1, '#2d5a27');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, width, groundHeight);

  // Ground line
  ctx.strokeStyle = '#6b9e5e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();

  // N and S labels
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('← U', 8, height - 6);
  ctx.textAlign = 'right';
  ctx.fillText('S →', width - 8, height - 6);

  // Sunlight rays
  const altRad = (Math.max(0, Math.min(90, altitude)) * Math.PI) / 180;
  const numRays = 12;
  const raySpacing = width / (numRays + 1);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.lineWidth = 1.5;

  for (let i = 1; i <= numRays; i++) {
    const baseX = i * raySpacing;
    const baseY = groundY;
    const rayLen = height * 0.9;
    const endX = baseX - Math.cos(altRad) * rayLen;
    const endY = baseY - Math.sin(altRad) * rayLen;

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Arrowhead
    const arrowSize = 6;
    const angle = Math.atan2(baseY - endY, baseX - endX);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(
      baseX - arrowSize * Math.cos(angle - 0.4),
      baseY - arrowSize * Math.sin(angle - 0.4)
    );
    ctx.lineTo(
      baseX - arrowSize * Math.cos(angle + 0.4),
      baseY - arrowSize * Math.sin(angle + 0.4)
    );
    ctx.closePath();
    ctx.fill();
  }

  // Angle arc
  if (altitude > 0 && altitude < 90) {
    const centerX = width * 0.5;
    const arcRadius = 40;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(centerX, groundY, arcRadius, -Math.PI, -Math.PI + altRad, false);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angle text
    ctx.fillStyle = '#fde68a';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const labelX = centerX + Math.cos(-Math.PI + altRad / 2) * (arcRadius + 15);
    const labelY = groundY + Math.sin(-Math.PI + altRad / 2) * (arcRadius + 15);
    ctx.fillText(`${altitude.toFixed(1)}°`, labelX, labelY);
  }
}

/* =============================================
   Sunbeam Spread View — Top-down view showing energy spread
   ============================================= */
function drawSunbeamSpread(ctx, width, height, altitude) {
  ctx.clearRect(0, 0, width, height);

  // Background (light blue grid)
  ctx.fillStyle = '#e8f4fd';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  const gridSize = 30;
  ctx.strokeStyle = '#c5dff0';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // N and S labels
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑ U', width / 2, 16);
  ctx.fillText('↓ S', width / 2, height - 6);

  // Draw sun spot — the ellipse representing the sunlight spread on the ground
  const altRad = (Math.max(1, Math.min(89, altitude)) * Math.PI) / 180;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // At altitude=90°, the spot is a circle (1:1)
  // At lower altitudes, the spot stretches (ellipse)
  const baseRadius = Math.min(width, height) * 0.12;
  const radiusX = baseRadius;
  const radiusY = baseRadius / Math.sin(altRad);
  const clampedRadiusY = Math.min(radiusY, height * 0.45);

  // Sun spot gradient
  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(radiusX, clampedRadiusY));
  grad.addColorStop(0, 'rgba(253, 230, 138, 0.9)');
  grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.5)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0.1)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, clampedRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, clampedRadiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
}


/* =============================================
   Main SunlightPanel Component
   ============================================= */
export default function SunlightPanel() {
  const canvasRef = useRef(null);
  const sunlightMode = useSimulationStore((s) => s.sunlightMode);
  const setSunlightMode = useSimulationStore((s) => s.setSunlightMode);
  const earthViewMode = useSimulationStore((s) => s.earthViewMode);
  const setEarthViewMode = useSimulationStore((s) => s.setEarthViewMode);
  const sunAltitude = useSimulationStore((s) => s.getSunAltitude());
  const latitude = useSimulationStore((s) => s.latitude);
  const getLatitudeString = useSimulationStore((s) => s.getLatitudeString);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      
      if (sunlightMode === 'angle') {
        drawSunlightAngle(ctx, rect.width, rect.height, sunAltitude);
      } else {
        drawSunbeamSpread(ctx, rect.width, rect.height, sunAltitude);
      }
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, [sunlightMode, sunAltitude]);

  // Redraw on changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    if (sunlightMode === 'angle') {
      drawSunlightAngle(ctx, rect.width, rect.height, sunAltitude);
    } else {
      drawSunbeamSpread(ctx, rect.width, rect.height, sunAltitude);
    }
  }, [sunlightMode, sunAltitude]);

  return (
    <div className="sunlight-panel">
      {/* Mode selector */}
      <div className="sunlight-panel__mode">
        <label className="sunlight-panel__mode-option">
          <input
            type="radio"
            name="sunlightMode"
            checked={sunlightMode === 'spread'}
            onChange={() => setSunlightMode('spread')}
          />
          sebaran cahaya
        </label>
        <label className="sunlight-panel__mode-option">
          <input
            type="radio"
            name="sunlightMode"
            checked={sunlightMode === 'angle'}
            onChange={() => setSunlightMode('angle')}
          />
          sudut cahaya
        </label>
      </div>

      {/* Canvas */}
      <div className="sunlight-panel__canvas-wrapper">
        <canvas ref={canvasRef} className="canvas-2d" />

        {/* Data overlay */}
        <div className="sunlight-panel__data">
          altitude matahari: <span>{sunAltitude.toFixed(1)}°</span><br />
          lintang pengamat: <span>{getLatitudeString()}</span>
        </div>
      </div>
    </div>
  );
}
