"use client";

import type { End, PlacedTile } from "@icosium/shared";
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Stone, TILE_H, ivoryMaterial, stoneGeometry } from "./stone3d";
import { playShuffle } from "@/lib/sound";
import { CHAIN_HALF_W, CHAIN_SCALE, FELT_D, FELT_W, type Bounds, type Placement, layoutChain } from "@/lib/chain-layout";

/*
 * La table de domino en 3D : feutre vert, rebord en noyer verni, filet doré, rosette,
 * dominos ivoire en relief éclairés par la lampe du café. Les règles restent sur le serveur :
 * cette scène ne fait qu'afficher la chaîne publique et renvoyer le bout choisi.
 */

const RIM = 0.75; // épaisseur du rebord

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
  /** Bouts où je peux jouer (mon tour) : un halo doré les signale. */
  glowEnds: End[];
  /** Téléphone en paysage : la table est tournée pour que sa longueur suive l'écran. */
  landscape?: boolean;
};

// ---------- matériaux partagés ----------

const tileGeometry = stoneGeometry();
const ivory = ivoryMaterial();

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

/** Halo doré flou (dernière pierre posée, bouts jouables). */
let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.filter = "blur(16px)";
  g.fillStyle = "rgba(255,214,130,1)";
  g.beginPath();
  g.roundRect(40, 40, 176, 80, 26);
  g.fill();
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function Glow({ meshRef, opacity }: { meshRef?: React.Ref<THREE.Mesh>; opacity: number }) {
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={2}>
      <planeGeometry args={[3.3, 2.1]} />
      <meshBasicMaterial map={glowTexture()} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/** Un bout de la chaîne où je peux jouer : un halo doré qui respire sous la pierre. */
function EndHalo({ p }: { p: Placement }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.2;
  });
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
      <Glow meshRef={ref} opacity={0.5} />
    </group>
  );
}

function BlobShadow({ shadowRef }: { shadowRef?: React.Ref<THREE.Mesh> }) {
  return (
    <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0.12, -TILE_H / 2 + 0.008, 0.16]} renderOrder={1}>
      <planeGeometry args={[2.7, 1.45]} />
      <meshBasicMaterial map={shadowTexture()} transparent opacity={0.75} depthWrite={false} />
    </mesh>
  );
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
    </group>
  );
}

