import { useRef, useMemo, useState, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import logoSvg from "../assets/logo.svg";
import earthColorUrl from "../assets/earth_8k.jpg";
import earthBumpUrl from "../assets/earth_bump.png";
import earthSpecularUrl from "../assets/earth_specular.png";
import earthCloudsUrl from "../assets/earth_clouds.png";

function Earth() {
  const ref = useRef<THREE.Mesh>(null!);
  const [color, bump, specular] = useLoader(THREE.TextureLoader, [
    earthColorUrl,
    earthBumpUrl,
    earthSpecularUrl,
  ]);

  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 16;
  color.minFilter = THREE.LinearMipmapLinearFilter;
  color.magFilter = THREE.LinearFilter;

  const initRotation = useMemo(() => (-113.5 + 90) * (Math.PI / 180), []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.06;
  });

  return (
    <mesh ref={ref} rotation={[0.15, initRotation, 0]}>
      <sphereGeometry args={[2.2, 64, 64]} />
      <meshPhongMaterial
        map={color}
        bumpMap={bump}
        bumpScale={0.8}
        specularMap={specular}
        specular={new THREE.Color(0x222222)}
        shininess={10}
      />
    </mesh>
  );
}

function Clouds() {
  const ref = useRef<THREE.Mesh>(null!);
  const cloudTex = useLoader(THREE.TextureLoader, earthCloudsUrl);
  cloudTex.anisotropy = 16;

  const initRotation = useMemo(() => (-113.5 + 90) * (Math.PI / 180), []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.08;
  });

  return (
    <mesh ref={ref} rotation={[0.15, initRotation, 0]}>
      <sphereGeometry args={[2.22, 48, 48]} />
      <meshBasicMaterial
        map={cloudTex}
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </mesh>
  );
}

function AtmosphereGlow() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float i = pow(0.65 - dot(vNormal, vec3(0,0,1)), 4.0);
        gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * i, i * 0.8);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  }), []);

  return (
    <mesh scale={[1.15, 1.15, 1.15]} material={mat}>
      <sphereGeometry args={[2.2, 32, 32]} />
    </mesh>
  );
}

function GlobeScene() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={2.0} />
      <directionalLight position={[-3, -1, -3]} intensity={0.1} color="#4488cc" />
      <Suspense fallback={null}>
        <Earth />
        <Clouds />
        <AtmosphereGlow />
      </Suspense>
    </>
  );
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

function FlowDiagram() {
  return (
    <div className="ld-flow">
      {/* Row 1: Data sources */}
      <div className="ld-flow-label-row">Data Sources</div>
      <div className="ld-flow-sources">
        <div className="ld-flow-node ld-flow-src">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>
          <span>Edmonton Open Data</span>
          <small>data.edmonton.ca</small>
          <small>Properties, permits, drainage, air quality</small>
        </div>
        <div className="ld-flow-node ld-flow-src">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25"/><path d="M8 16l-2.3 2.3M12 12l-2.3 2.3"/></svg>
          <span>Environment Canada</span>
          <small>api.weather.gc.ca</small>
          <small>Precipitation, climate stations, river flow</small>
        </div>
        <div className="ld-flow-node ld-flow-src">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
          <span>OpenStreetMap / CARTO</span>
          <small>Basemap tiles</small>
          <small>Dark, light, satellite, terrain views</small>
        </div>
      </div>

      {/* Arrows down */}
      <div className="ld-flow-vline" />
      <div className="ld-flow-label-row">REST API / Fetch</div>
      <div className="ld-flow-vline" />

      {/* Row 2: Frontend stack */}
      <div className="ld-flow-label-row">Frontend</div>
      <div className="ld-flow-sources">
        <div className="ld-flow-node">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          <span>React + TypeScript</span>
          <small>Vite, component architecture</small>
        </div>
        <div className="ld-flow-node">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          <span>Leaflet.js</span>
          <small>Interactive mapping, GeoJSON layers</small>
        </div>
        <div className="ld-flow-node">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/></svg>
          <span>Recharts</span>
          <small>Precipitation &amp; flow charts</small>
        </div>
        <div className="ld-flow-node">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          <span>Three.js</span>
          <small>3D globe, landing page</small>
        </div>
      </div>

      {/* Arrows down */}
      <div className="ld-flow-vline" />
      <div className="ld-flow-label-row">Analysis Engine</div>
      <div className="ld-flow-vline" />

      {/* Row 3: Output */}
      <div className="ld-flow-sources">
        <div className="ld-flow-node ld-flow-out">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
          <span>Flood Risk Mapping</span>
          <small>100yr, 200yr, 500yr zones</small>
        </div>
        <div className="ld-flow-node ld-flow-out">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2 3 2 4.5 2 3-.5 4.5-2"/><path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2 3 2 4.5 2 3-.5 4.5-2"/></svg>
          <span>Drainage Design</span>
          <small>Rational Method, SCS, IDF</small>
        </div>
        <div className="ld-flow-node ld-flow-out">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <span>Cost Estimation</span>
          <small>Pipes, catch basins, LID</small>
        </div>
        <div className="ld-flow-node ld-flow-out">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25"/><path d="M12 12v6"/><path d="M8 16h8"/></svg>
          <span>Storm Simulation</span>
          <small>Runoff, infiltration, water balance</small>
        </div>
      </div>
    </div>
  );
}

