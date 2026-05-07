'use client';

import { useRef, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import useSimulationStore from '@/store/simulationStore';

/* =============================================
   Earth Globe with NASA texture
   ============================================= */
function EarthGlobe() {
  const earthRef = useRef();
  const latitude = useSimulationStore((s) => s.latitude);
  const showLabels = useSimulationStore((s) => s.showLabels);
  const rotateEarth = useSimulationStore((s) => s.rotateEarth);
  const dayOfYear = useSimulationStore((s) => s.getDayOfYear());
  
  const earthTexture = useLoader(THREE.TextureLoader, '/earth_texture.jpg');
  const bumpTexture = useLoader(THREE.TextureLoader, '/earth_bump.jpg');

  useFrame((_, delta) => {
    if (earthRef.current && rotateEarth) {
      earthRef.current.rotation.y += delta * 0.15;
    }
  });

  const tiltRad = (23.44 * Math.PI) / 180;
  const declRad = (useSimulationStore((s) => s.getSunDeclination()) * Math.PI) / 180;
  const orbitAngle = ((dayOfYear - 80) / 365.25) * Math.PI * 2;
  const latRad = (latitude * Math.PI) / 180;
  const R = 1.2; // Earth radius in this scene

  return (
    <>
      {/* Scene lighting - very low ambient light to make the night side pitch black */}
      <ambientLight intensity={0.05} />
      
      {/* Sunlight — directional from right side (sun direction), high intensity for bright day */}
      <directionalLight position={[10, 0, 0]} intensity={4.5} color="#ffffff" />

      {/* Sync global rotation with OrbitView so the terminator perfectly matches the season */}
      <group rotation={[0, Math.PI + orbitAngle, 0]}>
        <group rotation={[-tiltRad, 0, 0]}>
          {/* Earth sphere with NASA texture */}
          <mesh ref={earthRef}>
            <sphereGeometry args={[R, 64, 64]} />
            <meshStandardMaterial
              map={earthTexture}
              bumpMap={bumpTexture}
              bumpScale={0.03}
              roughness={1.0} // Fully rough for sharp terminator
              metalness={0.0} // No metalness
            />
          </mesh>

          {/* Atmosphere glow */}
          <mesh>
            <sphereGeometry args={[R * 1.025, 64, 64]} />
            <meshBasicMaterial color="#6ea8d7" transparent opacity={0.06} side={THREE.BackSide} />
          </mesh>

          {/* Axis pole line — extends well beyond Earth */}
          <Line
            points={[[0, -R * 1.6, 0], [0, R * 1.6, 0]]}
            color="#94a3b8"
            lineWidth={1.5}
          />

          {/* Equator ring (subtle gray) */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[R * 0.998, R * 1.005, 128]} />
            <meshBasicMaterial color="#64748b" side={THREE.DoubleSide} opacity={0.35} transparent />
          </mesh>

          {/* Tropic markers when labels enabled */}
          {showLabels && (
            <>
              {/* Tropic of Cancer (23.44° N) */}
              <group rotation={[Math.PI / 2 - (23.44 * Math.PI / 180), 0, 0]}>
                <mesh>
                  <ringGeometry args={[Math.cos(23.44 * Math.PI / 180) * R, Math.cos(23.44 * Math.PI / 180) * R * 1.005, 96]} />
                  <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} opacity={0.25} transparent />
                </mesh>
              </group>
              {/* Tropic of Capricorn (23.44° S) */}
              <group rotation={[Math.PI / 2 + (23.44 * Math.PI / 180), 0, 0]}>
                <mesh>
                  <ringGeometry args={[Math.cos(23.44 * Math.PI / 180) * R, Math.cos(23.44 * Math.PI / 180) * R * 1.005, 96]} />
                  <meshBasicMaterial color="#3b82f6" side={THREE.DoubleSide} opacity={0.25} transparent />
                </mesh>
              </group>
            </>
          )}
        </group>
      </group>

      {/* Observer overlay — decoupled from daily rotation, always on the right side */}
      <group rotation={[0, 0, -declRad]}>
        {/* Observer latitude ring (RED) */}
        <group rotation={[Math.PI / 2 - latRad, 0, 0]}>
          <mesh>
            <ringGeometry args={[Math.cos(latRad) * R * 0.995, Math.cos(latRad) * R * 1.01, 128]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} opacity={0.85} transparent />
          </mesh>
        </group>

        {/* Observer stick figure */}
        {(() => {
          const surfX = Math.cos(latRad) * R;
          const surfY = Math.sin(latRad) * R;
          const nx = Math.cos(latRad);
          const ny = Math.sin(latRad);
          const stickLen = 0.2;
          const headR = 0.05;
          return (
            <group>
              <Line
                points={[
                  [surfX, surfY, 0],
                  [surfX + nx * stickLen, surfY + ny * stickLen, 0]
                ]}
                color="#ffffff"
                lineWidth={3}
              />
              <mesh position={[surfX + nx * (stickLen + headR), surfY + ny * (stickLen + headR), 0]}>
                <sphereGeometry args={[headR, 12, 12]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[surfX, surfY, 0]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          );
        })()}
      </group>

      {/* ===== SUNLIGHT ARROWS ===== */}
      {/* These are the prominent horizontal arrows pointing from right to left,
          exactly like the NAAP reference. They show the direction of incoming sunlight. */}
      <SunlightArrows earthRadius={R} />

      {/* Camera controls — limited rotation for this panel */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        makeDefault
      />
    </>
  );
}

/* =============================================
   Sunlight Arrows — horizontal arrows from right→left
   matching the NAAP reference exactly
   ============================================= */
function SunlightArrows({ earthRadius }) {
  const R = earthRadius;
  const arrowColor = '#fbbf24';
  
  // Create a grid of arrows covering the visible area
  // NAAP shows ~8 rows of arrows, from above to below the Earth
  const arrows = useMemo(() => {
    const result = [];
    const startX = 3.2;   // Start from far right
    const endX = R + 0.35; // Fixed vertical stop for all arrows (matches NAAP perfectly)
    
    // 8 rows of arrows, spaced vertically
    const yPositions = [];
    for (let y = -1.6; y <= 1.6; y += 0.4) {
      yPositions.push(y);
    }
    
    for (const y of yPositions) {
      result.push({ y, z: 0, startX, endX });
    }
    
    return result;
  }, [R]);

  const arrowHeadSize = 0.08;

  return (
    <group>
      {arrows.map((arrow, i) => (
        <group key={i}>
          {/* Arrow shaft */}
          <Line
            points={[[arrow.startX, arrow.y, arrow.z], [arrow.endX + 0.1, arrow.y, arrow.z]]}
            color={arrowColor}
            lineWidth={1.8}
            transparent
            opacity={0.75}
          />
          {/* Arrowhead — triangle pointing left */}
          <mesh position={[arrow.endX, arrow.y, arrow.z]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[arrowHeadSize, arrowHeadSize * 2.5, 6]} />
            <meshBasicMaterial color={arrowColor} transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


/* =============================================
   Latitude Drag Handler overlay
   ============================================= */
function LatitudeDragOverlay() {
  const setLatitude = useSimulationStore((s) => s.setLatitude);
  const isDragging = useRef(false);

  const handlePointerDown = useCallback((e) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateLatitude(e);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    updateLatitude(e);
  }, []);

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false;
  }, []);

  const updateLatitude = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const normalizedY = y / rect.height;
    // Map: top=90°N, middle=0°, bottom=90°S
    const lat = 90 - normalizedY * 180;
    setLatitude(Math.round(Math.max(-90, Math.min(90, lat))));
  }, [setLatitude]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        cursor: 'ns-resize',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}


/* =============================================
   Main LatitudePanel Component
   ============================================= */
export default function LatitudePanel() {
  const getLatitudeString = useSimulationStore((s) => s.getLatitudeString);
  const earthViewMode = useSimulationStore((s) => s.earthViewMode);
  const setEarthViewMode = useSimulationStore((s) => s.setEarthViewMode);

  // Camera position changes based on view mode. Increased distance to make Earth smaller (match NAAP)
  const cameraPos = earthViewMode === 'sun' ? [5.5, 0, 0] : [0, 0, 5.5];

  return (
    <div className="earth-panel">
      <div className="earth-panel__hint">
        klik & seret figur pengamat atau lingkaran merah untuk mengubah lintang
      </div>

      <Canvas
        className="canvas-3d"
        camera={{ position: cameraPos, fov: 32, near: 0.1, far: 50 }}
        gl={{ antialias: true }}
        key={earthViewMode} // Force re-mount when view changes to reset camera
      >
        <Suspense fallback={null}>
          <EarthGlobe />
        </Suspense>
      </Canvas>

      {/* Latitude drag overlay */}
      <LatitudeDragOverlay />

      <div className="earth-panel__latitude">
        lintang pengamat: <span>{getLatitudeString()}</span>
      </div>

      <div style={{
        position: 'absolute', bottom: '12px', right: '16px', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-glass)', padding: '6px 10px', borderRadius: '6px', zIndex: 10,
        border: '1px solid var(--border-subtle)'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '4px' }}>
          <input type="radio" checked={earthViewMode === 'sun'} onChange={() => setEarthViewMode('sun')} style={{ accentColor: 'var(--accent-primary)', margin: 0 }} /> dari matahari
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="radio" checked={earthViewMode === 'side'} onChange={() => setEarthViewMode('side')} style={{ accentColor: 'var(--accent-primary)', margin: 0 }} /> dari samping
        </label>
      </div>
    </div>
  );
}
