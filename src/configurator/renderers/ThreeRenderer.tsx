"use client";
import type React from "react";
import { Component, forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;
import { bySlug, COLORS, PRODUCTS, type Gender, type Slot } from "@/catalog/data";
import { wornList } from "../look";
import { modelFile as url, warm } from "../models";
import type { LookRendererHandle, LookRendererProps } from "./types";
// кадр как в макете: модель почти анфас и по всей высоте сцены
const HOME = { pos: new THREE.Vector3(0.42, 0.98, 3.3), target: new THREE.Vector3(0, 0.85, 0) };
const MIN = 0.9, MAX = 6;

/** Куда смотреть при работе с вещью: высота цели (доля роста) и дистанция. */
const FOCUS: Record<Slot | "full", { y: number; d: number }> = {
  full: { y: 0.85, d: 3.33 },
  head: { y: 1.58, d: 1.35 },
  top: { y: 1.2, d: 2.0 },
  coat: { y: 1.05, d: 2.5 },
  bottom: { y: 0.58, d: 2.3 },
  feet: { y: 0.12, d: 1.5 },
  accessory: { y: 1.1, d: 2.4 },
};

/**
 * Модель из GLB. Манекен (base) рисуется с материалами из файла (кожа, волосы с alphaTest, бельё);
 * у одежды материал ткани `fabric` перекрашивается: цвет × AO складок (цвет вершин) × карта нормалей плетения.
 */
/**
 * Ошибка загрузки одной модели (сеть, 502) не должна ронять страницу: вещь пропадает со сцены,
 * кеш загрузчика чистится и через паузу идёт повторная попытка (до 4 раз).
 */
class ModelBoundary extends Component<{ src: string; children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    useGLTF.clear(this.props.src);
    if (this.state.attempt >= 4) return;
    this.timer = setTimeout(() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 })), 1500 * (this.state.attempt + 1));
  }
  componentWillUnmount() {
    clearTimeout(this.timer);
  }
  render() {
    return this.state.failed ? null : <SafeKey k={this.state.attempt}>{this.props.children}</SafeKey>;
  }
}

function SafeKey({ k, children }: { k: number; children: ReactNode }) {
  return <group key={k}>{children}</group>;
}

function Model({ src, color, base }: { src: string; color?: string; base?: boolean }) {
  const { scene } = useGLTF(src, false, true);
  const invalidate = useThree((s) => s.invalidate);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        const mesh = m as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        if (!base) mat.side = THREE.DoubleSide;
        mesh.material = mat;
      }
    });
    return o;
  }, [scene, base]);
  useEffect(() => {
    if (!color) return;
    obj.traverse((m) => {
      const mesh = m as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      // Перекрашиваем только основную ткань; фурнитура (trim) остаётся как есть.
      if (mesh.isMesh && mat && mat.name !== "trim") mat.color.set(color);
    });
    invalidate();
  }, [obj, color, invalidate]);
  return <primitive object={obj} />;
}

/** Студийный свет: мягкое окружение (без внешних HDR-файлов) + ключевой и контровой. */
function Studio() {
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return tex;
  }, [gl]);
  useEffect(() => () => env.dispose(), [env]);
  return <primitive object={env} attach="environment" />;
}

/** Сообщает, что модели загрузились (рендерится внутри Suspense). */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

function Loading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center" aria-live="polite">
      <span className="rounded-full bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-sm">3D-модель {Math.round(progress)}%</span>
    </div>
  );
}

const CameraRig = forwardRef<LookRendererHandle, { gender: Gender; intro: boolean }>(function CameraRig({ gender, intro }, ref) {
  const { camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  // первый показ: один плавный оборот вокруг модели, пока пользователь не коснулся сцены
  const spin = useRef<{ left: number } | null>(null);
  useEffect(() => {
    if (!intro || reduceMotion()) return;
    spin.current = { left: Math.PI * 2 };
    invalidate();
  }, [intro, invalidate]);
  const anim = useRef<{ p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; k: number } | null>(null);
  const reduce = reduceMotion();

  const go = (pos: THREE.Vector3, target: THREE.Vector3) => {
    const c = controls.current;
    if (!c) return;
    if (reduce) { camera.position.copy(pos); c.target.copy(target); c.update(); invalidate(); return; }
    anim.current = { p0: camera.position.clone(), p1: pos, t0: c.target.clone(), t1: target, k: 0 };
    invalidate();
  };

  useFrame((_, dt) => {
    const sp = spin.current, c0 = controls.current;
    if (sp && c0 && !anim.current) {
      const step = Math.min(sp.left, dt * (Math.PI * 2) / 7);
      sp.left -= step;
      camera.position.sub(c0.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), step).add(c0.target);
      c0.update();
      if (sp.left <= 0) spin.current = null;
      invalidate();
    }
    const a = anim.current, c = controls.current;
    if (!a || !c) return;
    a.k = Math.min(1, a.k + dt / 0.45);
    const e = 1 - Math.pow(1 - a.k, 3);
    camera.position.lerpVectors(a.p0, a.p1, e);
    c.target.lerpVectors(a.t0, a.t1, e);
    c.update();
    if (a.k >= 1) anim.current = null;
    invalidate();
  });

  /** Новая точка на той же азимутальной линии, что и сейчас (пользователь не теряет ракурс). */
  const frame = (slot: Slot | "full", azimuthDelta = 0) => {
    const c = controls.current;
    if (!c) return;
    const h = gender === "m" ? 1.07 : 1;
    const f = FOCUS[slot];
    const target = new THREE.Vector3(0, f.y * h, 0);
    const az = Math.atan2(camera.position.x - c.target.x, camera.position.z - c.target.z) + azimuthDelta;
    const elev = slot === "feet" ? 0.25 : slot === "head" ? 0.05 : slot === "full" ? 0.04 : 0.12;
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).multiplyScalar(f.d * h).add(target);
    go(pos, target);
  };

  const dolly = (k: number) => {
    const c = controls.current;
    if (!c) return;
    const dir = camera.position.clone().sub(c.target);
    go(c.target.clone().add(dir.setLength(THREE.MathUtils.clamp(dir.length() * k, MIN, MAX))), c.target.clone());
  };
  const rotate = (deg: number) => {
    const c = controls.current;
    if (!c) return;
    const dir = camera.position.clone().sub(c.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg));
    go(c.target.clone().add(dir), c.target.clone());
  };
  const reset = () => frame("full");
  // смена Ж/М: модели разного роста — кадр по всей высоте новой модели
  const firstGender = useRef(true);
  useEffect(() => {
    if (firstGender.current) { firstGender.current = false; if (gender === "f") return; }
    const id = setTimeout(() => frame("full"), 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender]);
  useImperativeHandle(ref, () => ({ zoomIn: () => dolly(0.8), zoomOut: () => dolly(1.25), reset, focus: (s) => frame(s), rotate }));
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={HOME.target}
      enablePan={false}
      enableDamping
      minDistance={MIN}
      maxDistance={MAX}
      minPolarAngle={0.35}
      maxPolarAngle={1.75}
      onStart={() => { anim.current = null; spin.current = null; }}
    />
  );
});

