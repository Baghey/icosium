"use client";

import type { End, PlacedTile } from "@icosium/shared";
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Placement, layoutChain } from "@/lib/chain-layout";

/*
 * La table de domino en 3D : feutre vert, rebord en noyer verni, filet doré, rosette,
 * dominos ivoire en relief éclairés par la lampe du café. Les règles restent sur le serveur :
 * cette scène ne fait qu'afficher la chaîne publique et renvoyer le bout choisi.
 */

const FELT_W = 11; // largeur du feutre (en largeurs de domino)
const FELT_D = 15; // profondeur du feutre
const RIM = 0.75; // épaisseur du rebord
const LIMIT_X = 4.2; // la chaîne tourne avant d'atteindre le rebord
const TILE_H = 0.34; // épaisseur d'un domino

type Props = {
  chain: PlacedTile[];
  chainStart: number;
  targets: End[];
  onPick: (end: End) => void;
  freshTile: string | null;
  /** Change à chaque nouvelle manche : on mélange les dominos. */
  shuffleKey: string;
  players: number;
  reducedMotion: boolean;
};

// ---------- matériaux partagés ----------

const tileGeometry = new RoundedBoxGeometry(2, TILE_H, 1, 4, 0.11);
const ivory = new THREE.MeshPhysicalMaterial({
  color: "#f3e6c9",
  roughness: 0.33,
  clearcoat: 0.7,
  clearcoatRoughness: 0.22,
  sheen: 0.3,
  sheenColor: new THREE.Color("#fff4dc"),
});

/** Ombre douce sous un domino : un rectangle flou, léger et toujours net à l'écran. */
let shadowTex: THREE.CanvasTexture | null = null;
function shadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.filter = "blur(14px)";
  g.fillStyle = "rgba(0,12,6,0.85)";
  g.beginPath();
  g.roundRect(34, 30, 188, 68, 18);
  g.fill();
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

function BlobShadow({ shadowRef }: { shadowRef?: React.Ref<THREE.Mesh> }) {
  return (
    <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0.12, -TILE_H / 2 + 0.008, 0.16]} renderOrder={1}>
      <planeGeometry args={[2.7, 1.45]} />
      <meshBasicMaterial map={shadowTexture()} transparent opacity={0.75} depthWrite={false} />
    </mesh>
  );
}

const faceCache = new Map<string, THREE.CanvasTexture>();
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.26, 0.26], [0.74, 0.74]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.26, 0.26], [0.74, 0.26], [0.26, 0.74], [0.74, 0.74]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.26, 0.22], [0.74, 0.22], [0.26, 0.5], [0.74, 0.5], [0.26, 0.78], [0.74, 0.78]],
};

