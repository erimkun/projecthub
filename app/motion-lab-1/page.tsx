'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { useAppStore } from '@/lib/store';
import Topbar from '@/components/Topbar';
import Sidebar from '@/components/Sidebar';
import PersonalDashboard from '@/components/PersonalDashboard';
import NotesEditor from '@/components/NotesEditor';
import TeamRadar from '@/components/TeamRadar';
import SOSPanel from '@/components/SOSPanel';
import RolloverBanner from '@/components/RolloverBanner';
import styles from './page.module.css';

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildParticleText(
  text: string | string[],
  width: number,
  height: number,
  sampleStep: number,
  scale = 0.0036
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [] as Array<{ x: number; y: number }>;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = Array.isArray(text) ? text : [text];
  const fontSize = Math.floor(height * (lines.length > 1 ? 0.16 : 0.2));
  const lineHeight = fontSize * 1.08;
  const startY = height * 0.46 - ((lines.length - 1) * lineHeight) / 2;
  ctx.font = `900 ${fontSize}px Arial`;
  lines.forEach((line, idx) => {
    ctx.fillText(line, width * 0.5, startY + idx * lineHeight);
  });

  const image = ctx.getImageData(0, 0, width, height).data;
  const points: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      const alpha = image[i + 3];
      if (alpha < 120) continue;
      const px = (x - width * 0.5) * scale;
      const py = (height * 0.5 - y) * scale + 1.55;
      points.push({ x: px, y: py });
    }
  }

  return points;
}

function MotionLabOneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isJustLoggedIn = searchParams.get('login') === '1';
  const { view, fetchAll, triggerAutoRollover, tasks, setCurrentMemberId } = useAppStore();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const appSectionRef = useRef<HTMLElement>(null);
  const stickyViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAutoScrollingRef = useRef(false);
  const hasAutoNavigatedRef = useRef(false);
  const downWheelCountRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (!isMobile) return;

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (isStandalone) return;

    const storageKey = 'ph_pwa_install_alert_seen_v1';
    if (window.localStorage.getItem(storageKey)) return;

    const timer = window.setTimeout(() => {
      window.alert('Bu uygulamayi ana ekrana ekleyerek PWA gibi kullanabilirsin. Tarayici menusu > "Ana ekrana ekle" adimini kullan.');
      window.localStorage.setItem(storageKey, '1');
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.push('/login');
          return;
        }
        if (d.user.memberId) setCurrentMemberId(d.user.memberId);
        fetchAll().then(() => triggerAutoRollover());

        // Auto scroll handling for new logins
        if (isJustLoggedIn) {
          setTimeout(() => {
            if (rootRef.current && appSectionRef.current) {
              isAutoScrollingRef.current = true;
              rootRef.current.scrollTo({
                top: appSectionRef.current.offsetTop,
                behavior: 'smooth'
              });
              // Clean up URL
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              
              setTimeout(() => {
                isAutoScrollingRef.current = false;
              }, 1200);
            }
          }, 2400); // Wait 2.4s to show off the 3D scene
        }
      })
      .catch(() => router.push('/login'));
  }, [fetchAll, router, setCurrentMemberId, triggerAutoRollover, isJustLoggedIn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!canvas || !stage || !root) return;

    const isMobileViewport = window.matchMedia('(max-width: 900px)').matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070d, 0.09);

    const camera = new THREE.PerspectiveCamera(isMobileViewport ? 54 : 48, 1, 0.1, 1000);
    camera.position.set(0, 0.95, isMobileViewport ? 6.2 : 4.8);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x03070f, 1);

    const ambient = new THREE.AmbientLight(0x7d8ec4, 0.42);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xd5e6ff, 0.92);
    keyLight.position.set(2.4, 3.2, 4.2);
    scene.add(keyLight);

    const rim = new THREE.PointLight(0x67b8ff, 1.6, 14, 2);
    rim.position.set(-2.6, 1.2, -4.6);
    scene.add(rim);

    const warm = new THREE.PointLight(0xffd3a1, 0.9, 10, 2.5);
    warm.position.set(2.8, -0.8, 0.4);
    scene.add(warm);

    const cloudGroup = new THREE.Group();
    scene.add(cloudGroup);

    const textPoints = buildParticleText(
      isMobileViewport ? ['KENTAŞ TECH', 'VE ARGE'] : 'KENTAŞ TECH VE ARGE',
      1800,
      520,
      isMobileViewport ? 10 : 6,
      isMobileViewport ? 0.0032 : 0.0036
    );

    const textCount = textPoints.length;
    const textPos = new Float32Array(textCount * 3);
    const textBase = new Float32Array(textCount * 3);
    const textCol = new Float32Array(textCount * 3);
    const textVel = new Float32Array(textCount * 3);

    for (let i = 0; i < textCount; i++) {
      const idx = i * 3;
      const baseX = textPoints[i].x;
      const baseY = textPoints[i].y;
      const baseZ = -1.55 + rand(-0.05, 0.05);

      textBase[idx] = baseX;
      textBase[idx + 1] = baseY;
      textBase[idx + 2] = baseZ;

      textPos[idx] = baseX + rand(-0.18, 0.18);
      textPos[idx + 1] = baseY + rand(-0.18, 0.18);
      textPos[idx + 2] = baseZ + rand(-0.08, 0.08);

      const c = new THREE.Color().setHSL(0.56 + rand(-0.05, 0.05), 0.9, 0.72 + rand(-0.06, 0.04));
      textCol[idx] = c.r;
      textCol[idx + 1] = c.g;
      textCol[idx + 2] = c.b;
    }

    const textGeo = new THREE.BufferGeometry();
    textGeo.setAttribute('position', new THREE.BufferAttribute(textPos, 3));
    textGeo.setAttribute('color', new THREE.BufferAttribute(textCol, 3));

    const textMat = new THREE.PointsMaterial({
      size: isMobileViewport ? 0.03 : 0.022,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const textCloud = new THREE.Points(textGeo, textMat);
    scene.add(textCloud);

    const halfW = 4.2;
    const halfH = 2.5;
    const roomDepth = 8.4;
    const density = isMobileViewport ? 0.65 : 1;
    const m = (n: number) => Math.max(1, Math.floor(n * density));

    const positions: number[] = [];
    const basePositions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const lifts: number[] = [];
    const phases: number[] = [];
    const blastDirs: number[] = [];

    const pushPoint = (x: number, y: number, z: number, color: THREE.Color, size: number, lift = 1) => {
      positions.push(x, y, z);
      basePositions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      sizes.push(size);
      lifts.push(lift);
      phases.push(Math.random() * Math.PI * 2);

      const v = new THREE.Vector3(x + rand(-0.25, 0.25), y + rand(-0.25, 0.25), z + rand(-0.25, 0.25)).normalize();
      const blastPower = 0.8 + lift * 0.9 + Math.random() * 0.9;
      blastDirs.push(v.x * blastPower, v.y * blastPower, v.z * blastPower);
    };

    const addDesk = (cx: number, cz: number, w: number, d: number, topY: number, color: THREE.Color) => {
      for (let i = 0; i < m(1900); i++) {
        pushPoint(rand(cx - w / 2, cx + w / 2), topY + rand(-0.025, 0.025), rand(cz - d / 2, cz + d / 2), color, rand(2.6, 8.2), rand(0.9, 2.1));
      }

      const legOffsets = [
        [-w / 2 + 0.08, -d / 2 + 0.08],
        [w / 2 - 0.08, -d / 2 + 0.08],
        [-w / 2 + 0.08, d / 2 - 0.08],
        [w / 2 - 0.08, d / 2 - 0.08],
      ];
      for (const [ox, oz] of legOffsets) {
        for (let i = 0; i < m(220); i++) {
          pushPoint(cx + ox + rand(-0.015, 0.015), rand(-1.45, topY - 0.03), cz + oz + rand(-0.015, 0.015), color, rand(2.2, 6), rand(0.7, 1.6));
        }
      }
    };

    const addMonitor = (cx: number, cy: number, cz: number, w: number, h: number, color: THREE.Color) => {
      for (let i = 0; i < m(1400); i++) {
        const edge = Math.random();
        let x = rand(cx - w / 2, cx + w / 2);
        let y = rand(cy - h / 2, cy + h / 2);
        if (edge < 0.25) x = cx - w / 2 + rand(-0.01, 0.01);
        else if (edge < 0.5) x = cx + w / 2 + rand(-0.01, 0.01);
        else if (edge < 0.75) y = cy - h / 2 + rand(-0.01, 0.01);
        else y = cy + h / 2 + rand(-0.01, 0.01);
        pushPoint(x, y, cz + rand(-0.02, 0.02), color, rand(2.5, 7.8), rand(1.1, 2.4));
      }

      for (let i = 0; i < m(950); i++) {
        const screenColor = new THREE.Color().setHSL(0.56 + rand(-0.04, 0.05), 0.76, 0.62 + rand(-0.08, 0.08));
        pushPoint(rand(cx - w * 0.42, cx + w * 0.42), rand(cy - h * 0.4, cy + h * 0.4), cz + rand(-0.012, 0.012), screenColor, rand(2.4, 6.8), rand(1.2, 2.7));
      }

      for (let i = 0; i < m(220); i++) {
        pushPoint(cx + rand(-0.04, 0.04), rand(cy - h * 0.7, cy - h * 0.5), cz + rand(-0.01, 0.01), color, rand(2.2, 5.8), rand(0.8, 1.8));
      }
    };

    const addLinePanel = (x0: number, y0: number, z0: number, w: number, h: number) => {
      const panelBase = new THREE.Color(0x6f83a7);
      for (let i = 0; i < m(1100); i++) {
        pushPoint(rand(x0 - w / 2, x0 + w / 2), rand(y0 - h / 2, y0 + h / 2), z0 + rand(-0.02, 0.02), panelBase, rand(2.1, 6.2), rand(0.8, 1.8));
      }

      const lineColor = new THREE.Color(0xc2d7ff);
      const rows = 7;
      const cols = 5;
      for (let r = 0; r <= rows; r++) {
        const y = y0 - h / 2 + (h * r) / rows;
        for (let i = 0; i < m(150); i++) {
          pushPoint(rand(x0 - w / 2, x0 + w / 2), y + rand(-0.008, 0.008), z0 + rand(-0.012, 0.012), lineColor, rand(2.1, 5.8), rand(1, 2));
        }
      }
      for (let c = 0; c <= cols; c++) {
        const x = x0 - w / 2 + (w * c) / cols;
        for (let i = 0; i < m(130); i++) {
          pushPoint(x + rand(-0.008, 0.008), rand(y0 - h / 2, y0 + h / 2), z0 + rand(-0.012, 0.012), lineColor, rand(2.1, 5.6), rand(1, 2));
        }
      }
    };

    const addPieChart = (cx: number, cy: number, z: number, radius: number) => {
      const segs = [0.2, 0.16, 0.23, 0.11, 0.14, 0.16];
      let acc = -Math.PI * 0.5;
      segs.forEach((ratio, idx) => {
        const start = acc;
        const end = acc + Math.PI * 2 * ratio;
        acc = end;
        const c = new THREE.Color().setHSL(0.52 + idx * 0.08, 0.82, 0.66);

        for (let i = 0; i < m(420); i++) {
          const a = rand(start, end);
          const rr = rand(radius * 0.08, radius);
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          pushPoint(x, y, z + rand(-0.012, 0.012), c, rand(2.2, 7), rand(1, 2.2));
        }
      });

      const ring = new THREE.Color(0xe2efff);
      for (let i = 0; i < m(500); i++) {
        const a = rand(0, Math.PI * 2);
        const rr = radius + rand(-0.012, 0.012);
        pushPoint(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z + rand(-0.01, 0.01), ring, rand(2, 5.4), rand(1, 2.2));
      }
    };

    const floorColor = new THREE.Color(0x6f7d92);
    for (let i = 0; i < m(3600); i++) {
      pushPoint(rand(-halfW, halfW), -halfH + rand(-0.03, 0.03), rand(-roomDepth, roomDepth), floorColor, rand(3, 8), rand(0.5, 1.3));
    }

    const ceilingColor = new THREE.Color(0x5a667e);
    for (let i = 0; i < m(2300); i++) {
      pushPoint(rand(-halfW, halfW), halfH + rand(-0.03, 0.03), rand(-roomDepth, roomDepth), ceilingColor, rand(2.2, 6.8), rand(0.5, 1.1));
    }

    const wallColorA = new THREE.Color(0x61718f);
    const wallColorB = new THREE.Color(0x53627f);
    for (let i = 0; i < m(2300); i++) {
      pushPoint(-halfW + rand(-0.03, 0.03), rand(-halfH, halfH), rand(-roomDepth, roomDepth), wallColorA, rand(2.2, 7.4), rand(0.6, 1.4));
      pushPoint(halfW + rand(-0.03, 0.03), rand(-halfH, halfH), rand(-roomDepth, roomDepth), wallColorB, rand(2.2, 7.4), rand(0.6, 1.4));
    }

    const backColor = new THREE.Color(0x4a5873);
    for (let i = 0; i < m(2200); i++) {
      pushPoint(rand(-halfW, halfW), rand(-halfH, halfH), -roomDepth + rand(-0.03, 0.03), backColor, rand(2.4, 7), rand(0.7, 1.5));
    }

    const frontColor = new THREE.Color(0x7a8ca8);
    for (let i = 0; i < m(1300); i++) {
      pushPoint(rand(-halfW, halfW), rand(-halfH, halfH), roomDepth + rand(-0.03, 0.03), frontColor, rand(2.4, 6.4), rand(0.6, 1.2));
    }

    const deskColor = new THREE.Color(0xa5b4cc);
    addDesk(1.8, -0.9, 2.1, 1.1, -0.65, deskColor);
    addDesk(-1.6, -1.4, 1.9, 1.05, -0.7, deskColor);
    addDesk(0.15, -3.1, 2.3, 1.15, -0.68, deskColor);

    const monitorFrame = new THREE.Color(0xdde7f8);
    addMonitor(1.52, 0.08, -0.72, 0.9, 0.56, monitorFrame);
    addMonitor(-1.86, 0.03, -1.2, 0.82, 0.5, monitorFrame);
    addMonitor(0.0, 0.02, -2.9, 1.1, 0.62, monitorFrame);

    const humanSilhouette = new THREE.Color(0xd4e5ff);
    for (let i = 0; i < m(1100); i++) {
      const bodyY = rand(-1.15, 1.05);
      const bodyX = rand(-0.35, 0.35);
      const bodyZ = rand(-1.6, -0.6);
      pushPoint(bodyX, bodyY, bodyZ, humanSilhouette, rand(2.6, 8.8), rand(1.1, 2.6));
    }

    const lampColor = new THREE.Color(0xffe8c8);
    for (let i = 0; i < m(500); i++) {
      pushPoint(rand(-2.8, -1.5), rand(0.4, 1.6), rand(-2.4, -0.8), lampColor, rand(3.2, 9), rand(1.4, 2.8));
    }

    addPieChart(-2.45, 0.72, -roomDepth + 0.08, 0.92);
    addLinePanel(2.28, 0.8, -roomDepth + 0.08, 2.0, 1.2);
    addLinePanel(2.5, -0.65, -roomDepth + 0.08, 1.55, 0.74);

    const totalPoints = positions.length / 3;
    const pos = new Float32Array(positions);
    const base = new Float32Array(basePositions);
    const col = new Float32Array(colors);
    const sizeAttr = new Float32Array(sizes);
    const liftAttr = new Float32Array(lifts);
    const phaseAttr = new Float32Array(phases);

    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cloudGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    cloudGeo.setAttribute('aSize', new THREE.BufferAttribute(sizeAttr, 1));

    const cloudMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uScale: { value: 1 },
        uGlow: { value: 0.9 },
        uAlpha: { value: 1 },
      },
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uScale;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (uScale * 7.0 / max(0.2, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float uGlow;
        uniform float uAlpha;

        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = dot(c, c);
          float alpha = exp(-d * 8.0) * uGlow * uAlpha;
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });

    const cloud = new THREE.Points(cloudGeo, cloudMat);
    cloudGroup.add(cloud);

    const starCount = 2200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      const radius = 18 + Math.random() * 28;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[idx] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[idx + 1] = radius * Math.cos(phi);
      starPos[idx + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({
      size: 0.07,
      color: 0x90b7ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    const swarmCount = 12;
    const pointsPerSwarm = m(320);
    const swarmPoints = swarmCount * pointsPerSwarm;
    const swarmSeeds = new Float32Array(swarmCount);
    const swarmAmp = new Float32Array(swarmCount);
    const swarmSpeed = new Float32Array(swarmCount);

    const swarmPos = new Float32Array(swarmPoints * 3);
    const swarmBase = new Float32Array(swarmPoints * 3);
    const swarmCol = new Float32Array(swarmPoints * 3);
    const swarmScreenIdx = new Uint16Array(swarmPoints);
    const swarmPulse = new Float32Array(swarmPoints);

    for (let s = 0; s < swarmCount; s++) {
      swarmSeeds[s] = rand(0, Math.PI * 2);
      swarmAmp[s] = rand(1.1, 3.1);
      swarmSpeed[s] = rand(0.35, 0.92);

      for (let p = 0; p < pointsPerSwarm; p++) {
        const i = s * pointsPerSwarm + p;
        const idx = i * 3;
        const edge = Math.random();
        let lx = rand(-0.46, 0.46);
        let ly = rand(-0.28, 0.28);
        if (edge < 0.24) lx = -0.52 + rand(-0.02, 0.02);
        else if (edge < 0.48) lx = 0.52 + rand(-0.02, 0.02);
        else if (edge < 0.72) ly = -0.32 + rand(-0.02, 0.02);
        else if (edge < 0.96) ly = 0.32 + rand(-0.02, 0.02);

        if (Math.random() > 0.58) {
          lx = rand(-0.38, 0.38);
          ly = rand(-0.22, 0.22);
        }

        const lz = rand(-0.03, 0.03);
        swarmBase[idx] = lx;
        swarmBase[idx + 1] = ly;
        swarmBase[idx + 2] = lz;
        swarmPos[idx] = lx;
        swarmPos[idx + 1] = ly;
        swarmPos[idx + 2] = lz;

        const c = new THREE.Color().setHSL(0.56 + rand(-0.1, 0.12), 0.86, 0.62 + rand(-0.08, 0.08));
        swarmCol[idx] = c.r;
        swarmCol[idx + 1] = c.g;
        swarmCol[idx + 2] = c.b;
        swarmScreenIdx[i] = s;
        swarmPulse[i] = rand(0, Math.PI * 2);
      }
    }

    const swarmGeo = new THREE.BufferGeometry();
    swarmGeo.setAttribute('position', new THREE.BufferAttribute(swarmPos, 3));
    swarmGeo.setAttribute('color', new THREE.BufferAttribute(swarmCol, 3));

    const swarmMat = new THREE.PointsMaterial({
      size: 0.052,
      transparent: true,
      opacity: 0.84,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const swarmCloud = new THREE.Points(swarmGeo, swarmMat);
    scene.add(swarmCloud);

    const sparkleCount = 1400;
    const sparklePos = new Float32Array(sparkleCount * 3);
    const sparkleCol = new Float32Array(sparkleCount * 3);
    const sparkleSeeds = new Float32Array(sparkleCount);
    const sparkleLift = new Float32Array(sparkleCount);
    const sparkleBase = new Float32Array(sparkleCount * 3);

    for (let i = 0; i < sparkleCount; i++) {
      const idx = i * 3;
      const x = rand(-3.2, 3.2);
      const y = rand(-1.15, 1.2);
      const z = rand(-5.2, -0.6);
      sparklePos[idx] = x;
      sparklePos[idx + 1] = y;
      sparklePos[idx + 2] = z;
      sparkleBase[idx] = x;
      sparkleBase[idx + 1] = y;
      sparkleBase[idx + 2] = z;
      const c = new THREE.Color().setHSL(rand(0.5, 0.98), 0.82, rand(0.56, 0.72));
      sparkleCol[idx] = c.r;
      sparkleCol[idx + 1] = c.g;
      sparkleCol[idx + 2] = c.b;
      sparkleSeeds[i] = rand(0, Math.PI * 2);
      sparkleLift[i] = rand(0.6, 2.2);
    }

    const sparkleGeo = new THREE.BufferGeometry();
    sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
    sparkleGeo.setAttribute('color', new THREE.BufferAttribute(sparkleCol, 3));

    const sparkleMat = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      opacity: 0.85,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
    scene.add(sparkles);

    const mouseWorld = new THREE.Vector3();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    let raf = 0;
    const animate = () => {
      const t = performance.now() * 0.001;
      const stageRect = stage.getBoundingClientRect();
      const travel = Math.max(1, stage.offsetHeight - window.innerHeight);
      const scrolled = Math.min(Math.max(-stageRect.top, 0), travel);
      const progress = scrolled / travel;

      const zoomIn = Math.min(progress / 0.54, 1);
      const chaos = Math.min(Math.max((progress - 0.54) / 0.42, 0), 1);
      const explode = Math.min(Math.max((progress - 0.985) / 0.015, 0), 1);
      const explodeEase = explode * explode;
      const nextOpacity = Math.min(Math.max((progress - 0.5) / 0.35, 0), 1);
      const stageOpacity = Math.max(0, 1 - nextOpacity * 1.15);
      const sceneDone = progress > 0.992;

      const hue = 0.5 + (mouseRef.current.x * 0.25 - 0.12);
      mouseWorld.set((mouseRef.current.x - 0.5) * 6, (0.5 - mouseRef.current.y) * 2.8 - 0.15, -2.4 - zoomIn * 1.5);
      const mood = new THREE.Color().setHSL(hue, 0.8, 0.62);
      cloudMat.uniforms.uGlow.value = 0.78 + mouseRef.current.y * 0.3 + chaos * 0.28 + explode * 0.42;
      cloudMat.uniforms.uScale.value = 1 + mouseRef.current.x * 0.25 + zoomIn * 0.35;
      cloudMat.uniforms.uAlpha.value = 1 - explodeEase * 0.92;
      starsMat.color.setHSL(hue, 0.55, 0.7);
      starsMat.opacity = Math.max(0.1, 0.5 * (1 - explodeEase * 0.82));
      rim.color.setHSL(hue, 0.84, 0.58);
      warm.color.setHSL(0.08 + mouseRef.current.x * 0.06, 0.9, 0.74);
      keyLight.color.copy(mood.clone().offsetHSL(0.04, -0.1, 0.1));
      keyLight.intensity = 0.92 + chaos * 0.5 + explode * 0.7;
      rim.intensity = 1.6 + chaos * 1.2;
      warm.intensity = 0.9 + explode * 0.6;

      const positions = cloudGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < totalPoints; i++) {
        const idx = i * 3;
        const wiggle = Math.sin(t * 1.3 + phaseAttr[i]) * 0.007;
        const blastX = blastDirs[idx] * explodeEase * 6.5;
        const blastY = blastDirs[idx + 1] * explodeEase * 7.4;
        const blastZ = blastDirs[idx + 2] * explodeEase * 8.6;
        const drift = chaos * (0.28 + liftAttr[i] * 0.1);
        positions[idx] = base[idx] + wiggle * (1 + zoomIn * 0.5) + Math.sin(t * 0.9 + phaseAttr[i]) * drift + blastX;
        positions[idx + 1] = base[idx + 1] + Math.cos(t * 1.5 + phaseAttr[i]) * 0.007 + chaos * (0.24 + liftAttr[i] * 0.36) + blastY;
        positions[idx + 2] = base[idx + 2] - chaos * (1.6 + liftAttr[i] * 1.1) + blastZ;
      }
      cloudGeo.attributes.position.needsUpdate = true;

      cloudGroup.rotation.y += 0.0009 + zoomIn * 0.0004 + chaos * 0.0009;
      cloudGroup.rotation.x = (mouseRef.current.y - 0.5) * 0.12 + chaos * 0.08;
      cloudGroup.position.y = -chaos * 0.35 - explodeEase * 3.4;
      cloudGroup.position.z = -explodeEase * 1.2;

      const swarmPositions = swarmGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < swarmPoints; i++) {
        const idx = i * 3;
        const s = swarmScreenIdx[i];
        const seed = swarmSeeds[s];
        const amp = swarmAmp[s];
        const speed = swarmSpeed[s];
        const a = t * speed + seed;

        const ringR = 0.82 + amp + chaos * 0.9;
        const centerX = Math.cos(a) * ringR + Math.sin(a * 0.31 + seed * 1.9) * 0.9 + Math.sin(a * 0.63 + seed) * 0.44;
        const centerZ = -1.45 - Math.sin(a * 0.8) * (0.9 + chaos * 1.1) - Math.cos(a * 0.47 + seed) * 0.62;
        const centerY = -0.62 + Math.sin(a * 1.8) * (0.14 + amp * 0.04) + Math.cos(a * 1.3) * 0.12 + chaos * 0.16;

        const blast = explodeEase * (6 + amp * 2.8);
        const ex = Math.cos(seed * 2.1) * blast;
        const ey = Math.sin(seed * 1.7) * blast * 0.6;
        const ez = -blast * 1.25;

        const centerDx = centerX - mouseWorld.x;
        const centerDy = centerY - mouseWorld.y;
        const centerDz = centerZ - mouseWorld.z;
        const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy + centerDz * centerDz);
        const centerRepel = Math.max(0, 1.7 - centerDist) * 0.7;
        const repelX = centerDist > 0.0001 ? (centerDx / centerDist) * centerRepel : 0;
        const repelY = centerDist > 0.0001 ? (centerDy / centerDist) * centerRepel : 0;
        const repelZ = centerDist > 0.0001 ? (centerDz / centerDist) * centerRepel : 0;

        const localX = swarmBase[idx];
        const localY = swarmBase[idx + 1];
        const localZ = swarmBase[idx + 2];
        const angle = Math.sin(a * 1.1 + swarmPulse[i]) * (0.4 + chaos * 0.35);
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        const rx = localX * ca - localY * sa;
        const ry = localX * sa + localY * ca;
        const jitter = Math.sin(t * (1.9 + speed) + swarmPulse[i]) * 0.016;

        swarmPositions[idx] = centerX + repelX + ex + rx + jitter;
        swarmPositions[idx + 1] = centerY + repelY + ey + ry + Math.cos(t * (1.3 + speed) + swarmPulse[i]) * 0.014;
        swarmPositions[idx + 2] = centerZ + repelZ + ez + localZ + Math.sin(t * 1.2 + swarmPulse[i]) * 0.018;
      }
      swarmGeo.attributes.position.needsUpdate = true;
      swarmMat.opacity = (0.82 + chaos * 0.16) * (1 - explodeEase * 0.86);

      const sparklePositions = sparkleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkleCount; i++) {
        const idx = i * 3;
        const seed = sparkleSeeds[i];
        const swayX = Math.sin(t * (0.45 + sparkleLift[i] * 0.2) + seed) * (0.22 + chaos * 0.5);
        const swayY = Math.cos(t * (0.62 + sparkleLift[i] * 0.2) + seed * 0.9) * (0.18 + chaos * 0.42);
        const swayZ = Math.sin(t * 0.38 + seed * 1.3) * (0.28 + chaos * 0.7);

        let x = sparkleBase[idx] + swayX;
        let y = sparkleBase[idx + 1] + swayY;
        let z = sparkleBase[idx + 2] + swayZ - chaos * (0.6 + sparkleLift[i] * 0.8);

        const dx = x - mouseWorld.x;
        const dy = y - mouseWorld.y;
        const dz = z - mouseWorld.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1.8 && d > 0.0001) {
          const p = (1.8 - d) * 0.35;
          x += (dx / d) * p;
          y += (dy / d) * p;
          z += (dz / d) * p;
        }

        x += Math.sin(seed * 1.7) * explodeEase * (2.8 + sparkleLift[i] * 1.2);
        y += Math.cos(seed * 1.3) * explodeEase * (2.2 + sparkleLift[i] * 1.1);
        z -= explodeEase * (5.4 + sparkleLift[i] * 1.6);

        sparklePositions[idx] = x;
        sparklePositions[idx + 1] = y;
        sparklePositions[idx + 2] = z;
      }
      sparkleGeo.attributes.position.needsUpdate = true;
      sparkleMat.opacity = (0.86 + chaos * 0.12) * (1 - explodeEase * 0.86);

      camera.position.z = 4.8 - zoomIn * 4.15 + chaos * 0.7 + explodeEase * 9.2;
      camera.position.y = 0.95 + Math.sin(t * 0.9) * 0.03 + zoomIn * 0.36 + chaos * 0.45 + explodeEase * 2.1;
      camera.position.x = (mouseRef.current.x - 0.5) * 0.28 + Math.sin(t * 0.45) * chaos * 0.24;
      camera.lookAt(0, 0.18 + chaos * 0.05 + explodeEase * 0.55, -2.2 - zoomIn * 2.8 - chaos * 1.9);

      stars.rotation.y += 0.00024 + chaos * 0.0015;
      stars.position.y = -chaos * 1.2 - explodeEase * 4.8;

      swarmCloud.position.y = -explodeEase * 0.7;

      const textPositions = textGeo.attributes.position.array as Float32Array;
      const repelRadius = 0.72;
      for (let i = 0; i < textCount; i++) {
        const idx = i * 3;
        let x = textPositions[idx];
        let y = textPositions[idx + 1];
        let z = textPositions[idx + 2];

        const bx = textBase[idx];
        const by = textBase[idx + 1];
        const bz = textBase[idx + 2];

        // Spring back to original text silhouette.
        textVel[idx] += (bx - x) * 0.028;
        textVel[idx + 1] += (by - y) * 0.028;
        textVel[idx + 2] += (bz - z) * 0.028;

        // Mouse repulsion so letters scatter under cursor.
        const dx = x - mouseWorld.x;
        const dy = y - mouseWorld.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repelRadius && dist > 0.0001) {
          const power = (repelRadius - dist) * 0.13;
          textVel[idx] += (dx / dist) * power;
          textVel[idx + 1] += (dy / dist) * power;
        }

        textVel[idx] *= 0.9;
        textVel[idx + 1] *= 0.9;
        textVel[idx + 2] *= 0.9;

        x += textVel[idx];
        y += textVel[idx + 1];
        z += textVel[idx + 2];

        // During blast, move the text out with scene particles.
        z -= explodeEase * 3.9;
        y -= explodeEase * 0.4;

        textPositions[idx] = x;
        textPositions[idx + 1] = y;
        textPositions[idx + 2] = z;
      }
      textGeo.attributes.position.needsUpdate = true;
      textMat.opacity = Math.max(0, 0.95 - explodeEase * 1.1);

      root.style.setProperty('--next-opacity', String(nextOpacity));
      root.style.setProperty('--stage-opacity', String(stageOpacity));
      root.style.setProperty('--scene-brightness', String(1));
      root.style.setProperty('--hue', String(Math.round(hue * 360)));
      root.style.setProperty('--blast-opacity', String(explodeEase));
      if (sceneDone) {
        root.dataset.sceneDone = 'true';
      } else {
        delete root.dataset.sceneDone;
      }

      if (!isMobileViewport) {
        if (!isAutoScrollingRef.current && progress > 0.985 && stageOpacity < 0.04) {
          const targetTop = appSectionRef.current?.offsetTop ?? stage.offsetHeight;
          isAutoScrollingRef.current = true;
          root.scrollTo({ top: targetTop, behavior: 'smooth' });
        } else if (progress < 0.9) {
          isAutoScrollingRef.current = false;
        }
      }

      if (stickyViewportRef.current) {
        stickyViewportRef.current.style.opacity = sceneDone ? '0' : String(stageOpacity);
        if (sceneDone || stageOpacity < 0.02) {
          stickyViewportRef.current.style.pointerEvents = 'none';
          stickyViewportRef.current.style.zIndex = '-1';
          stickyViewportRef.current.style.visibility = 'hidden';
        } else {
          stickyViewportRef.current.style.pointerEvents = 'auto';
          stickyViewportRef.current.style.zIndex = '1';
          stickyViewportRef.current.style.visibility = 'visible';
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      cloudGeo.dispose();
      cloudMat.dispose();
      starsGeo.dispose();
      starsMat.dispose();
      swarmGeo.dispose();
      swarmMat.dispose();
      sparkleGeo.dispose();
      sparkleMat.dispose();
      textGeo.dispose();
      textMat.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const appSection = appSectionRef.current;
    if (!root || !stage || !appSection) return;

    const isMobileViewport = window.matchMedia('(max-width: 900px)').matches;
    if (isMobileViewport) return;

    const triggerAutoScrollToApp = () => {
      if (isAutoScrollingRef.current) return;
      isAutoScrollingRef.current = true;
      hasAutoNavigatedRef.current = true;
      root.scrollTo({ top: appSection.offsetTop, behavior: 'smooth' });
      window.setTimeout(() => {
        downWheelCountRef.current = 0;
        isAutoScrollingRef.current = false;
      }, 900);
    };

    const onWheel = (event: WheelEvent) => {
      if (isAutoScrollingRef.current) return;

      if (event.deltaY < -12 && root.scrollTop >= stage.offsetHeight * 0.35) {
        downWheelCountRef.current = 0;
        hasAutoNavigatedRef.current = false;
        delete root.dataset.sceneDone;
        root.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const now = performance.now();
      const stageHeight = Math.max(1, stage.offsetHeight);
      const inIntroScene = root.scrollTop < stageHeight * 0.55;

      if (root.scrollTop < 24) {
        hasAutoNavigatedRef.current = false;
      }

      if (!inIntroScene) return;
      if (hasAutoNavigatedRef.current) return;

      if (event.deltaY > 12) {
        if (now - lastWheelTimeRef.current > 1200) {
          downWheelCountRef.current = 0;
        }
        lastWheelTimeRef.current = now;
        downWheelCountRef.current += 1;

        if (downWheelCountRef.current >= 2) {
          triggerAutoScrollToApp();
        }
      }

      if (event.deltaY < -12) {
        downWheelCountRef.current = 0;
      }
    };

    root.addEventListener('wheel', onWheel, { passive: true });
    return () => root.removeEventListener('wheel', onWheel);
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    mouseRef.current.x = Math.max(0, Math.min(1, mx));
    mouseRef.current.y = Math.max(0, Math.min(1, my));

    if (rootRef.current) {
      rootRef.current.style.setProperty('--mx', String(mouseRef.current.x));
      rootRef.current.style.setProperty('--my', String(mouseRef.current.y));
    }
  };

  const handleLeave = () => {
    mouseRef.current.x = 0.5;
    mouseRef.current.y = 0.5;
    if (rootRef.current) {
      rootRef.current.style.setProperty('--mx', '0.5');
      rootRef.current.style.setProperty('--my', '0.5');
    }
  };

  const sosTasks = tasks.filter((t) => t.status === 'sos');

  return (
    <main ref={rootRef} className={styles.root} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <section ref={stageRef} className={styles.stage}>
        <div ref={stickyViewportRef} className={styles.stickyViewport}>
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        </div>
      </section>

      <section ref={appSectionRef} className={`dashboard-stage ${styles.appSection}`}>
        <div className={`dashboard-shell ${styles.appReveal}`}>
          <div className="app-shell">
            <Topbar />
            <Sidebar />
            <main className="main-content">
              {view === 'personal' && <PersonalDashboard />}
              {view === 'team' && <TeamRadar />}
              {view === 'notes' && <NotesEditor />}
            </main>
            {sosTasks.length > 0 && <SOSPanel sosTasks={sosTasks} />}
            <RolloverBanner />
          </div>
        </div>
      </section>
    </main>
  );
}

export default function MotionLabOnePage() {
  return (
    <Suspense fallback={null}>
      <MotionLabOneContent />
    </Suspense>
  );
}
