'use client';

import { useRef, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import useSimulationStore from '@/store/simulationStore';

/* =============================================
   Realistic Earth mesh with NASA texture
   ============================================= */
function EarthMesh({ position, tiltAngle, dayOfYear, showSubsolar, size = 0.35 }) {
  const earthRef = useRef();
  
  const earthTexture = useLoader(THREE.TextureLoader, '/earth_texture.jpg');
  const bumpTexture = useLoader(THREE.TextureLoader, '/earth_bump.jpg');

  const rotateEarth = useSimulationStore((s) => s.rotateEarth);

  useFrame((_, delta) => {
    if (earthRef.current && rotateEarth) {
      earthRef.current.rotation.y += delta * 0.15;
    }
  });

  const tiltRad = (tiltAngle * Math.PI) / 180;

  return (
    <group position={position}>
      {/* Tilt group — fixed tilt around X axis for astronomical accuracy */}
      <group rotation={[-tiltRad, 0, 0]}>
        {/* Earth sphere with real texture */}
        <mesh ref={earthRef}>
          <sphereGeometry args={[size, 64, 64]} />
          <meshStandardMaterial
            map={earthTexture}
            bumpMap={bumpTexture}
            bumpScale={0.02}
            roughness={1.0}
            metalness={0.0}
          />
        </mesh>

        {/* Atmosphere glow */}
        <mesh>
          <sphereGeometry args={[size * 1.03, 64, 64]} />
          <meshBasicMaterial
            color="#4a90d9"
            transparent
            opacity={0.08}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Axis line */}
        <Line
          points={[[0, -size * 1.7, 0], [0, size * 1.7, 0]]}
          color="#94a3b8"
          lineWidth={1.5}
        />

        {/* Equator ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size, size * 1.01, 96]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} opacity={0.5} transparent />
        </mesh>


      </group>
    </group>
  );
}

/* =============================================
   Sun with realistic glow
   ============================================= */
function SunMesh() {
  const glowRef = useRef();

  useFrame((_, delta) => {
    if (glowRef.current) {
      glowRef.current.rotation.z += delta * 0.05;
      const scale = 1 + Math.sin(Date.now() * 0.002) * 0.02;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Core sun */}
      <mesh>
        <sphereGeometry args={[0.5, 64, 64]} />
        <meshBasicMaterial color="#fff5d4" />
      </mesh>
      
      {/* Inner corona */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.58, 64, 64]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.35} />
      </mesh>

      {/* Mid corona */}
      <mesh>
        <sphereGeometry args={[0.72, 64, 64]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.12} />
      </mesh>

      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.95, 64, 64]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.04} />
      </mesh>

      {/* Sun light - very high intensity and low decay so it brightly lights the Earth */}
      <pointLight color="#ffffff" intensity={15} distance={100} decay={0.5} />
    </group>
  );
}

/* =============================================
   Orbit ring with subtle gradient
   ============================================= */
function OrbitRing() {
  const points = useMemo(() => {
    const pts = [];
    const e = 0.04; // Slightly exaggerated eccentricity for visual clarity
    const a = 3.5;
    
    for (let i = 0; i <= 256; i++) {
      const orbitAngle = (i / 256) * Math.PI * 2;
      // trueAnomaly = orbitAngle - perihelionAngle. Perihelion is at day 3, orbitAngle 0 is day 80.
      const perihelionAngle = ((3 - 80) / 365.25) * Math.PI * 2;
      const trueAnomaly = orbitAngle - perihelionAngle;
      
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly));
      
      pts.push(new THREE.Vector3(
        r * Math.cos(orbitAngle),
        0,
        r * Math.sin(orbitAngle)
      ));
    }
    return pts;
  }, []);

  return (
    <Line
      points={points}
      color="#475569"
      lineWidth={1.2}
      opacity={0.5}
      transparent
    />
  );
}

/* =============================================
   Season Labels
   ============================================= */
function SeasonLabels({ show }) {
  if (!show) return null;

  const labels = [
    { text: 'Ekuinoks Vernal\n(~21 Mar)', angle: 0, color: '#10b981' },
    { text: 'Solstis Musim Panas\n(~21 Jun)', angle: Math.PI / 2, color: '#f59e0b' },
    { text: 'Ekuinoks Autumnal\n(~23 Sep)', angle: Math.PI, color: '#f97316' },
    { text: 'Solstis Musim Dingin\n(~21 Des)', angle: 3 * Math.PI / 2, color: '#3b82f6' },
    { text: 'Perihelion\n(~3 Jan)', angle: ((3 - 80) / 365.25) * Math.PI * 2, color: '#ef4444' },
    { text: 'Aphelion\n(~4 Jul)', angle: ((185 - 80) / 365.25) * Math.PI * 2, color: '#8b5cf6' },
  ];

  return (
    <>
      {labels.map((label, i) => {
        const x = Math.cos(label.angle) * 4.3;
        const z = Math.sin(label.angle) * 4.3;
        return (
          <Html key={i} position={[x, 0.3, z]} center
            style={{
              fontSize: '10px', color: label.color,
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
              textAlign: 'center', whiteSpace: 'pre-line',
              pointerEvents: 'none', userSelect: 'none',
              textShadow: '0 0 10px rgba(0,0,0,0.9)',
            }}
          >
            {label.text}
          </Html>
        );
      })}
    </>
  );
}

