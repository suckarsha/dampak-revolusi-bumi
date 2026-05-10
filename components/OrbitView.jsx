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
   Sun with realistic procedural texture (GLSL shader)
   ============================================= */

// Custom Sun shader with animated granulation + limb darkening
const sunVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  // Simple 3D noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    // Animated noise-based surface
    float t = uTime * 0.08;
    vec3 pos = vPosition * 3.0;
    
    // Multi-octave noise for granulation
    float n1 = snoise(pos + t * 0.3) * 0.5;
    float n2 = snoise(pos * 2.5 + t * 0.5) * 0.25;
    float n3 = snoise(pos * 5.0 + t * 0.2) * 0.125;
    float n4 = snoise(pos * 10.0 + t * 0.1) * 0.0625;
    float noise = n1 + n2 + n3 + n4;
    
    // Sunspot-like darker patches
    float spots = smoothstep(0.3, 0.6, snoise(pos * 1.5 - t * 0.1));
    
    // Limb darkening — edges appear darker
    float fresnel = dot(vNormal, vec3(0.0, 0.0, 1.0));
    float limb = pow(max(fresnel, 0.0), 0.5);
    
    // Base colors (photosphere)
    vec3 hotColor = vec3(1.0, 0.98, 0.85);   // White-yellow center
    vec3 midColor = vec3(1.0, 0.82, 0.35);   // Golden
    vec3 coolColor = vec3(0.95, 0.55, 0.15);  // Orange edge
    vec3 spotColor = vec3(0.7, 0.35, 0.08);   // Dark spots
    
    // Mix based on noise and limb
    vec3 surfaceColor = mix(midColor, hotColor, limb * 0.7 + noise * 0.3);
    surfaceColor = mix(surfaceColor, coolColor, (1.0 - limb) * 0.6);
    surfaceColor = mix(surfaceColor, spotColor, spots * 0.2 * (1.0 - limb * 0.5));
    
    // Bright granulation edges
    float granEdge = smoothstep(0.0, 0.15, abs(noise));
    surfaceColor += vec3(0.1, 0.08, 0.02) * granEdge * limb;
    
    // Final brightness with limb darkening
    surfaceColor *= (0.7 + 0.3 * limb);
    
    gl_FragColor = vec4(surfaceColor, 1.0);
  }
