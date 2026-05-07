'use client';

import useSimulationStore, { MONTH_NAMES_ID } from '@/store/simulationStore';
import { useEffect, useRef, useCallback } from 'react';

export default function TimelineBar() {
  const month = useSimulationStore((s) => s.month);
  const day = useSimulationStore((s) => s.day);
  const isAnimating = useSimulationStore((s) => s.isAnimating);
  const setDate = useSimulationStore((s) => s.setDate);
  const toggleAnimation = useSimulationStore((s) => s.toggleAnimation);
  const advanceTime = useSimulationStore((s) => s.advanceTime);
  const getDateString = useSimulationStore((s) => s.getDateString);
  const getDayOfYear = useSimulationStore((s) => s.getDayOfYear);

  const animRef = useRef(null);
  const lastTimeRef = useRef(0);

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

  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const handleMonthClick = (m) => {
    setDate(m, 1);
  };

  // Hitung progress sebagai persentase dari tahun
  const doy = getDayOfYear();
  const progress = ((doy - 1) / 364) * 100;

  // Hitung posisi marker
  const markerLeft = `${progress}%`;

  return (
    <div className="timeline-bar">
      <div className="timeline-bar__months">
        <div className="timeline-bar__track" />
        <div className="timeline-bar__progress" style={{ width: `${progress}%` }} />
        <div className="timeline-bar__marker" style={{ left: markerLeft }} />
        
        {MONTH_NAMES_ID.map((name, i) => (
          <div
            key={i}
            className={`timeline-bar__month ${i === month ? 'timeline-bar__month--active' : ''}`}
            onClick={() => handleMonthClick(i)}
          >
            {name}
          </div>
        ))}
      </div>

      <div className="timeline-bar__date">
        {getDateString()}
      </div>

      <button
        className={`timeline-bar__animation-btn ${
          isAnimating ? 'timeline-bar__animation-btn--stop' : 'timeline-bar__animation-btn--start'
        }`}
        onClick={toggleAnimation}
      >
        {isAnimating ? '⏹ Hentikan' : '▶ Mulai Animasi'}
      </button>
    </div>
  );
}
