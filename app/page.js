'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import TimelineBar from '@/components/TimelineBar';

// Dynamic imports for Three.js components (must be client-side only)
const OrbitView = dynamic(() => import('@/components/OrbitView'), { ssr: false });
const LatitudePanel = dynamic(() => import('@/components/LatitudePanel'), { ssr: false });
const SunlightPanel = dynamic(() => import('@/components/SunlightPanel'), { ssr: false });

export default function Home() {
  return (
    <div className="app-layout">
      <Header />
      
      <main className="main-content">
        {/* Left: Main orbit / celestial sphere view */}
        <OrbitView />

        {/* Right: Side panels */}
        <div className="side-panels">
          {/* Earth globe with observer latitude */}
          <LatitudePanel />

          {/* Sunlight angle / spread visualization */}
          <SunlightPanel />
        </div>
      </main>

      <TimelineBar />
    </div>
  );
}
