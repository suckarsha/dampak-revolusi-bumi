'use client';

import { useRef, useMemo, useCallback, Suspense, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import useSimulationStore from '@/store/simulationStore';

/* =============================================
   Latitude circle points generator
   Creates points for a circle at a given latitude on a sphere
   ============================================= */
function getLatitudeCirclePoints(latDeg, radius, segments = 96) {
  const latRad = (latDeg * Math.PI) / 180;
  const r = Math.cos(latRad) * radius;
  const y = Math.sin(latRad) * radius;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      r * Math.cos(angle),
      y,
      r * Math.sin(angle)
    ));
  }
  return pts;
}

/* =============================================
   Ecliptic path on Earth surface (annual sun path)
   Shows the path the subsolar point traces over a year
   ============================================= */
function EclipticPath({ radius }) {
  const points = useMemo(() => {
    const pts = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      // Longitude goes from 0 to 2π
      const lon = (i / segments) * Math.PI * 2;
      // Latitude follows declination: δ = 23.44° × sin(lon)
      const latRad = (23.44 * Math.PI / 180) * Math.sin(lon);
      const r = Math.cos(latRad) * radius;
      const y = Math.sin(latRad) * radius;
      pts.push(new THREE.Vector3(
        r * Math.cos(lon),
        y,
        r * Math.sin(lon)
      ));
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color="#ef4444"
      lineWidth={2.5}
      opacity={0.85}
      transparent
    />
  );
}

/* =============================================
   Subsolar Point — Yellow dot showing where
   the sun is directly overhead (gerak semu tahunan)
   ============================================= */
function SubsolarPoint({ radius, declination }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const declRad = (declination * Math.PI) / 180;

  // Position the subsolar point on the surface facing the camera (positive X)
  const surfY = Math.sin(declRad) * radius;
  const surfX = Math.cos(declRad) * radius;

  // Pulsing animation
  useFrame(() => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(Date.now() * 0.004) * 0.15;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={[surfX, surfY, 0]}>
      {/* Main yellow dot */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius * 0.06, 24, 24]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>
      {/* Glow ring */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 0.095, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[radius * 0.14, 24, 24]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.15} />
      </mesh>
      {/* Gray outline ring like NAAP */}
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[radius * 0.065, radius * 0.08, 32]} />
        <meshBasicMaterial color="#6b7280" side={THREE.DoubleSide} opacity={0.7} transparent />
      </mesh>
    </group>
  );
}

/* =============================================
   Latitude Grid Lines — shown in "dari matahari" view
   Displays equator, tropics, arctic circles, and
   intermediate latitude lines
   ============================================= */
function LatitudeGridLines({ radius }) {
  const gridLatitudes = useMemo(() => {
    const lats = [];
    // Major lines
    const majorLines = [
      { lat: 0, color: '#ef4444', width: 2.5, opacity: 0.8, label: 'Ekuator' },          // Equator — red
      { lat: 23.44, color: '#22c55e', width: 2, opacity: 0.7, label: 'Tropic Cancer' },   // Tropic of Cancer
      { lat: -23.44, color: '#22c55e', width: 2, opacity: 0.7, label: 'Tropic Capricorn' }, // Tropic of Capricorn
      { lat: 66.56, color: '#22c55e', width: 1.5, opacity: 0.5, label: 'Arctic Circle' }, // Arctic Circle
      { lat: -66.56, color: '#22c55e', width: 1.5, opacity: 0.5, label: 'Antarctic Circle' }, // Antarctic Circle
    ];

    // Intermediate latitude lines every 30°
    const minorLats = [30, -30, 60, -60];
    for (const lat of minorLats) {
      lats.push({ lat, color: '#22c55e', width: 1, opacity: 0.3 });
    }

    return [...majorLines, ...lats];
  }, []);

  return (
    <>
      {gridLatitudes.map((item, i) => (
        <Line
          key={i}
          points={getLatitudeCirclePoints(item.lat, radius * 1.002)}
          color={item.color}
          lineWidth={item.width}
          opacity={item.opacity}
          transparent
        />
      ))}
    </>
  );
}