const MEMBERS = [
  "Md Sadat Hossain",
  "Muhammed Ahmedtanov",
  "Kai Renschler",
];

interface Props {
  onLaunch: () => void;
}

export default function LandingPage({ onLaunch }: Props) {
  const [hovering, setHovering] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [heroHidden, setHeroHidden] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const teamReveal = useReveal();
  const howReveal = useReveal();
  const flowReveal = useReveal();

  const handleLaunch = useCallback(() => {
    setLaunching(true);
    setTimeout(onLaunch, 800);
  }, [onLaunch]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroHidden(!entry.isIntersecting),
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className={`landing-scroll ${launching ? "landing-exit" : ""}`} ref={scrollRef}>
      {/* ── Section 1: Hero ── */}
      <section className="landing-section landing-hero" ref={heroRef}>
        <div className="landing-globe">
          {!heroHidden && (
            <Canvas
              camera={{ position: [0, 0, 5.5], fov: 45 }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.85, powerPreference: "high-performance" }}
              style={{ background: "transparent" }}
            >
              <GlobeScene />
            </Canvas>
          )}
        </div>

        <div className="landing-content">
          <img src={logoSvg} alt="" className="landing-logo" />
          <h1 className="landing-title">
            HYDRO<span className="landing-title-accent">GRID</span>
          </h1>
          <p className="landing-sub">
            Real-Time Hydrology &amp; Infrastructure Analysis
          </p>

          <button
            className={`landing-btn ${hovering ? "landing-btn-hover" : ""}`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onClick={handleLaunch}
          >
            <span className="landing-btn-text">Launch Platform</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          <div className="landing-tags">
            <span>Flood Hazard</span>
            <span>Drainage Design</span>
            <span>Storm Simulation</span>
            <span>Cost Analysis</span>
            <span>Property Lookup</span>
          </div>
        </div>

        <div className="landing-scroll-hint">
          <span>Scroll to explore</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* ── Section 2: Team ── */}
      <section className="landing-section landing-team">
        <div className={`ld-reveal ${teamReveal.visible ? "ld-visible" : ""}`} ref={teamReveal.ref}>
          <p className="ld-label">HackED 2026 &middot; University of Alberta</p>
          <h2 className="ld-heading">Team <span className="landing-title-accent">Redacted</span></h2>
          <p className="ld-desc">
            Civil &amp; Environmental Engineering students building data-driven tools for urban resilience.
          </p>
          <div className="ld-members">
            {MEMBERS.map((name) => (
              <div className="ld-member" key={name}>
                <div className="ld-member-avatar">
                  {name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div className="ld-member-name">{name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ── */}
      <section className="landing-section landing-how">
        <div className={`ld-reveal ${howReveal.visible ? "ld-visible" : ""}`} ref={howReveal.ref}>
          <p className="ld-label">The Platform</p>
          <h2 className="ld-heading">How It <span className="landing-title-accent">Works</span></h2>
          <div className="ld-how-grid">
            <div className="ld-how-card">
              <div className="ld-how-num">01</div>
              <h3>Ingest Open Data</h3>
              <p>Live REST calls to <strong>data.edmonton.ca</strong> (properties, permits, drainage, air quality) and <strong>Environment Canada</strong> (precipitation stations, climate normals, hydrometric river gauges). Map tiles served via OpenStreetMap, CARTO, and Esri.</p>
            </div>
            <div className="ld-how-card">
              <div className="ld-how-num">02</div>
              <h3>Analyze &amp; Model</h3>
              <p>Client-side hydrology engine applies the <strong>Rational Method</strong>, <strong>SCS curve-number</strong> runoff, <strong>IDF curves</strong>, and unit-cost models. Property lookups cross-reference assessment data, zoning, lot geometry, and nearby facilities.</p>
            </div>
            <div className="ld-how-card">
              <div className="ld-how-num">03</div>
              <h3>Visualize &amp; Decide</h3>
              <p>Results render on a <strong>Leaflet.js</strong> interactive map with toggleable GeoJSON layers (flood zones, drainage, infrastructure). <strong>Recharts</strong> powers precipitation/flow timeseries. All in-browser, no backend needed.</p>
            </div>
          </div>
        </div>

        <div className={`ld-reveal ld-reveal-delay ${flowReveal.visible ? "ld-visible" : ""}`} ref={flowReveal.ref}>
          <h3 className="ld-flow-title">Architecture</h3>
          <FlowDiagram />
        </div>

        <div className="landing-footer-inline">
          <span>HackED 2026</span>
          <span>&middot;</span>
          <span>University of Alberta</span>
        </div>
      </section>
    </div>
  );
}