function MonthMarkers({ show }) {
  if (!show) return null;
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const dim = [31,28,31,30,31,30,31,31,30,31,30,31];

  return (
    <>
      {months.map((name, i) => {
        let doy = 0;
        for (let j = 0; j < i; j++) doy += dim[j];
        doy += 15;
        const angle = ((doy - 80) / 365.25) * Math.PI * 2;
        
        const e = 0.04;
        const a = 3.5;
        const perihelionAngle = ((3 - 80) / 365.25) * Math.PI * 2;
        const trueAnomaly = angle - perihelionAngle;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly));

        return (
          <Html key={i} position={[Math.cos(angle) * r, -0.3, Math.sin(angle) * r]}
            center style={{ fontSize:'9px', color:'#64748b', fontFamily:'Inter', fontWeight:500, pointerEvents:'none', userSelect:'none' }}>
            {name}
          </Html>
        );
      })}
    </>
  );
}

/* =============================================
   Click orbit to set date
   ============================================= */
function OrbitInteraction() {
  const { raycaster } = useThree();
  const setDayOfYear = useSimulationStore((s) => s.setDayOfYear);

  const handleClick = useCallback((e) => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersect);
    if (intersect) {
      const angle = Math.atan2(intersect.z, intersect.x);
      let doy = (angle / (Math.PI * 2)) * 365.25 + 80;
      if (doy < 1) doy += 365;
      if (doy > 365) doy -= 365;
      setDayOfYear(Math.round(doy));
    }
  }, [raycaster, setDayOfYear]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick} visible={false}>
      <ringGeometry args={[2.5, 4.5, 64]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* =============================================
   Orbit Scene
   ============================================= */
function OrbitScene() {
  const dayOfYear = useSimulationStore((s) => s.getDayOfYear());
  const showLabels = useSimulationStore((s) => s.showLabels);
  const showSubsolar = useSimulationStore((s) => s.showSubsolarPoint);

  const orbitAngle = ((dayOfYear - 80) / 365.25) * Math.PI * 2;
  
  // Calculate elliptical orbit position
  const e = 0.04; // Eccentricity
  const a = 3.5;  // Semi-major axis
  const perihelionAngle = ((3 - 80) / 365.25) * Math.PI * 2;
  const trueAnomaly = orbitAngle - perihelionAngle;
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomaly));

  const earthX = Math.cos(orbitAngle) * r;
  const earthZ = Math.sin(orbitAngle) * r;

  return (
    <>
      <Stars radius={80} depth={60} count={4000} factor={3} saturation={0.3} fade speed={0.3} />
      <ambientLight intensity={0.05} />

      <SunMesh />
      <OrbitRing />

      <EarthMesh
        position={[earthX, 0, earthZ]}
        tiltAngle={23.44}
        dayOfYear={dayOfYear}
        showSubsolar={showSubsolar}
        size={0.4}
      />

      <SeasonLabels show={showLabels} />
      <MonthMarkers show={showLabels} />
      <OrbitInteraction />

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={15}
        target={[0, 0, 0]}
        makeDefault
      />
    </>
  );
}

/* =============================================
   Celestial Sphere Scene
   ============================================= */