/* =============================================
   Earth Globe — Side view (dari samping)
   ============================================= */
function EarthGlobeSide() {
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
   Earth Globe — Sun view (dari matahari)
   Shows the Earth as seen from the sun with:
   - Full illumination (viewing the lit hemisphere)
   - Latitude grid lines (green)
   - Equator (red)
   - Ecliptic path
   - Subsolar point (yellow dot)
   - Axis tilt visible
   This demonstrates "gerak semu tahunan matahari"
   ============================================= */
function EarthGlobeSun() {
  const earthRef = useRef();
  const dayOfYear = useSimulationStore((s) => s.getDayOfYear());
  const declination = useSimulationStore((s) => s.getSunDeclination());
  const latitude = useSimulationStore((s) => s.latitude);

  const earthTexture = useLoader(THREE.TextureLoader, '/earth_texture.jpg');
  const bumpTexture = useLoader(THREE.TextureLoader, '/earth_bump.jpg');

  const tiltRad = (23.44 * Math.PI) / 180;
  const orbitAngle = ((dayOfYear - 80) / 365.25) * Math.PI * 2;
  const latRad = (latitude * Math.PI) / 180;
  const R = 1.2;

  return (
    <>
      {/* Even lighting from the camera direction (sun's perspective) */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 0, 0]} intensity={3.0} color="#fff8e7" />
      {/* Fill light to make the globe evenly lit from the sun's POV */}
      <directionalLight position={[5, 3, 2]} intensity={1.0} color="#ffffff" />
      <directionalLight position={[5, -3, -2]} intensity={0.8} color="#ffffff" />

      {/* Earth group — tilted axis visible */}
      <group rotation={[0, Math.PI + orbitAngle, 0]}>
        <group rotation={[-tiltRad, 0, 0]}>
          {/* Earth sphere */}
          <mesh ref={earthRef}>
            <sphereGeometry args={[R, 64, 64]} />
            <meshStandardMaterial
              map={earthTexture}
              bumpMap={bumpTexture}
              bumpScale={0.02}
              roughness={0.9}
              metalness={0.0}
            />
          </mesh>

          {/* Slight atmosphere */}
          <mesh>
            <sphereGeometry args={[R * 1.02, 64, 64]} />
            <meshBasicMaterial color="#87ceeb" transparent opacity={0.06} side={THREE.BackSide} />
          </mesh>

          {/* Axis pole line */}
          <Line
            points={[[0, -R * 1.6, 0], [0, R * 1.6, 0]]}
            color="#94a3b8"
            lineWidth={1.5}
          />

          {/* === LATITUDE GRID LINES === */}
          <LatitudeGridLines radius={R} />

          {/* === ECLIPTIC PATH (annual sun path on Earth surface) === */}
          <EclipticPath radius={R} />
        </group>
      </group>

      {/* === SUBSOLAR POINT & OBSERVER === */}
      {/* These are in "camera-aligned" space — always face the viewer (sun) */}
      <group>
        {/* Subsolar point — the yellow dot that demonstrates gerak semu tahunan */}
        <SubsolarPoint radius={R} declination={declination} />

        {/* Observer latitude ring (RED) — on the spherical surface */}
        <group rotation={[Math.PI / 2 - latRad, 0, 0]}>
          <mesh>
            <ringGeometry args={[Math.cos(latRad) * R * 0.995, Math.cos(latRad) * R * 1.008, 128]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} opacity={0.6} transparent />
          </mesh>
        </group>

        {/* Observer dot on surface */}
        {(() => {
          const surfX = Math.cos(latRad) * R;
          const surfY = Math.sin(latRad) * R;
          return (
            <mesh position={[surfX, surfY, 0]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          );
        })()}
      </group>

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        makeDefault
      />
    </>
  );
}


/* =============================================
   Sunlight Arrows — Animated Energy Beams
   ============================================= */
function SunlightArrows({ earthRadius }) {
  const R = earthRadius;
  const arrowColor = '#fbbf24';
  const beamGroupRef = useRef();
  
  const arrows = useMemo(() => {
    const result = [];
    const startX = 3.5;
    const endX = R + 0.35;
    const length = startX - endX;
    
    // Baris arah sinar (seperti NAAP)
    const yPositions = [];
    for (let y = -1.6; y <= 1.6; y += 0.4) {
      yPositions.push(y);
    }
    
    for (const y of yPositions) {
      result.push({ y, z: 0, startX, endX, length });
    }
    return result;
  }, [R]);

  useFrame((state) => {
    if (!beamGroupRef.current) return;
    const time = state.clock.getElapsedTime();
    
    beamGroupRef.current.children.forEach((row, i) => {
      const arrow = arrows[i];
      row.children.forEach((photon, j) => {
        // Kecepatan gerak aliran energi
        const speed = 0.4;
        // Jarak antar partikel dalam 1 baris
        const phase = j * 0.5; 
        // Waktu dengan offset baris agar pergerakannya terlihat organik (tidak berbarengan kaku)
        const t = time * speed + phase + (i * 0.15);
        const progress = t % 1.0;
        
        // Pergerakan dari kanan ke kiri
        photon.position.x = arrow.startX - (progress * arrow.length);
        
        // Efek fade-in saat muncul & fade-out saat menabrak bumi
        if (progress > 0.8) {
          photon.material.opacity = (1.0 - progress) * 5; 
        } else if (progress < 0.2) {
          photon.material.opacity = progress * 5; 
        } else {
          photon.material.opacity = 1.0;
        }
      });
    });
  });

  return (
    <group>
      {/* Garis lintasan redup di background */}
      {arrows.map((arrow, i) => (
        <Line
          key={`track-${i}`}
          points={[[arrow.startX, arrow.y, arrow.z], [arrow.endX, arrow.y, arrow.z]]}
          color={arrowColor}
          lineWidth={1}
          transparent
          opacity={0.15}
        />
      ))}
      
      {/* Panah Energi (Foton) Bergerak */}
      <group ref={beamGroupRef}>
        {arrows.map((arrow, i) => (
          <group key={`row-${i}`} position={[0, arrow.y, arrow.z]}>
            {/* 2 Foton per jalur sinar */}
            {[0, 1].map((j) => (
              <mesh key={`photon-${j}`} rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[0.06, 0.4, 6]} />
                {/* Material individu agar opacity bisa diatur masing-masing */}
                <meshBasicMaterial color={arrowColor} transparent opacity={0} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}


/* =============================================
   Latitude Drag Handler overlay
   ============================================= */
function LatitudeDragOverlay() {
  const setLatitude = useSimulationStore((s) => s.setLatitude);
  const isDragging = useRef(false);

  const updateLatitude = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const normalizedY = y / rect.height;
    // Map: top=90°N, middle=0°, bottom=90°S
    const lat = 90 - normalizedY * 180;
    setLatitude(Math.round(Math.max(-90, Math.min(90, lat))));
  }, [setLatitude]);

  const handlePointerDown = useCallback((e) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateLatitude(e);
  }, [updateLatitude]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    updateLatitude(e);
  }, [updateLatitude]);

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false;
  }, []);

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
  const [showSettings, setShowSettings] = useState(false);
  const latitudeString = useSimulationStore((s) => s.getLatitudeString());
  const earthViewMode = useSimulationStore((s) => s.earthViewMode);
  const setEarthViewMode = useSimulationStore((s) => s.setEarthViewMode);
  const setLatitude = useSimulationStore((s) => s.setLatitude);
  const declination = useSimulationStore((s) => s.getSunDeclination());

  // Camera position changes based on view mode
  // "sun" = look from the sun (positive X direction), "side" = look from the side (positive Z direction)
  const cameraPos = earthViewMode === 'sun' ? [5.5, 0, 0] : [0, 0, 5.5];

  return (
    <div className="earth-panel">
      <div className="earth-panel__hint">
        {earthViewMode === 'sun'
          ? 'titik kuning = titik subsolar (matahari di zenith)'
          : 'seret figur pengamat untuk mengubah lintang'
        }
      </div>

      <Canvas
        className="canvas-3d"
        camera={{ position: cameraPos, fov: 32, near: 0.1, far: 50 }}
        gl={{ antialias: true }}
        key={earthViewMode} // Force re-mount when view changes to reset camera
      >
        <Suspense fallback={null}>
          {earthViewMode === 'sun' ? <EarthGlobeSun /> : <EarthGlobeSide />}
        </Suspense>
      </Canvas>

      {/* Latitude drag overlay */}
      <LatitudeDragOverlay />

      {/* Subsolar declination info — only in sun view */}
      {earthViewMode === 'sun' && (
        <div style={{
          position: 'absolute', bottom: '44px', left: '16px',
          fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          background: 'rgba(10, 15, 30, 0.6)', backdropFilter: 'blur(12px)',
          padding: '8px 12px', borderRadius: '8px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderLeft: '3px solid var(--accent-primary)',
          zIndex: 10, lineHeight: 1.6,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
          <span className="tooltip-container" data-tooltip="Sudut dari ekuator langit ke arah matahari. Jika positif berarti matahari di belahan bumi utara.">
            deklinasi <span className="tooltip-icon">?</span>
          </span>: <span style={{ color: '#fde047', fontWeight: 700, fontSize: '0.8rem', textShadow: '0 0 8px rgba(253, 224, 71, 0.5)' }}>{declination.toFixed(1)}°</span><br />
          <span className="tooltip-container" data-tooltip="Titik di bumi di mana matahari tepat berada di atas kepala (zenith) pada tengah hari.">
            subsolar <span className="tooltip-icon">?</span>
          </span>: <span style={{ color: '#fde047', fontWeight: 700, fontSize: '0.8rem', textShadow: '0 0 8px rgba(253, 224, 71, 0.5)' }}>
            {Math.abs(declination).toFixed(1)}° {declination >= 0 ? 'U' : 'S'}
          </span>
        </div>
      )}

      <div className="earth-panel__latitude">
        lintang pengamat: <span>{latitudeString}</span>
      </div>

      {/* Settings Button */}
      <button 
        className="panel-settings-btn"
        onClick={() => setShowSettings(!showSettings)}
      >
        ⚙️
      </button>

      {/* Settings Popup */}
      {showSettings && (
        <div className="panel-settings-popup">
          <div className="panel-settings-popup__header">
            Pengaturan
            <button onClick={() => setShowSettings(false)}>×</button>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>SUDUT PANDANG</div>
            <div className="segmented-control" style={{ margin: 0 }}>
              <button
                className={`segmented-control__btn ${earthViewMode === 'sun' ? 'segmented-control__btn--active' : ''}`}
                onClick={() => { setEarthViewMode('sun'); setShowSettings(false); }}
              >
                Matahari
              </button>
              <button
                className={`segmented-control__btn ${earthViewMode === 'side' ? 'segmented-control__btn--active' : ''}`}
                onClick={() => { setEarthViewMode('side'); setShowSettings(false); }}
              >
                Samping
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>LOKASI PRESET</div>
            <select 
              className="preset-select"
              onChange={(e) => {
                if (e.target.value) {
                  setLatitude(parseFloat(e.target.value));
                  setShowSettings(false);
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Pilih Lokasi...</option>
              <option value="90">Kutub Utara (90° U)</option>
              <option value="66.5">Lingkar Arktik (66.5° U)</option>
              <option value="51">London (51° U)</option>
              <option value="35">Tokyo (35° U)</option>
              <option value="23.5">Garis Balik Utara (23.5° U)</option>
              <option value="0">Khatulistiwa (0°)</option>
              <option value="-6">Jakarta (6° S)</option>
              <option value="-8">Singaraja, Bali (8° S)</option>
              <option value="-23.5">Garis Balik Selatan (23.5° S)</option>
              <option value="-90">Kutub Selatan (90° S)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