`;

function SunMesh() {
  const sunRef = useRef();
  const glowRef = useRef();
  const coronaRef = useRef();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.001;
    }
    if (glowRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.015;
      glowRef.current.scale.setScalar(scale);
    }
    if (coronaRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
      coronaRef.current.scale.setScalar(scale);
      coronaRef.current.rotation.z += 0.002;
    }
  });

  return (
    <group>
      {/* Core sun — procedural shader */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.5, 64, 64]} />
        <shaderMaterial
          vertexShader={sunVertexShader}
          fragmentShader={sunFragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      
      {/* Inner corona — warm glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.56, 64, 64]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.28} />
      </mesh>

      {/* Mid corona — pulsing */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[0.68, 48, 48]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.1} />
      </mesh>

      {/* Outer glow — atmosphere */}
      <mesh>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.04} />
      </mesh>

      {/* Extended glow */}
      <mesh>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.015} />
      </mesh>

      {/* Sun light */}
      <pointLight color="#fff5e6" intensity={15} distance={100} decay={0.5} />
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
            occlude
            zIndexRange={[0, 0]}
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
            center occlude zIndexRange={[0, 0]}
            style={{ fontSize:'9px', color:'#64748b', fontFamily:'Inter', fontWeight:500, pointerEvents:'none', userSelect:'none' }}>
            {name}
          </Html>
        );
      })}
    </>
  );
}

/* =============================================
   Zodiac Ring & Line of Sight
   ============================================= */
const ZODIACS = [
  { name: 'Aries', symbol: '♈', color: '#ef4444' },
  { name: 'Taurus', symbol: '♉', color: '#22c55e' },
  { name: 'Gemini', symbol: '♊', color: '#eab308' },
  { name: 'Cancer', symbol: '♋', color: '#3b82f6' },
  { name: 'Leo', symbol: '♌', color: '#ef4444' },
  { name: 'Virgo', symbol: '♍', color: '#22c55e' },
  { name: 'Libra', symbol: '♎', color: '#eab308' },
  { name: 'Scorpio', symbol: '♏', color: '#3b82f6' },
  { name: 'Sagittarius', symbol: '♐', color: '#ef4444' },
  { name: 'Capricorn', symbol: '♑', color: '#22c55e' },
  { name: 'Aquarius', symbol: '♒', color: '#eab308' },
  { name: 'Pisces', symbol: '♓', color: '#3b82f6' },
];

// Pola rasi bintang sederhana (koordinat x, y, z)
const CONSTELLATION_PATHS = [
  [[-1, 0.5, 0], [0, -0.5, 0], [1, 0.2, 0]], // Aries
  [[-1, 1, 0], [0, 0, 0], [1, 1, 0], [0, 0, 0], [0, -1, 0], [0.5, -0.5, 0]], // Taurus
  [[-0.5, 1, 0], [-0.5, -1, 0], [0, -0.8, 0], [0.5, -1, 0], [0.5, 1, 0], [0, 0.8, 0], [-0.5, 1, 0]], // Gemini
  [[-0.8, -0.8, 0], [0, 0, 0], [0.8, -0.5, 0], [0, 0, 0], [-0.2, 0.8, 0]], // Cancer
  [[-1, 0, 0], [-0.5, 0.8, 0], [0, 0.5, 0], [-0.2, 0, 0], [0.5, -0.5, 0], [1, 0, 0]], // Leo
  [[-1, 1, 0], [-0.5, 0, 0], [0.5, 0.5, 0], [1, -0.5, 0], [0.5, -1, 0], [0, 0, 0]], // Virgo
  [[-0.8, -0.5, 0], [0, 0.5, 0], [0.8, -0.5, 0], [0.5, -1, 0], [-0.5, -1, 0], [-0.8, -0.5, 0]], // Libra
  [[-1, 0.8, 0], [-0.5, 0, 0], [0, -0.5, 0], [0.8, -0.8, 0], [1.2, 0, 0], [0.8, 0.5, 0]], // Scorpio
  [[-1, -0.5, 0], [-0.5, 0.5, 0], [0, 0.8, 0], [0.8, 0, 0], [0, -0.8, 0], [-0.5, 0.5, 0], [-1, -0.5, 0]], // Sagittarius
  [[-1, 0.8, 0], [0, -0.8, 0], [1, 0.5, 0], [0.5, 0, 0], [0, -0.8, 0]], // Capricorn
  [[-1, 0, 0], [-0.5, 0.5, 0], [0, -0.5, 0], [0.5, 0.5, 0], [1, 0, 0]], // Aquarius
  [[-1, 0.8, 0], [-0.5, 0, 0], [0, -0.8, 0], [0.5, -0.2, 0], [1, 0.5, 0], [0.5, -0.2, 0], [0.8, -0.8, 0]] // Pisces
];

function ConstellationArt({ index, color }) {
  const points = CONSTELLATION_PATHS[index];
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      // Efek melayang pelan (floating)
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5 + index) * 0.15;
    }
  });

  return (
    <group ref={groupRef} scale={[0.8, 0.8, 0.8]} position={[0, 0.8, 0]}>
      {/* Garis penghubung rasi */}
      <Line points={points} color={color} lineWidth={1.5} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      
      {/* Bintang-bintang di tiap titik */}
      {points.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ZodiacRing({ show, radius = 12 }) {
  if (!show) return null;
  return (
    <group>
      {/* Sabuk Holografis Ekliptika */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 3, 64, 1, true]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      
      {/* Garis Pembatas Neon Atas & Bawah */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.5, 0]}>
        <ringGeometry args={[radius - 0.03, radius + 0.03, 64]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <ringGeometry args={[radius - 0.03, radius + 0.03, 64]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>

      {ZODIACS.map((z, i) => {
        const angle = Math.PI + (i * (Math.PI * 2)) / 12;
        const x = Math.cos(angle) * radius;
        const zPos = Math.sin(angle) * radius;
        
        // Memutar rasi bintang agar menghadap pusat (Matahari)
        const rotationY = -angle + Math.PI / 2;

        return (
          <group key={i} position={[x, 0, zPos]} rotation={[0, rotationY, 0]}>
            
            {/* Visual Bintang 3D */}
            <ConstellationArt index={i} color={z.color} />
            
            {/* Kartu Glassmorphism Holografis */}
            <Html center occlude={false} zIndexRange={[0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,27,75,0.7) 100%)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${z.color}70`,
                borderRadius: '16px',
                padding: '8px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: `0 8px 32px rgba(0,0,0,0.8), inset 0 0 20px ${z.color}30`,
                transform: 'translateY(-40px)',
              }}>
                <span style={{ fontSize: '22px', color: z.color, marginBottom: '4px', textShadow: `0 0 15px ${z.color}, 0 0 30px ${z.color}` }}>{z.symbol}</span>
                <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '3px', color: '#eef2ff', textTransform: 'uppercase' }}>{z.name}</span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function EnergyBeam({ start, end, color }) {
  const flowRef = useRef();
  
  useFrame((_, delta) => {
    if (flowRef.current?.material) {
      flowRef.current.material.dashOffset -= delta * 3;
    }
  });

  return (
    <group>
      {/* Cahaya Luar (Glow) */}
      <Line points={[start, end]} color={color} lineWidth={8} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
      {/* Inti Cahaya Padat */}
      <Line points={[start, end]} color="#ffffff" lineWidth={1} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      {/* Aliran Energi Bergerak */}
      <Line ref={flowRef} points={[start, end]} color={color} lineWidth={3} transparent dashed dashSize={0.4} gapSize={0.4} opacity={1} blending={THREE.AdditiveBlending} />
    </group>
  );
}