function CelestialSphereScene() {
  const dayOfYear = useSimulationStore((s) => s.getDayOfYear());
  const showLabels = useSimulationStore((s) => s.showLabels);

  const orbitAngle = ((dayOfYear - 80) / 365.25) * Math.PI * 2;
  const sunDist = 3.5;
  const eclipticTilt = (23.44 * Math.PI) / 180;

  const sunX = Math.cos(orbitAngle + Math.PI) * sunDist;
  const sunZ = Math.sin(orbitAngle + Math.PI) * sunDist;
  const sunY = Math.sin(orbitAngle + Math.PI) * Math.sin(eclipticTilt) * sunDist;

  const eclipticPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(a) * sunDist,
        Math.sin(a) * Math.sin(eclipticTilt) * sunDist,
        Math.sin(a) * sunDist
      ));
    }
    return pts;
  }, []);

  const equatorPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * sunDist, 0, Math.sin(a) * sunDist));
    }
    return pts;
  }, []);

  return (
    <>
      <Stars radius={80} depth={60} count={4000} factor={3} saturation={0.3} fade speed={0.3} />
      <ambientLight intensity={0.05} />

      <EarthMesh position={[0, 0, 0]} tiltAngle={23.44} dayOfYear={dayOfYear} showSubsolar={false} size={0.4} />

      <Line points={equatorPoints} color="#64748b" lineWidth={1} opacity={0.4} transparent />
      <Line points={eclipticPoints} color="#22c55e" lineWidth={1.5} opacity={0.7} transparent />

      {/* Sun on ecliptic */}
      <group position={[sunX, sunY, sunZ]}>
        <mesh>
          <sphereGeometry args={[0.25, 32, 32]} />
          <meshBasicMaterial color="#fff5d4" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.2} />
        </mesh>
        <pointLight color="#fef3c7" intensity={2} distance={15} />
      </group>

      {showLabels && (
        <>
          <Html position={[sunDist + 0.5, 0, 0]}
            style={{ fontSize:'10px', color:'#64748b', pointerEvents:'none', userSelect:'none' }}>
            Ekuator Langit
          </Html>
          <Html position={[sunDist + 0.5, Math.sin(eclipticTilt) * sunDist * 0.3, 0]}
            style={{ fontSize:'10px', color:'#22c55e', pointerEvents:'none', userSelect:'none' }}>
            Ekliptika
          </Html>
        </>
      )}

      <Line points={[[0, -5, 0], [0, 5, 0]]} color="#475569" lineWidth={1} dashed dashSize={0.2} gapSize={0.1} />

      <OrbitControls enablePan={false} minDistance={3} maxDistance={15} makeDefault />
    </>
  );
}

/* =============================================
   Main OrbitView Component
   ============================================= */
export default function OrbitView() {
  const viewMode = useSimulationStore((s) => s.viewMode);
  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const showLabels = useSimulationStore((s) => s.showLabels);
  const setShowLabels = useSimulationStore((s) => s.setShowLabels);
  const rotateEarth = useSimulationStore((s) => s.rotateEarth);
  const setRotateEarth = useSimulationStore((s) => s.setRotateEarth);
  const declination = useSimulationStore((s) => s.getSunDeclination());
  const rightAscension = useSimulationStore((s) => s.getSunRightAscension());

  return (
    <div className="orbit-panel">
      <div className="orbit-panel__hint">
        {viewMode === 'orbit'
          ? 'klik & seret untuk mengubah perspektif · klik & seret bumi untuk mengubah posisi orbit'
          : 'klik & seret untuk mengubah perspektif'
        }
      </div>

      <Canvas
        className="canvas-3d"
        camera={{ position: [2, 5, 8], fov: 42, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        {viewMode === 'orbit' ? (
          <Suspense fallback={null}>
            <OrbitScene />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <CelestialSphereScene />
          </Suspense>
        )}
      </Canvas>

      {/* Data overlay — bottom center-left, above the controls */}
      <div style={{
        position: 'absolute', bottom: '90px', left: '180px', zIndex: 10,
        background: 'var(--bg-glass)', backdropFilter: 'blur(8px)',
        padding: '6px 14px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div className="orbit-panel__data-row">
          deklinasi matahari: <span>{declination.toFixed(1)}°</span>
        </div>
        <div className="orbit-panel__data-row">
          asensio rekta: <span>{rightAscension.toFixed(1)}j</span>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="view-toggle">
        <label className={`view-toggle__label ${viewMode === 'orbit' ? 'view-toggle__label--active' : ''}`}>
          <input type="radio" name="viewMode" checked={viewMode === 'orbit'} onChange={() => setViewMode('orbit')} />
          tampilan orbit
        </label>
        <label className={`view-toggle__label ${viewMode === 'celestial' ? 'view-toggle__label--active' : ''}`}>
          <input type="radio" name="viewMode" checked={viewMode === 'celestial'} onChange={() => setViewMode('celestial')} />
          bola langit
        </label>
      </div>

      {/* Rotasi Bumi checkbox */}
      <div className="checkbox-toggle" style={{ bottom: '70px' }}>
        <label className="checkbox-toggle__label">
          <input type="checkbox" checked={rotateEarth} onChange={(e) => setRotateEarth(e.target.checked)} />
          rotasi bumi
        </label>
      </div>

      {/* Labels toggle */}
      <div className="labels-toggle">
        <label className="checkbox-toggle__label">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          label
        </label>
      </div>
    </div>
  );
}