/** La face d'un domino (points creusés, trait central, clou en laiton), dessinée une fois. */
function faceTexture(a: number, b: number): THREE.CanvasTexture {
  const key = `${a}-${b}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const W = 512;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.clearRect(0, 0, W, H);
  // trait central gravé
  g.strokeStyle = "rgba(110,88,55,0.9)";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(W / 2, 30);
  g.lineTo(W / 2, H - 30);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(W / 2 + 6, 30);
  g.lineTo(W / 2 + 6, H - 30);
  g.stroke();
  // clou en laiton
  const pin = g.createRadialGradient(W / 2 - 4, H / 2 - 4, 1, W / 2, H / 2, 14);
  pin.addColorStop(0, "#fff0c0");
  pin.addColorStop(0.5, "#c8962f");
  pin.addColorStop(1, "#5e3f0e");
  g.fillStyle = pin;
  g.beginPath();
  g.arc(W / 2, H / 2, 13, 0, Math.PI * 2);
  g.fill();
  const half = (v: number, x0: number) => {
    for (const [px, py] of PIPS[v] ?? []) {
      const x = x0 + px * (W / 2);
      const y = py * H;
      const r = 22;
      const grd = g.createRadialGradient(x + 5, y + 6, 2, x, y, r);
      grd.addColorStop(0, "#4b3a2a");
      grd.addColorStop(0.6, "#1a120b");
      grd.addColorStop(1, "#0a0604");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      // reflet sur le bord du creux
      g.strokeStyle = "rgba(255,250,235,0.55)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, r + 1, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
    }
  };
  half(a, 0);
  half(b, W / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  faceCache.set(key, tex);
  return tex;
}

// ---------- la table ----------

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function Table() {
  const [felt, wood, rosette] = useLoader(THREE.TextureLoader, ["/assets/felt.webp", "/assets/wood.webp", "/assets/rosette.webp"]) as [
    THREE.Texture,
    THREE.Texture,
    THREE.Texture,
  ];
  const { feltGeo, rimGeo, inlayGeo } = useMemo(() => {
    felt.colorSpace = THREE.SRGBColorSpace;
    wood.colorSpace = THREE.SRGBColorSpace;
    rosette.colorSpace = THREE.SRGBColorSpace;
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(0.12, 0.3);
    const feltShape = roundedRect(FELT_W, FELT_D, 2.4);
    const feltGeo = new THREE.ShapeGeometry(feltShape, 24);
    // UV du feutre : on étire la photo sur toute la surface.
    const pos = feltGeo.attributes.position as THREE.BufferAttribute;
    const uv = new THREE.Float32BufferAttribute(pos.count * 2, 2);
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / FELT_W + 0.5, pos.getY(i) / FELT_D + 0.5);
    feltGeo.setAttribute("uv", uv);

    const outer = roundedRect(FELT_W + RIM * 2, FELT_D + RIM * 2, 2.4 + RIM);
    outer.holes.push(roundedRect(FELT_W, FELT_D, 2.4) as unknown as THREE.Path);
    const rimGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 6, curveSegments: 32 });

    const inlayOuter = roundedRect(FELT_W - 0.5, FELT_D - 0.5, 2.15);
    inlayOuter.holes.push(roundedRect(FELT_W - 0.58, FELT_D - 0.58, 2.11) as unknown as THREE.Path);
    const inlayGeo = new THREE.ShapeGeometry(inlayOuter, 32);
    return { feltGeo, rimGeo, inlayGeo };
  }, [felt, wood, rosette]);

  return (
    <group>
      <mesh geometry={feltGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial map={felt} roughness={0.95} color="#cfe8d6" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[6.4, 7.1]} />
        <meshStandardMaterial map={rosette} transparent opacity={0.42} roughness={0.6} metalness={0.4} depthWrite={false} />
      </mesh>
      <mesh geometry={inlayGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <meshStandardMaterial color="#e2b65c" metalness={0.9} roughness={0.3} emissive="#5a3c08" emissiveIntensity={0.4} />
      </mesh>
      <mesh geometry={rimGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <meshPhysicalMaterial map={wood} color="#ffffff" roughness={0.5} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>
      {/* le dessous de la table, pour qu'on ne voie pas à travers */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <planeGeometry args={[FELT_W + 2, FELT_D + 2]} />
        <meshBasicMaterial color="#120a05" />
      </mesh>
    </group>
  );
}

// ---------- les dominos ----------

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function Domino({ p, fresh, reducedMotion }: { p: Placement; fresh: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(fresh && !reducedMotion ? -1 : null);
  const tex = useMemo(() => faceTexture(p.a, p.b), [p.a, p.b]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || born.current === null) return;
    if (born.current < 0) born.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - born.current) / 0.24);
    // Il tombe d'un peu haut, légèrement penché, et claque à plat.
    g.position.y = TILE_H / 2 + (1 - ease(t)) * 2.2;
    g.rotation.z = (1 - ease(t)) * 0.35;
    const s = 1 + (1 - ease(t)) * 0.12;
    g.scale.set(s, s, s);
    // L'ombre se resserre et fonce à l'approche de la table.
    if (shadow.current) {
      const k = 1 + (1 - ease(t)) * 0.8;
      shadow.current.scale.set(k, k, k);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + ease(t) * 0.5;
    }
    if (t >= 1) {
      shadow.current?.scale.set(1, 1, 1);
      g.position.y = TILE_H / 2;
      g.rotation.z = 0;
      g.scale.set(1, 1, 1);
      born.current = null;
    }
  });
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
      <group position={[0, TILE_H / 2, 0]}>
        <BlobShadow shadowRef={shadow} />
      </group>
    <group ref={ref} position={[0, TILE_H / 2, 0]}>
      <mesh geometry={tileGeometry} material={ivory} />
      <mesh position={[0, TILE_H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.94, 0.94]} />
        <meshStandardMaterial map={tex} transparent roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
    </group>
  );
}

/** L'emplacement où le domino choisi peut aller : un fantôme doré qui respire. */
function Ghost({ x, z, rot, onPick }: { x: number; z: number; rot: number; onPick: () => void }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.35 + Math.sin(clock.elapsedTime * 5) * 0.15;
  });
  return (
    <mesh
      geometry={tileGeometry}
      position={[x, TILE_H / 2, z]}
      rotation={[0, rot, 0]}
      scale={[1.04, 0.6, 1.08]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <meshStandardMaterial ref={mat} color="#f6d68a" emissive="#d8a748" emissiveIntensity={1.4} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

// ---------- le mélange ----------

/** 28 dominos face cachée qui tournent au centre, puis partent vers chaque joueur. */
function Shuffle({ players, onDone }: { players: number; onDone: () => void }) {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const finished = useRef(false);
  const seeds = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        r: 0.6 + Math.random() * 2.6,
        a: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 6,
        speed: 2.2 + Math.random() * 1.6,
        seat: i % players,
      })),
    [players],
  );
  const seatDir = (seat: number) => {
    // 0 = moi (vers le bas de l'écran), puis dans le sens du jeu.
    const angle = players === 4 ? [Math.PI / 2, 0, -Math.PI / 2, Math.PI][seat] : [Math.PI / 2, -Math.PI / 2][seat];
    return { x: Math.cos(angle ?? 0), z: Math.sin(angle ?? 0) };
  };
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    g.children.forEach((child, i) => {
      const s = seeds[i];
      if (!s) return;
      if (t < 1.3) {
        // On mélange à plat, en rond, comme avec les deux mains.
        const a = s.a + t * s.speed;
        const r = s.r * (0.7 + 0.3 * Math.sin(t * 3 + i));
        child.position.set(Math.cos(a) * r, TILE_H / 2 + (i % 3) * 0.02, Math.sin(a) * r * 1.2);
        child.rotation.set(Math.PI, s.a + t * s.spin, 0);
      } else {
        const k = ease(Math.min(1, (t - 1.3) / 0.55));
        const d = seatDir(s.seat);
        child.position.x += (d.x * 7 - child.position.x) * k * 0.25;
        child.position.z += (d.z * 9 - child.position.z) * k * 0.25;
        const sc = 1 - k * 0.6;
        child.scale.set(sc, sc, sc);
      }
    });
    if (t > 1.95 && !finished.current) {
      finished.current = true;
      onDone();
    }
  });
  return (
    <group ref={group}>
      {seeds.map((_, i) => (
        <mesh key={i} geometry={tileGeometry} material={ivory} />
      ))}
    </group>
  );
}

// ---------- caméra ----------

/** Cadre la table selon la forme de l'écran : on voit toute la largeur du feutre. */
function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const halfW = FELT_W / 2 + RIM + 0.4;
    const dist = halfW / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * aspect);
    const tilt = THREE.MathUtils.degToRad(28); // angle depuis la verticale
    cam.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist + 0.6);
    cam.lookAt(0, 0, 0.6);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

// ---------- la scène ----------

function Scene({ chain, chainStart, targets, onPick, freshTile, shuffleKey, players, reducedMotion }: Props) {
  const { tiles, slots } = useMemo(() => layoutChain(chain, chainStart, LIMIT_X), [chain, chainStart]);
  const [shuffled, setShuffled] = useState<string | null>(null);
  const showShuffle = !reducedMotion && chain.length === 0 && shuffled !== shuffleKey;
  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.35} color="#ffe2b8" />
      <spotLight
        position={[1.5, 16, 3]}
        angle={0.62}
        penumbra={0.8}
        intensity={420}
        color="#ffd59a"
      />
      <pointLight position={[-7, 4, -6]} intensity={30} color="#ff9d4d" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffd7a0" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#ffb060" position={[-6, 3, -4]} scale={3} />
        <Lightformer form="rect" intensity={0.6} color="#2f8f63" position={[0, -2, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
      </Environment>

      <Table />

      {tiles.map((p) => (
        <Domino key={`${p.tile}`} p={p} fresh={p.tile === freshTile} reducedMotion={reducedMotion} />
      ))}
      {targets.map((end) =>
        chain.length === 0 ? (
          <Ghost key={end} x={0} z={0} rot={0} onPick={() => onPick(end)} />
        ) : (
          <Ghost key={end} x={slots[end].x} z={slots[end].z} rot={slots[end].rot} onPick={() => onPick(end)} />
        ),
      )}
      {showShuffle && (
        <Shuffle
          key={shuffleKey}
          players={players}
          onDone={() => setShuffled(shuffleKey)}
        />
      )}

      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={0.82} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
        <Vignette offset={0.32} darkness={0.62} />
      </EffectComposer>
    </>
  );
}

export default function Table3D(props: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 30, near: 0.5, far: 120, position: [0, 30, 14] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ touchAction: "manipulation" }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}
