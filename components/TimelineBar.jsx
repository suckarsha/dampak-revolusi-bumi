'use client';

import useSimulationStore, { MONTH_NAMES_ID, getMonthTooltip } from '@/store/simulationStore';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { audioSystem } from '@/utils/AudioEngine';

export default function TimelineBar() {
  const month = useSimulationStore((s) => s.month);
  const day = useSimulationStore((s) => s.day);
  const isAnimating = useSimulationStore((s) => s.isAnimating);
  const animationSpeed = useSimulationStore((s) => s.animationSpeed);
  const setDate = useSimulationStore((s) => s.setDate);
  const setDayOfYear = useSimulationStore((s) => s.setDayOfYear);
  const setAnimationSpeed = useSimulationStore((s) => s.setAnimationSpeed);
  const toggleAnimation = useSimulationStore((s) => s.toggleAnimation);
  const advanceTime = useSimulationStore((s) => s.advanceTime);
  const getDateString = useSimulationStore((s) => s.getDateString);
  const getDayOfYear = useSimulationStore((s) => s.getDayOfYear);
  const getSeasonInfo = useSimulationStore((s) => s.getSeasonInfo);
  const seasonInfo = useMemo(() => getSeasonInfo(), [month, day]);

  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [hoveredMonth, setHoveredMonth] = useState(null);

  const animate = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    
    // Smooth advance every frame
    advanceTime(delta);
    lastTimeRef.current = timestamp;
    
    animRef.current = requestAnimationFrame(animate);
  }, [advanceTime]);

  useEffect(() => {
    if (isAnimating) {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    } else {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    }
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [isAnimating, animate]);

  const handleMonthClick = useCallback((m) => {
    audioSystem?.playClick();
    setDate(m, 15);
  }, [setDate]);

  // Hitung progress sebagai persentase dari tahun
  const doy = getDayOfYear();
  const progress = ((doy - 1) / 364) * 100;
  const markerLeft = `${progress}%`;

  // Titik tengah setiap bulan dalam Day of Year (basis 364/365 hari)
  const monthMidDOY = [16.5, 46, 75.5, 106, 136.5, 167, 197.5, 228.5, 259, 289.5, 320, 350.5];

  const speedLabels = ['0.5x', '1x', '2x', '4x'];
  const speedValues = [0.5, 1, 2, 4];

  return (
    <div className="timeline-bar">
      {/* Season info strip */}
      <div className="timeline-bar__season-strip">
        <span className="timeline-bar__season-item timeline-bar__season-item--north">
          {seasonInfo.iconN} Utara: {seasonInfo.north}
        </span>
        <span className="timeline-bar__season-divider">│</span>
        <span className="timeline-bar__season-item timeline-bar__season-item--south">
          {seasonInfo.iconS} Selatan: {seasonInfo.south}
        </span>
      </div>

      {/* Day slider row */}
      <div className="timeline-bar__day-slider-row">
        <input
          type="range"
          className="timeline-bar__day-slider"
          min={1}
          max={365}
          step={1}
          value={Math.round(doy)}
          onChange={(e) => setDayOfYear(Number(e.target.value))}
        />
      </div>

      {/* Month labels row */}
      <div className="timeline-bar__months">
        <div className="timeline-bar__track" />
        <div className="timeline-bar__progress" style={{ width: `${progress}%` }} />
        <div className="timeline-bar__marker" style={{ left: markerLeft }} />
        
        {MONTH_NAMES_ID.map((name, i) => {
          const tooltip = getMonthTooltip(i);
          const midDOY = monthMidDOY[i];
          const posPercent = ((midDOY - 1) / 364) * 100;
          return (
            <div
              key={i}
              className={`timeline-bar__month ${i === month ? 'timeline-bar__month--active' : ''}`}
              style={{ left: `${posPercent}%` }}
              onClick={() => handleMonthClick(i)}
              onMouseEnter={() => tooltip && setHoveredMonth(i)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              {name}
              {hoveredMonth === i && tooltip && (
                <div className="timeline-bar__tooltip">
                  {tooltip}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls row */}
      <div className="timeline-bar__controls">
        {/* Speed selector */}
        <div className="timeline-bar__speed">
          <span className="timeline-bar__speed-label">kecepatan:</span>
          <div className="timeline-bar__speed-btns">
            {speedLabels.map((label, i) => (
              <button
                key={i}
                className={`timeline-bar__speed-btn ${animationSpeed === speedValues[i] ? 'timeline-bar__speed-btn--active' : ''}`}
                onClick={() => setAnimationSpeed(speedValues[i])}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date display */}
        <div className="timeline-bar__date">
          {getDateString()}
        </div>

        {/* Animation button */}
        <button
          className={`timeline-bar__animation-btn ${
            isAnimating ? 'timeline-bar__animation-btn--stop' : 'timeline-bar__animation-btn--start'
          }`}
          onClick={() => {
            audioSystem?.playClick();
            toggleAnimation();
          }}
        >
          {isAnimating ? '⏹ Stop' : '▶ Start'}
        </button>
      </div>
    </div>
  );
}
