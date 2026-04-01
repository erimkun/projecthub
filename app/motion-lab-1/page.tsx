'use client';

import { useEffect, useRef, Suspense, useState } from 'react';
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
import MobileBottomNav from '@/components/MobileBottomNav';
import styles from './page.module.css';

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildParticleText(
  text: string | string[],
  width: number,
  height: number,
  sampleStep: number,
  scale = 0.0036,
  options?: { yOffset?: number; fontScale?: number }
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
  const autoFontScale = lines.length > 1 ? 0.16 : 0.2;
  const fontSize = Math.floor(height * (options?.fontScale ?? autoFontScale));
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
      const py = (height * 0.5 - y) * scale + (options?.yOffset ?? 1.55);
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
  const [isFontsReady, setIsFontsReady] = useState(false);
  const [isLoaderCycleDone, setIsLoaderCycleDone] = useState(false);
  const isBootReady = isFontsReady && isLoaderCycleDone;
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [installHintText, setInstallHintText] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const appSectionRef = useRef<HTMLElement>(null);
  const stickyViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const loaderCanvasRef = useRef<HTMLCanvasElement>(null);
  const isAutoScrollingRef = useRef(false);
  const hasAutoNavigatedRef = useRef(false);
  const downWheelCountRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    let cancelled = false;

    const markFontsReady = () => {
      if (!cancelled) setIsFontsReady(true);
    };

    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 520);
    });

    const fontReadyPromise = document.fonts?.ready
      ? document.fonts.ready.then(() => undefined)
      : Promise.resolve();

    Promise.all([minDelay, fontReadyPromise]).then(markFontsReady);

    const fallbackTimeout = window.setTimeout(markFontsReady, 3200);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimeout);
    };
  }, []);

  useEffect(() => {
    const canvas = loaderCanvasRef.current;
    if (!canvas || isBootReady) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const steps = [8, 8, 7, 6, 5, 4, 3, 2, 1];
    const dirs: Array<[number, number]> = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1],
    ];

    const path: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
    let px = 0;
    let py = 0;
    for (let s = 0; s < steps.length; s++) {
      const [dx, dy] = dirs[s];
      for (let i = 0; i < steps[s]; i++) {
        px += dx;
        py += dy;
        path.push({ x: px, y: py });
      }
    }

    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const point of path) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();

    let raf = 0;
    let head = 0;
    let direction = 1;
    let last = performance.now();
    let completedHalfCycle = false;

    const draw = (now: number) => {
      const dt = Math.min(0.045, (now - last) / 1000);
      last = now;

      const speed = 8.5;
      head += direction * speed * dt;
      if (direction > 0 && head >= path.length - 1) {
        head = path.length - 1;
        if (!completedHalfCycle) {
          completedHalfCycle = true;
          setIsLoaderCycleDone(true);
        }
        direction = -1;
      } else if (direction < 0 && head <= 0) {
        head = 0;
        direction = 1;
      }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      const cell = Math.max(5, Math.min(8, Math.round(Math.min(w, h) * 0.0055)));
      const gap = Math.max(1, Math.round(cell * 0.22));
      const step = cell + gap;
      const pathWidth = (maxX - minX + 1) * step;
      const pathHeight = (maxY - minY + 1) * step;
      const originX = Math.round((w - pathWidth) / 2 - minX * step + step * 0.5);
      const originY = Math.round((h - pathHeight) / 2 - minY * step + step * 0.5);

      const headCell = direction > 0 ? Math.floor(head) : Math.ceil(head);
      for (let i = 0; i < path.length; i++) {
        const active = direction > 0 ? i <= headCell : i >= headCell;
        if (!active) continue;

        const p = path[i];
        const x = originX + p.x * step;
        const y = originY + p.y * step;
        const dist = Math.abs(i - head);
        const alpha = Math.max(0.26, 1 - dist * 0.16);
        const pulse = 1 + Math.max(0, 0.14 - dist * 0.03);
        const size = cell * pulse;
        const offset = (size - cell) / 2;

        const flow = performance.now() * 0.055 + i * 18;
        const edgeHues = [flow % 360, (flow + 90) % 360, (flow + 180) % 360, (flow + 270) % 360];

        ctx.fillStyle = `hsla(222, 42%, 12%, ${Math.min(0.82, alpha * 0.72).toFixed(3)})`;
        ctx.fillRect(x - offset, y - offset, size, size);

        const left = x - offset;
        const top = y - offset;
        const right = left + size;
        const bottom = top + size;

        ctx.lineWidth = Math.max(1.2, cell * 0.1);
        ctx.shadowBlur = 12;
        ctx.lineCap = 'round';

        ctx.shadowColor = `hsla(${edgeHues[0].toFixed(1)}, 100%, 72%, ${Math.min(0.98, alpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[0].toFixed(1)}, 100%, 72%, ${Math.min(1, alpha + 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.stroke();

        ctx.shadowColor = `hsla(${edgeHues[1].toFixed(1)}, 100%, 72%, ${Math.min(0.98, alpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[1].toFixed(1)}, 100%, 72%, ${Math.min(1, alpha + 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(right, top);
        ctx.lineTo(right, bottom);
        ctx.stroke();

        ctx.shadowColor = `hsla(${edgeHues[2].toFixed(1)}, 100%, 72%, ${Math.min(0.98, alpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[2].toFixed(1)}, 100%, 72%, ${Math.min(1, alpha + 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(right, bottom);
        ctx.lineTo(left, bottom);
        ctx.stroke();

        ctx.shadowColor = `hsla(${edgeHues[3].toFixed(1)}, 100%, 72%, ${Math.min(0.98, alpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[3].toFixed(1)}, 100%, 72%, ${Math.min(1, alpha + 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(left, bottom);
        ctx.lineTo(left, top);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [isBootReady]);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (!isMobile) return;

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (isStandalone) return;

    const storageKey = 'ph_pwa_install_hint_seen_v2';
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // Continue without persistence if storage is blocked.
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes('safari') && !/crios|fxios|edgios|opr\//.test(ua);

    if (isIos && isSafari) {
      setInstallHintText('Safari icin: Paylas menusu > Ana Ekrana Ekle adimini kullanarak uygulamayi kurabilirsin.');
    } else {
      setInstallHintText('Bu uygulamayi ana ekrana eklemek icin tarayici menusundeki Ana Ekrana Ekle secenegini kullanabilirsin.');
    }

    setShowInstallHint(true);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const trailCanvas = trailCanvasRef.current;
    if (!root || !trailCanvas) return;

    const ctx = trailCanvas.getContext('2d');
    if (!ctx) return;

    type TrailCell = {
      x: number;
      y: number;
      size: number;
      life: number;
      maxLife: number;
      key: string;
      flowSeed: number;
    };

    let raf = 0;
    const cells: TrailCell[] = [];
    const recentCells = new Map<string, number>();
    let hasLast = false;
    let lastX = 0;
    let lastY = 0;
    const cellSize = 11;
    const stripRadius = 0;
    const maxActiveCells = 220;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = root.getBoundingClientRect();
      trailCanvas.width = Math.floor(rect.width * dpr);
      trailCanvas.height = Math.floor(rect.height * dpr);
      trailCanvas.style.width = `${Math.floor(rect.width)}px`;
      trailCanvas.style.height = `${Math.floor(rect.height)}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const snapToGrid = (value: number) => Math.round(value / cellSize) * cellSize;

    const spawnStrip = (x: number, y: number, dx: number, dy: number) => {
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const now = performance.now();

      for (let offset = -stripRadius; offset <= stripRadius; offset++) {
        const gx = snapToGrid(x + nx * offset * cellSize);
        const gy = snapToGrid(y + ny * offset * cellSize);
        const key = `${gx}:${gy}`;
        const lastSeen = recentCells.get(key) ?? -1e6;
        if (now - lastSeen < 72) continue;
        if (cells.length >= maxActiveCells) continue;

        recentCells.set(key, now);
        cells.push({
          x: gx,
          y: gy,
          size: cellSize * 0.9,
          life: 0,
          maxLife: 20,
          key,
          flowSeed: Math.random() * 360,
        });
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (hasLast) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.min(8, Math.floor(dist / (cellSize * 0.9))));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const sx = lastX + dx * t;
          const sy = lastY + dy * t;
          spawnStrip(sx, sy, dx, dy);
        }
      } else {
        spawnStrip(x, y, 1, 0);
      }

      hasLast = true;
      lastX = x;
      lastY = y;
    };

    const onPointerLeave = () => {
      hasLast = false;
    };

    const draw = () => {
      const rect = root.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (let i = cells.length - 1; i >= 0; i--) {
        const cell = cells[i];
        cell.life += 1;

        const p = cell.life / cell.maxLife;
        if (p >= 1) {
          cells.splice(i, 1);
          const lastSeen = recentCells.get(cell.key);
          if (lastSeen && performance.now() - lastSeen > 90) {
            recentCells.delete(cell.key);
          }
          continue;
        }

        const fade = p < 0.72 ? 1 : 1 - (p - 0.72) / 0.28;
        const edgeAlpha = Math.max(0, 0.85 * fade);
        const fillAlpha = Math.max(0, 0.34 * fade);
        const half = cell.size / 2;
        const flow = performance.now() * 0.055 + cell.flowSeed + p * 120;
        const edgeHues = [flow % 360, (flow + 90) % 360, (flow + 180) % 360, (flow + 270) % 360];

        ctx.save();
        ctx.translate(cell.x, cell.y);

        ctx.fillStyle = `hsla(222, 40%, 11%, ${fillAlpha.toFixed(3)})`;
        ctx.fillRect(-half, -half, cell.size, cell.size);

        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 8;
        ctx.lineCap = 'round';

        ctx.shadowColor = `hsla(${edgeHues[0].toFixed(1)}, 100%, 68%, ${Math.min(0.9, edgeAlpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[0].toFixed(1)}, 100%, 68%, ${edgeAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(-half, -half);
        ctx.lineTo(half, -half);
        ctx.stroke();

        ctx.shadowColor = `hsla(${edgeHues[1].toFixed(1)}, 100%, 68%, ${Math.min(0.9, edgeAlpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[1].toFixed(1)}, 100%, 68%, ${edgeAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(half, -half);
        ctx.lineTo(half, half);
        ctx.stroke();

        ctx.shadowColor = `hsla(${edgeHues[2].toFixed(1)}, 100%, 68%, ${Math.min(0.9, edgeAlpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[2].toFixed(1)}, 100%, 68%, ${edgeAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(half, half);
        ctx.lineTo(-half, half);
        ctx.stroke();

        ctx.shadowColor = `hsla(${edgeHues[3].toFixed(1)}, 100%, 68%, ${Math.min(0.9, edgeAlpha).toFixed(3)})`;
        ctx.strokeStyle = `hsla(${edgeHues[3].toFixed(1)}, 100%, 68%, ${edgeAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(-half, half);
        ctx.lineTo(-half, -half);
        ctx.stroke();

        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();

    root.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const dismissInstallHint = () => {
    setShowInstallHint(false);
    try {
      window.localStorage.setItem('ph_pwa_install_hint_seen_v2', '1');
    } catch {
      // Ignore persistence errors.
    }
  };

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
    if (!isBootReady) return;

    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!canvas || !stage || !root) return;

    const isMobileViewport = window.matchMedia('(max-width: 900px)').matches;
    const introStartTime = performance.now();
    const introDurationMs = isMobileViewport ? 3600 : 6800;

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

    const cityCenterZ = -1.9;

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

    const baseY = -1.45;

    const addCityTower = (cx: number, cz: number, width: number, depth: number, height: number, hue: number) => {
      const baseColor = new THREE.Color().setHSL(hue, 0.82, 0.66);
      const edgeColor = new THREE.Color().setHSL(hue + 0.05, 0.9, 0.78);
      const yTop = baseY + height;

      for (let i = 0; i < m(950); i++) {
        const x = rand(cx - width / 2, cx + width / 2);
        const z = rand(cz - depth / 2, cz + depth / 2);
        pushPoint(x, baseY + rand(-0.02, 0.02), z, baseColor, rand(2.8, 7.2), rand(1.1, 2.2));
      }

      for (let i = 0; i < m(1300); i++) {
        const side = Math.random();
        let x = cx;
        let z = cz;
        if (side < 0.25) {
          x = cx - width / 2 + rand(-0.01, 0.01);
          z = rand(cz - depth / 2, cz + depth / 2);
        } else if (side < 0.5) {
          x = cx + width / 2 + rand(-0.01, 0.01);
          z = rand(cz - depth / 2, cz + depth / 2);
        } else if (side < 0.75) {
          x = rand(cx - width / 2, cx + width / 2);
          z = cz - depth / 2 + rand(-0.01, 0.01);
        } else {
          x = rand(cx - width / 2, cx + width / 2);
          z = cz + depth / 2 + rand(-0.01, 0.01);
        }

        const y = rand(baseY + 0.04, yTop);
        const isWindow = Math.random() > 0.45;
        const color = isWindow ? edgeColor : baseColor;
        pushPoint(x, y, z, color, rand(2.6, 7.6), rand(1.2, 2.8));
      }

      for (let i = 0; i < m(260); i++) {
        pushPoint(
          cx + rand(-width * 0.08, width * 0.08),
          yTop + rand(0, 0.55),
          cz + rand(-depth * 0.08, depth * 0.08),
          edgeColor,
          rand(2.6, 8),
          rand(1.4, 3)
        );
      }
    };

    const addNeonRing = (radius: number, y: number, hue: number, thickness = 0.06) => {
      const ringColor = new THREE.Color().setHSL(hue, 0.9, 0.72);
      for (let i = 0; i < m(2100); i++) {
        const a = rand(0, Math.PI * 2);
        const rr = radius + rand(-thickness, thickness);
        const x = Math.cos(a) * rr;
        const z = cityCenterZ + Math.sin(a) * rr;
        pushPoint(x, y + rand(-0.01, 0.01), z, ringColor, rand(2.4, 6.8), rand(0.9, 2));
      }
    };

    const platformColor = new THREE.Color(0x80a2df);
    for (let i = 0; i < m(4200); i++) {
      const a = rand(0, Math.PI * 2);
      const rr = rand(0.3, 3.45);
      const x = Math.cos(a) * rr;
      const z = cityCenterZ + Math.sin(a) * rr;
      pushPoint(x, baseY + rand(-0.02, 0.02), z, platformColor, rand(2.8, 7.2), rand(0.8, 1.8));
    }

    const towerCount = isMobileViewport ? 34 : 52;
    const towerHuePalette = [0.52, 0.56, 0.6, 0.66, 0.72, 0.78];
    for (let i = 0; i < towerCount; i++) {
      const a = rand(0, Math.PI * 2);
      const rr = rand(0.12, 2.05);
      const x = Math.cos(a) * rr;
      const z = cityCenterZ + Math.sin(a) * rr;
      const width = rand(0.14, 0.34);
      const depth = rand(0.14, 0.34);
      const height = rand(0.55, 2.25) * (1.1 - rr / 4.2);
      const hueBase = towerHuePalette[Math.floor(Math.random() * towerHuePalette.length)];
      const hue = hueBase + rand(-0.025, 0.025);
      addCityTower(x, z, width, depth, height, hue);
    }

    addCityTower(0, cityCenterZ, 0.3, 0.3, 3.35, 0.58);
    addCityTower(0.3, cityCenterZ - 0.2, 0.25, 0.25, 2.5, 0.72);
    addCityTower(-0.28, cityCenterZ + 0.2, 0.24, 0.24, 2.35, 0.52);

    addNeonRing(1.55, baseY + 0.04, 0.55, 0.05);
    addNeonRing(2.15, baseY + 0.07, 0.76, 0.06);
    addNeonRing(2.7, baseY + 0.1, 0.59, 0.08);

    const ambientHaze = new THREE.Color(0xa7c4ff);
    for (let i = 0; i < m(2200); i++) {
      pushPoint(
        rand(-3.8, 3.8),
        rand(-0.25, 2.35),
        cityCenterZ + rand(-3.8, 3.8),
        ambientHaze,
        rand(2.2, 6),
        rand(0.7, 1.8)
      );
    }

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

    const swarmCount = isMobileViewport ? 3 : 5;
    const pointsPerSwarm = m(140);
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
      swarmAmp[s] = rand(0.45, 1.15);
      swarmSpeed[s] = rand(0.16, 0.34);

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

    const sparkleCount = isMobileViewport ? 420 : 760;
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
      const elapsed = performance.now() - introStartTime;
      const progress = Math.min(elapsed / introDurationMs, 1);

      const zoomIn = Math.min(progress / 0.54, 1);
      const chaosRaw = Math.min(Math.max((progress - 0.54) / 0.42, 0), 1);
      const chaos = chaosRaw * 0.42;
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
      cloudGroup.rotation.x = (mouseRef.current.y - 0.5) * 0.035 + chaos * 0.015;
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

        const ringR = 1.25 + amp + chaos * 0.22;
        const centerX = Math.cos(a) * ringR + Math.sin(a * 0.35 + seed) * 0.32;
        const centerZ = cityCenterZ + Math.sin(a) * ringR + Math.cos(a * 0.3 + seed) * 0.28;
        const centerY = -0.7 + Math.sin(a * 1.2) * 0.08 + chaos * 0.04;

        const blast = explodeEase * (1.4 + amp * 0.7);
        const ex = Math.cos(seed * 2.1) * blast;
        const ey = Math.sin(seed * 1.7) * blast * 0.28;
        const ez = -blast * 0.4;

        const centerDx = centerX - mouseWorld.x;
        const centerDy = centerY - mouseWorld.y;
        const centerDz = centerZ - mouseWorld.z;
        const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy + centerDz * centerDz);
        const centerRepel = Math.max(0, 1.2 - centerDist) * 0.26;
        const repelX = centerDist > 0.0001 ? (centerDx / centerDist) * centerRepel : 0;
        const repelY = centerDist > 0.0001 ? (centerDy / centerDist) * centerRepel : 0;
        const repelZ = centerDist > 0.0001 ? (centerDz / centerDist) * centerRepel : 0;

        const localX = swarmBase[idx];
        const localY = swarmBase[idx + 1];
        const localZ = swarmBase[idx + 2];
        const angle = Math.sin(a * 0.85 + swarmPulse[i]) * (0.15 + chaos * 0.1);
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        const rx = localX * ca - localY * sa;
        const ry = localX * sa + localY * ca;
        const jitter = Math.sin(t * (1.2 + speed) + swarmPulse[i]) * 0.008;

        swarmPositions[idx] = centerX + repelX + ex + rx + jitter;
        swarmPositions[idx + 1] = centerY + repelY + ey + ry + Math.cos(t * (0.9 + speed) + swarmPulse[i]) * 0.008;
        swarmPositions[idx + 2] = centerZ + repelZ + ez + localZ + Math.sin(t * 0.95 + swarmPulse[i]) * 0.01;
      }
      swarmGeo.attributes.position.needsUpdate = true;
      swarmMat.opacity = (0.4 + chaos * 0.1) * (1 - explodeEase * 0.86);

      const sparklePositions = sparkleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkleCount; i++) {
        const idx = i * 3;
        const seed = sparkleSeeds[i];
        const swayX = Math.sin(t * (0.38 + sparkleLift[i] * 0.16) + seed) * (0.11 + chaos * 0.22);
        const swayY = Math.cos(t * (0.5 + sparkleLift[i] * 0.16) + seed * 0.9) * (0.09 + chaos * 0.2);
        const swayZ = Math.sin(t * 0.31 + seed * 1.3) * (0.13 + chaos * 0.3);

        let x = sparkleBase[idx] + swayX;
        let y = sparkleBase[idx + 1] + swayY;
        let z = sparkleBase[idx + 2] + swayZ - chaos * (0.25 + sparkleLift[i] * 0.35);

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

        x += Math.sin(seed * 1.7) * explodeEase * (1.1 + sparkleLift[i] * 0.5);
        y += Math.cos(seed * 1.3) * explodeEase * (0.95 + sparkleLift[i] * 0.45);
        z -= explodeEase * (2.6 + sparkleLift[i] * 0.7);

        sparklePositions[idx] = x;
        sparklePositions[idx + 1] = y;
        sparklePositions[idx + 2] = z;
      }
      sparkleGeo.attributes.position.needsUpdate = true;
      sparkleMat.opacity = (0.5 + chaos * 0.08) * (1 - explodeEase * 0.86);

      const orbitTurns = isMobileViewport ? 0.38 : 0.56;
      const orbitAngle = -Math.PI * 0.25 + progress * Math.PI * 2 * orbitTurns;
      const orbitRadius = (isMobileViewport ? 6.6 : 6.1) - zoomIn * 0.72 + chaos * 0.04;

      camera.position.x = Math.cos(orbitAngle) * orbitRadius;
      camera.position.z = cityCenterZ + Math.sin(orbitAngle) * orbitRadius + explodeEase * 7.8;
      camera.position.y = 1.1 + zoomIn * 0.5 + chaos * 0.08 + explodeEase * 1.55;
      camera.lookAt(0, 0.08 + chaos * 0.03 + explodeEase * 0.26, cityCenterZ + 0.08);

      stars.rotation.y += 0.00024 + chaos * 0.0015;
      stars.position.y = -chaos * 1.2 - explodeEase * 4.8;

      swarmCloud.position.y = -explodeEase * 0.7;

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

      if (sceneDone) {
        delete root.dataset.introLocked;
      } else {
        root.dataset.introLocked = 'true';
      }

      if (!isAutoScrollingRef.current && progress > 0.985 && stageOpacity < 0.04) {
        const targetTop = appSectionRef.current?.offsetTop ?? stage.offsetHeight;
        isAutoScrollingRef.current = true;
        root.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else if (progress < 0.9) {
        isAutoScrollingRef.current = false;
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
      renderer.dispose();
    };
  }, [isBootReady]);

  useEffect(() => {
    // Scroll-driven intro is intentionally disabled in favor of time-based intro.
    return undefined;
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
      <canvas ref={trailCanvasRef} className={styles.cursorTrail} aria-hidden="true" />
      <div className={`${styles.loaderOverlay} ${isBootReady ? styles.loaderOverlayReady : ''}`} aria-hidden="true">
        <canvas ref={loaderCanvasRef} className={styles.loaderCanvas} />
      </div>

      {showInstallHint && (
        <div className={styles.installHint} role="status" aria-live="polite">
          <span>{installHintText}</span>
          <button type="button" className={styles.installHintButton} onClick={dismissInstallHint}>
            Tamam
          </button>
        </div>
      )}

      <section ref={stageRef} className={styles.stage}>
        <div ref={stickyViewportRef} className={styles.stickyViewport}>
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
          <div className={styles.introTitleOverlay} aria-hidden="true">
            <div className={styles.introTitleStack}>
              <div className={styles.introTitleMain}>KENTAŞ</div>
              <div className={styles.introTitleSub}>Tech &amp; AR-GE</div>
            </div>
          </div>
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
            <MobileBottomNav />
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
