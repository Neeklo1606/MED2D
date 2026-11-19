"use client";
import type React from "react";
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;
import { bySlug, COLORS, type Gender } from "@/catalog/data";
import { wornList } from "../look";
import type { LookRendererHandle, LookRendererProps } from "./types";

const url = (model: string, g: Gender) => `/3d/models/${model}_${g}.glb`;
const HOME = { pos: new THREE.Vector3(0.9, 1.25, 3.6), target: new THREE.Vector3(0, 0.88, 0) };
const MIN = 1.2, MAX = 6;

function Model({ src, color, base }: { src: string; color?: string; base?: boolean }) {
  const { scene } = useGLTF(src, false, true);
  const invalidate = useThree((s) => s.invalidate);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        const mesh = m as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.side = THREE.DoubleSide;
        mat.roughness = base ? 0.6 : 0.9;
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

const CameraRig = forwardRef<LookRendererHandle>(function CameraRig(_, ref) {
  const { camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const dolly = (k: number) => {
    const c = controls.current;
    if (!c) return;
    const dir = camera.position.clone().sub(c.target);
    const d = THREE.MathUtils.clamp(dir.length() * k, MIN, MAX);
    camera.position.copy(c.target).add(dir.setLength(d));
    c.update();
    invalidate();
  };
  const reset = () => {
    camera.position.copy(HOME.pos);
    controls.current?.target.copy(HOME.target);
    controls.current?.update();
    invalidate();
  };
  useImperativeHandle(ref, () => ({ zoomIn: () => dolly(0.8), zoomOut: () => dolly(1.25), reset }));
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
    />
  );
});

const ThreeRenderer = forwardRef<LookRendererHandle, LookRendererProps>(function ThreeRenderer({ look, label }, ref) {
  const g = look.gender;
  const items = wornList(look).filter((x) => x.product.model);
  useEffect(() => {
    useGLTF.preload(url("mannequin", g), false, true);
    for (const x of items) useGLTF.preload(url(x.product.model!, g), false, true);
  }, [g, items]);
  const rig = useRef<LookRendererHandle>(null);
  useImperativeHandle(ref, () => ({
    zoomIn: () => rig.current?.zoomIn(),
    zoomOut: () => rig.current?.zoomOut(),
    reset: () => rig.current?.reset(),
  }));
  return (
    <Canvas
      role="img"
      aria-label={label}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.05, far: 20, position: HOME.pos.toArray() }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      onDoubleClick={() => rig.current?.reset()}
      style={{ touchAction: "none" }}
    >
      <hemisphereLight args={[0xffffff, 0xd9dbe0, 1.2]} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <directionalLight position={[-2, 2, -2]} intensity={0.6} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.7, 64]} />
        <meshStandardMaterial color="#e6e7eb" roughness={1} />
      </mesh>
      <Suspense fallback={null}>
        <Model src={url("mannequin", g)} base />
        {items.map(({ slot, worn, product }) => (
          <Model key={`${slot}-${product.model}-${g}`} src={url(product.model!, g)} color={COLORS[worn.color]?.hex} />
        ))}
      </Suspense>
      <CameraRig ref={rig} />
    </Canvas>
  );
});

export default ThreeRenderer;

/** Для тестов и предзагрузки соседних вещей. */
export const modelUrl = (slug: string, g: Gender) => {
  const m = bySlug.get(slug)?.model;
  return m ? url(m, g) : null;
};