// ---------- les dominos ----------

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function Domino({ p, fresh, reducedMotion }: { p: Placement; fresh: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(fresh && !reducedMotion ? -1 : null);
  // La dernière pierre posée brille un instant, puis s'éteint (1,6 s).
  const glowStart = useRef<number | null>(fresh ? -1 : null);
  useFrame(({ clock }) => {
    const m = glow.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!m || glowStart.current === null) return;
    if (glowStart.current < 0) glowStart.current = clock.elapsedTime;
    const t = (clock.elapsedTime - glowStart.current) / 1.6;
    m.opacity = t >= 1 ? 0 : 0.85 * (1 - t);
    if (t >= 1) glowStart.current = null;
  });
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
      {fresh && <Glow meshRef={glow} opacity={0} />}
    <group ref={ref} position={[0, TILE_H / 2, 0]}>
      <Stone a={p.a} b={p.b} />
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

/**
 * Le mélange, comme au café : les 28 pierres face cachée tournent à plat au centre (deux mains),
 * puis chaque joueur tire ses 7 pierres, alignées bien droites devant lui, qui glissent vers lui.
 * Ce qui reste (la pioche, à deux joueurs) se range en tas au milieu et s'efface.
 */
const SWIRL = 1.15; // fin du mélange (s)
const LINE_UP = 1.55; // les pierres sont alignées devant chaque joueur
const DONE = 2.05;

function Shuffle({ players, onDone }: { players: number; onDone: () => void }) {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const finished = useRef(false);
  useEffect(() => playShuffle(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        r: 0.7 + Math.random() * 1.9,
        a: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 4,
        speed: 1.6 + Math.random() * 1.2,
        // Les 7 premières pierres de chaque joueur ; à deux, le reste est la pioche.
        seat: i < players * 7 ? i % players : -1,
        slot: Math.floor(i / players),
      })),
    [players],
  );
  // 0 = moi (vers le bas de l'écran), puis les autres autour de la table.
  const seatDir = (seat: number) => {
    const angle = players === 4 ? [Math.PI / 2, 0, -Math.PI / 2, Math.PI][seat] : [Math.PI / 2, -Math.PI / 2][seat];
    return { x: Math.cos(angle ?? 0), z: Math.sin(angle ?? 0) };
  };
  const swirlAt = (s: (typeof seeds)[number], t: number, i: number) => {
    const a = s.a + t * s.speed;
    const r = s.r * (0.8 + 0.2 * Math.sin(t * 3 + i));
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, rot: s.a + t * s.spin };
  };
  const lineAt = (s: (typeof seeds)[number], i: number) => {
    if (s.seat < 0) return { x: ((i % 4) - 1.5) * 0.25, z: ((i % 3) - 1) * 0.2, rot: 0.1 * (i % 5) };
    const d = seatDir(s.seat);
    const k = s.slot - 3;
    // Rangée de 7 pierres côte à côte, chacune pointée vers son joueur.
    return { x: d.x * 3.3 - d.z * k * 1.1, z: d.z * 3.3 + d.x * k * 1.1, rot: Math.atan2(-d.z, d.x) };
  };
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    g.children.forEach((child, i) => {
      const s = seeds[i];
      if (!s) return;
      let x: number;
      let z: number;
      let rot: number;
      let scale = 1;
      if (t < SWIRL) {
        ({ x, z, rot } = swirlAt(s, t, i));
      } else if (t < LINE_UP) {
        const k = ease((t - SWIRL) / (LINE_UP - SWIRL));
        const from = swirlAt(s, SWIRL, i);
        const to = lineAt(s, i);
        x = from.x + (to.x - from.x) * k;
        z = from.z + (to.z - from.z) * k;
        rot = from.rot + (to.rot - from.rot) * k;
      } else {
        const k = ease(Math.min(1, (t - LINE_UP) / (DONE - LINE_UP)));
        ({ x, z, rot } = lineAt(s, i));
        if (s.seat >= 0) {
          const d = seatDir(s.seat);
          x += d.x * 3.2 * k;
          z += d.z * 3.2 * k;
        }
        scale = 1 - k * 0.7;
      }
      child.position.set(x, TILE_H / 2 + (t < SWIRL ? (i % 3) * 0.015 : 0), z);
      // Face cachée (retournée) ; l'angle est inversé par le retournement.
      child.rotation.set(Math.PI, -rot, 0);
      child.scale.setScalar(scale);
    });
    if (t > DONE && !finished.current) {
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

const TILT = THREE.MathUtils.degToRad(28); // angle de la caméra depuis la verticale

/** Place la caméra à `dist` de la table, en visant le point (0, 0, z). */
function aim(cam: THREE.PerspectiveCamera, dist: number, z: number) {
  cam.position.set(0, Math.cos(TILT) * dist, Math.sin(TILT) * dist + z);
  cam.lookAt(0, 0, z);
  cam.updateMatrixWorld(true);
}

/** Marges à l'écran (en fraction de demi-écran) : en haut, on laisse la place aux joueurs posés sur la table. */
type Margins = { x: number; top: number; bottom: number };

/** Tous ces points sont-ils visibles, avec la marge ? (calcul exact, perspective comprise) */
function fits(cam: THREE.PerspectiveCamera, pts: THREE.Vector3[], m: Margins): boolean {
  const v = new THREE.Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    if (Math.abs(v.x) > 1 - m.x || v.y > 1 - m.top || v.y < -1 + m.bottom) return false;
  }
  return true;
}