/**
 * После первого кадра с моделью, в простое браузера, по одному файлу: остальные вещи этого пола,
 * манекен и надетые вещи другого пола. Цвет задаётся материалом, поэтому на вещь нужен один GLB.
 * Только скачивание в кеш (без разбора и без индикатора загрузки); при экономии трафика не делаем.
 */
function usePrefetchRest(ready: boolean, g: Gender, worn: string[]) {
  const wornKey = worn.join(",");
  useEffect(() => {
    if (!ready) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /2g$/.test(conn?.effectiveType ?? "")) return;
    const other: Gender = g === "f" ? "m" : "f";
    const models = PRODUCTS.flatMap((p) => (p.model ? [p.model] : []));
    const wornModels = wornKey ? wornKey.split(",") : [];
    const queue = [
      ...models.filter((m) => !wornModels.includes(m)).map((m) => url(m, g)),
      url("mannequin", other),
      ...wornModels.map((m) => url(m, other)),
    ];
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1000);
    let stop = false;
    (async () => {
      for (const u of queue) {
        await new Promise<void>((r) => idle(r));
        if (stop) return;
        await warm(u);
      }
    })();
    return () => { stop = true; };
  }, [ready, g, wornKey]);
}

function reduceMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const ThreeRenderer = forwardRef<LookRendererHandle, LookRendererProps>(function ThreeRenderer({ look, label, intro = true }, ref) {
  const [ready, setReady] = useState(false);
  const g = look.gender;
  const items = wornList(look).filter((x) => x.product.model);
  // сначала только то, что видно: манекен и надетые вещи (все запросы сразу, параллельно)
  const firstKey = [url("mannequin", g), ...items.map((x) => url(x.product.model!, g))].join(" ");
  useEffect(() => {
    for (const u of firstKey.split(" ")) useGLTF.preload(u, false, true);
  }, [firstKey]);
  usePrefetchRest(ready, g, items.map((x) => x.product.model!));
  const rig = useRef<LookRendererHandle>(null);
  const onReady = useMemo(() => () => setReady(true), []);
  useImperativeHandle(ref, () => ({
    zoomIn: () => rig.current?.zoomIn(),
    zoomOut: () => rig.current?.zoomOut(),
    reset: () => rig.current?.reset(),
    focus: (slot) => rig.current?.focus(slot),
    rotate: (deg) => rig.current?.rotate(deg),
  }));
  return (
    <div className="relative h-full w-full">
    <Canvas
      role="img"
      aria-label={label}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.05, far: 20, position: HOME.pos.toArray() }}
      scene={{ environmentIntensity: 1.0 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.3;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      onDoubleClick={() => rig.current?.reset()}
      style={{ touchAction: "none" }}
    >
      <Studio />
      <hemisphereLight args={[0xffffff, 0xd9dbe0, 1.1]} />
      <directionalLight position={[2, 3, 3]} intensity={1.5} />
      <directionalLight position={[-2, 2, -2]} intensity={0.6} />
      <ContactShadows position={[0, 0.002, 0]} scale={1.6} blur={2.2} far={1.6} opacity={0.35} resolution={256} />
      <Suspense fallback={null}>
        <ModelBoundary key={url("mannequin", g)} src={url("mannequin", g)}><Model src={url("mannequin", g)} base /></ModelBoundary>
        {items.map(({ slot, worn, product }) => (
          <ModelBoundary key={`${slot}-${product.model}-${g}`} src={url(product.model!, g)}>
            <Model src={url(product.model!, g)} color={COLORS[worn.color]?.hex} />
          </ModelBoundary>
        ))}
        <Ready onReady={onReady} />
      </Suspense>
      <CameraRig ref={rig} gender={g} intro={intro && ready} />
    </Canvas>
    <Loading />
    </div>
  );
});

export default ThreeRenderer;

/** Для тестов и предзагрузки соседних вещей (адрес с ?v=<хэш>). */
export const modelUrl = (slug: string, g: Gender) => {
  const m = bySlug.get(slug)?.model;
  return m ? url(m, g) : null;
};