function LineOfSight({ show, earthPos }) {
  if (!show) return null;
  const radius = 12;
  const e2s = new THREE.Vector3(-earthPos[0], 0, -earthPos[2]).normalize();
  const dayLineEnd = e2s.clone().multiplyScalar(radius);
  const nightLineEnd = new THREE.Vector3(...earthPos).add(e2s.clone().multiplyScalar(-radius + 3.5));

  return (
    <group>
      <EnergyBeam start={earthPos} end={dayLineEnd.toArray()} color="#f59e0b" />
      <EnergyBeam start={earthPos} end={nightLineEnd.toArray()} color="#38bdf8" />
      
      {/* Label Malam */}
      <Html position={nightLineEnd.clone().lerp(new THREE.Vector3(...earthPos), 0.15).toArray()} center style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          background: 'linear-gradient(90deg, rgba(14,21,37,0) 0%, rgba(14,21,37,0.9) 20%, rgba(14,21,37,0.9) 80%, rgba(14,21,37,0) 100%)',
          padding: '8px 28px',
          color: '#38bdf8',
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          borderTop: '1px solid rgba(56, 189, 248, 0.6)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.6)',
          textShadow: '0 0 15px rgba(56, 189, 248, 1)'
        }}>
          ✨ Terlihat Jelas di Malam Hari
        </div>
      </Html>
      
      {/* Label Siang */}
      <Html position={dayLineEnd.clone().lerp(new THREE.Vector3(...earthPos), 0.15).toArray()} center style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>
        <div style={{
          background: 'linear-gradient(90deg, rgba(14,21,37,0) 0%, rgba(14,21,37,0.9) 20%, rgba(14,21,37,0.9) 80%, rgba(14,21,37,0) 100%)',
          padding: '8px 28px',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          borderTop: '1px solid rgba(245, 158, 11, 0.6)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.6)',
          textShadow: '0 0 15px rgba(245, 158, 11, 1)'
        }}>
          ☀️ Tertutup Cahaya Matahari
        </div>
      </Html>
    </group>
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
  const showConstellations = useSimulationStore((s) => s.showConstellations);

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

      {/* Sun-Earth connecting line */}
      <Line
        points={[[0, 0, 0], [earthX, 0, earthZ]]}
        color="#fbbf24"
        lineWidth={1}
        opacity={0.25}
        transparent
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />

      <EarthMesh
        position={[earthX, 0, earthZ]}
        tiltAngle={23.44}
        dayOfYear={dayOfYear}
        showSubsolar={showSubsolar}
        size={0.4}
      />

      <SeasonLabels show={showLabels} />
      <MonthMarkers show={showLabels} />
      <ZodiacRing show={showConstellations} />
      <LineOfSight show={showConstellations} earthPos={[earthX, 0, earthZ]} />
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
  const showConstellations = useSimulationStore((s) => s.showConstellations);
  const setShowConstellations = useSimulationStore((s) => s.setShowConstellations);
  const rotateEarth = useSimulationStore((s) => s.rotateEarth);
  const setRotateEarth = useSimulationStore((s) => s.setRotateEarth);
  const month = useSimulationStore((s) => s.month);
  const day = useSimulationStore((s) => s.day);
  const declination = useSimulationStore((s) => s.getSunDeclination());
  const rightAscension = useSimulationStore((s) => s.getSunRightAscension());
  const getSeasonInfo = useSimulationStore((s) => s.getSeasonInfo);
  const seasonInfo = useMemo(() => getSeasonInfo(), [month, day]);
  const canvasContainerRef = useRef(null);

  const handleFullscreen = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleScreenshot = useCallback(() => {
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    // Need to re-render with preserveDrawingBuffer
    const link = document.createElement('a');
    link.download = `simulasi-musim-${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <div className="orbit-panel" ref={canvasContainerRef}>
      <div className="orbit-panel__hint">
        {viewMode === 'orbit'
          ? 'klik & seret untuk mengubah perspektif · klik & seret bumi untuk mengubah posisi orbit'
          : 'klik & seret untuk mengubah perspektif'
        }
      </div>

      <Canvas
        className="canvas-3d"
        camera={{ position: [2, 5, 8], fov: 42, near: 0.1, far: 200 }}
        gl={{
          antialias: true, alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
          preserveDrawingBuffer: true,
        }}
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

      {/* Season info badge — top right */}
      <div className="orbit-panel__season-badge">
        <span>{seasonInfo.iconN} Utara: {seasonInfo.north}</span>
        <span>{seasonInfo.iconS} Selatan: {seasonInfo.south}</span>
      </div>

      {/* Data overlay — top left */}
      <div style={{
        position: 'absolute', top: 'var(--space-lg)', left: 'var(--space-lg)', zIndex: 10,
        background: 'var(--bg-glass-strong)', backdropFilter: 'blur(16px)',
        padding: '10px 18px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex', flexDirection: 'column', gap: '4px'
      }}>
        <div className="orbit-panel__data-row">
          deklinasi matahari: <span>{declination.toFixed(1)}°</span>
        </div>
        <div className="orbit-panel__data-row">
          asensio rekta: <span>{rightAscension.toFixed(1)}j</span>
        </div>
      </div>

      {/* Action buttons — top right corner */}
      <div className="orbit-panel__actions">
        <button className="orbit-panel__action-btn" onClick={handleScreenshot} title="Screenshot">
          📸
        </button>
        <button className="orbit-panel__action-btn" onClick={handleFullscreen} title="Fullscreen">
          ⛶
        </button>
      </div>

      {/* Unified controls panel — bottom left */}
      <div className="orbit-panel__controls-card">
        <label className="orbit-panel__control-row" style={{ gap: '10px' }}>
          <div className="toggle-switch">
            <input type="checkbox" checked={rotateEarth} onChange={(e) => setRotateEarth(e.target.checked)} />
            <span className="toggle-slider"></span>
          </div>
          rotasi bumi
        </label>
        <div className="orbit-panel__control-divider" />
        <label className={`orbit-panel__control-row ${viewMode === 'orbit' ? 'orbit-panel__control-row--active' : ''}`}>
          <input type="radio" name="viewMode" checked={viewMode === 'orbit'} onChange={() => setViewMode('orbit')} />
          tampilan orbit
        </label>
        <label className={`orbit-panel__control-row ${viewMode === 'celestial' ? 'orbit-panel__control-row--active' : ''}`}>
          <input type="radio" name="viewMode" checked={viewMode === 'celestial'} onChange={() => setViewMode('celestial')} />
          bola langit
        </label>
      </div>

      {/* Labels toggle — bottom right */}
      <div className="labels-toggle" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="orbit-panel__control-row" style={{ gap: '10px' }}>
          <div className="toggle-switch">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            <span className="toggle-slider"></span>
          </div>
          label orbit
        </label>
        <label className="orbit-panel__control-row" style={{ gap: '10px' }}>
          <div className="toggle-switch">
            <input type="checkbox" checked={showConstellations} onChange={(e) => setShowConstellations(e.target.checked)} />
            <span className="toggle-slider"></span>
          </div>
          rasi bintang
        </label>
      </div>
    </div>
  );
}