/** La plus petite distance où tous les points tiennent à l'écran (recherche par dichotomie). */
function fitDistance(cam: THREE.PerspectiveCamera, pts: THREE.Vector3[], z: number, m: Margins): number {
  let lo = 2;
  let hi = 90;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    aim(cam, mid, z);
    if (fits(cam, pts, m)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Les 8 coins d'une boîte posée sur la table (repère local), tournés autour de la verticale. */
function corners(minX: number, maxX: number, minZ: number, maxZ: number, height: number, rotY: number, scale = 1): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const rot = new THREE.Matrix4().makeRotationY(rotY);
  for (const x of [minX, maxX])
    for (const z of [minZ, maxZ])
      for (const y of [0, height]) out.push(new THREE.Vector3(x * scale, y * scale, z * scale).applyMatrix4(rot));
  return out;
}

/**
 * La caméra regarde toujours le centre de la table, sans jamais se décaler. En début de manche
 * elle est proche (les pierres sont grandes et lisibles), puis elle recule lentement, seulement
 * quand la chaîne approche du bord de l'écran. Elle ne se rapproche jamais en cours de manche :
 * pas d'effet de zoom qui va et vient. Au plus loin, toute la table (rebord compris) est visible.
 */
function CameraRig({ bounds, chainLength, tableRot, chainRot, margins }: { bounds: Bounds; chainLength: number; tableRot: number; chainRot: number; margins: Margins }) {
  const { camera, size } = useThree();
  const current = useRef<{ dist: number; z: number } | null>(null);
  const farthest = useRef<{ dist: number; length: number }>({ dist: 0, length: 0 });
  const table = useMemo(() => {
    const cam = (camera as THREE.PerspectiveCamera).clone();
    cam.aspect = size.width / Math.max(size.height, 1);
    cam.updateProjectionMatrix();
    const tableHalfW = FELT_W / 2 + RIM + 0.2;
    const tableHalfD = FELT_D / 2 + RIM + 0.2;
    const pts = corners(-tableHalfW, tableHalfW, -tableHalfD, tableHalfD, 0.35, tableRot);
    // Le point visé qui donne la plus grande table à l'écran.
    let best = { dist: Number.POSITIVE_INFINITY, z: 0 };
    for (let z = -1.5; z <= 1.5; z += 0.25) {
      const dist = fitDistance(cam, pts, z, margins);
      if (dist < best.dist) best = { dist, z };
    }
    return { ...best, cam };
  }, [camera, size.width, size.height, tableRot, margins]);
  const wanted = useMemo(() => {
    // Toute la chaîne, plus une marge pour la prochaine pierre.
    const pad = 1.8;
    const pts = corners(bounds.minX - pad, bounds.maxX + pad, bounds.minZ - pad, bounds.maxZ + pad, TILE_H, chainRot, CHAIN_SCALE);
    const need = fitDistance(table.cam, pts, table.z, margins);
    return THREE.MathUtils.clamp(need, table.dist * 0.5, table.dist);
  }, [bounds, chainRot, table, margins]);
  useFrame((_, dt) => {
    // Nouvelle manche (la chaîne repart de zéro) : on peut se rapprocher à nouveau.
    const f = farthest.current;
    if (chainLength < f.length) f.dist = 0;
    f.length = chainLength;
    f.dist = Math.max(f.dist, wanted);
    const cam = camera as THREE.PerspectiveCamera;
    const cur = current.current ?? { dist: f.dist, z: table.z };
    const k = 1 - Math.exp(-dt / 0.3);
    cur.dist += (f.dist - cur.dist) * k;
    cur.z += (table.z - cur.z) * k;
    current.current = cur;
    aim(cam, cur.dist, cur.z);
  });
  useEffect(() => {
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

// ---------- la scène ----------

const PORTRAIT_MARGINS: Margins = { x: 0.02, top: 0.24, bottom: 0.02 };
const LANDSCAPE_MARGINS: Margins = { x: 0.02, top: 0.1, bottom: 0.01 };

function Scene({ chain, chainStart, targets, onPick, freshTile, shuffleKey, players, reducedMotion, glowEnds, landscape = false }: Props) {
  // Portrait : la table est en long et la chaîne tournée d'un quart de tour pour suivre sa longueur.
  // Paysage : on tourne la table ; la chaîne court alors dans la largeur de l'écran.
  const tableRot = landscape ? Math.PI / 2 : 0;
  const chainRot = landscape ? 0 : Math.PI / 2;
  const { tiles, slots, bounds } = useMemo(() => layoutChain(chain, chainStart, CHAIN_HALF_W), [chain, chainStart]);
  const endTile = (end: End) => tiles.find((t) => t.index === (end === "left" ? 0 : chain.length - 1));
  const [shuffled, setShuffled] = useState<string | null>(null);
  const showShuffle = !reducedMotion && chain.length === 0 && shuffled !== shuffleKey;
  return (
    <>
      <CameraRig bounds={bounds} chainLength={chain.length} tableRot={tableRot} chainRot={chainRot} margins={landscape ? LANDSCAPE_MARGINS : PORTRAIT_MARGINS} />
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

      <group rotation={[0, tableRot, 0]}>
        <Table />
      </group>

      {/* La chaîne, un peu plus petite et tournée d'un quart de tour : ses rangées suivent la longueur du feutre. */}
      <group scale={[CHAIN_SCALE, CHAIN_SCALE, CHAIN_SCALE]} rotation={[0, chainRot, 0]}>
        {tiles.map((p) => (
          <Domino key={`${p.tile}`} p={p} fresh={p.tile === freshTile} reducedMotion={reducedMotion} />
        ))}
        {targets.length === 0 &&
          chain.length > 0 &&
          [...new Set(glowEnds)].map((end) => {
            const p = endTile(end);
            return p ? <EndHalo key={end} p={p} /> : null;
          })}
        {targets.map((end) =>
          chain.length === 0 ? (
            <Ghost key={end} x={0} z={0} rot={0} onPick={() => onPick(end)} />
          ) : (
            <Ghost key={end} x={slots[end].x} z={slots[end].z} rot={slots[end].rot} onPick={() => onPick(end)} />
          ),
        )}
      </group>
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
