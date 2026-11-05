"use client";

import type { End, PlacedTile } from "@icosium/shared";
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Stone, TILE_H, ivoryMaterial, stoneGeometry } from "./stone3d";
import { useI18n } from "@/lib/i18n";
import { playShuffle } from "@/lib/sound";
import { drawCardboard, drawCardboardBump, drawPlastic, seeded } from "@/lib/street-textures";
import { CHAIN_HALF_W, CHAIN_SCALE, FELT_D, FELT_W, type Placement, layoutChain } from "@/lib/chain-layout";

/*
 * La table de domino en 3D, comme dans la rue le soir : un carton déchiré posé sur une table de
 * jardin en plastique, sur le goudron, sous un lampadaire. Dominos blancs à points noirs. Les règles restent sur le serveur :
 * cette scène ne fait qu'afficher la chaîne publique et renvoyer le bout choisi.
 */

const RIM = 1.45; // la table de jardin dépasse du carton de tant

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
  g.fillStyle = "rgba(6,5,4,0.85)";
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

/**
 * Contour du carton déchiré : on longe chaque bord en reculant d'un peu au hasard (bord mâché),
 * avec quelques vraies déchirures plus profondes et un coin arraché.
 * `out` > 0 donne un contour un peu plus grand (la couche claire du papier arraché, dessous).
 */
function tornOutline(w: number, d: number, seed: number, out: number): THREE.Shape {
  const rnd = seeded(seed);
  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  const pts: [number, number][] = [];
  corners.forEach(([x0, y0], side) => {
    const [x1, y1] = corners[(side + 1) % 4] as [number, number];
    const len = Math.hypot(x1 - x0, y1 - y0);
    // Normale vers l'intérieur.
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const steps = Math.round(len / 0.16);
    const phase = rnd() * 10;
    // Une ou deux déchirures profondes par côté.
    const bites = Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => ({ at: 0.15 + rnd() * 0.7, half: 0.04 + rnd() * 0.07, depth: 0.25 + rnd() * 0.35 }));
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      // Le coin arraché (en haut à droite).
      const corner = side === 1 && t < 0.12 ? (0.12 - t) * 9 : side === 0 && t > 0.9 ? (t - 0.9) * 9 : 0;
      let inset = 0.08 + 0.06 * Math.sin(t * 23 + phase) + 0.04 * Math.sin(t * 61 + phase * 2) + rnd() * 0.07 + corner;
      for (const b of bites) {
        const k = 1 - Math.abs(t - b.at) / b.half;
        if (k > 0) inset += b.depth * Math.sqrt(k) * (0.7 + rnd() * 0.3);
      }
      inset = Math.max(0, inset - out);
      pts.push([x0 + (x1 - x0) * t + nx * inset, y0 + (y1 - y0) * t + ny * inset]);
    }
  });
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

const CARD_W = FELT_W + 0.5;
const CARD_D = FELT_D + 0.5;
const CARD_T = 0.1; // épaisseur du carton
const TOP_W = FELT_W + 2.6; // la table de jardin
const TOP_D = FELT_D + 2.6;
const TOP_Y = -CARD_T - 0.01;
const GROUND_Y = -9;

function canvasTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Le carton déchiré, posé de travers sur la table de jardin en plastique. Le goudron autour est le fond de l'écran (street-bg). */
function Table() {
  const parts = useMemo(() => {
    const card = canvasTexture(drawCardboard(CARD_W, CARD_D));
    // Les UV du dessus d'un ExtrudeGeometry sont les coordonnées du plan : on les ramène à 0..1.
    card.repeat.set(1 / CARD_W, 1 / CARD_D);
    card.offset.set(0.5, 0.5);
    const bump = canvasTexture(drawCardboardBump(), false);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(1 / 4, 1 / 4);
    const cardGeo = new THREE.ExtrudeGeometry(tornOutline(CARD_W, CARD_D, 11, 0), { depth: CARD_T, bevelEnabled: false });
    // Sous le bord, la couche claire et fibreuse du papier arraché dépasse un peu.
    const fiberGeo = new THREE.ShapeGeometry(tornOutline(CARD_W, CARD_D, 11, 0.07));

    const plastic = canvasTexture(drawPlastic());
    plastic.wrapS = plastic.wrapT = THREE.RepeatWrapping;
    plastic.repeat.set(1 / 6, 1 / 6);
    const topGeo = new THREE.ExtrudeGeometry(roundedRect(TOP_W, TOP_D, 1.1), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 4, curveSegments: 20 });
    // Le petit rebord moulé tout autour du plateau.
    const lip = roundedRect(TOP_W, TOP_D, 1.1);
    lip.holes.push(roundedRect(TOP_W - 0.5, TOP_D - 0.5, 0.9) as unknown as THREE.Path);
    const lipGeo = new THREE.ExtrudeGeometry(lip, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 20 });

    return { card, bump, cardGeo, fiberGeo, plastic, topGeo, lipGeo };
  }, []);

  return (
    <group>
      {/* Le carton, un peu de travers comme posé à la main. */}
      <group rotation={[0, 0.025, 0]}>
        <mesh geometry={parts.cardGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -CARD_T, 0]}>
          <meshStandardMaterial attach="material-0" map={parts.card} bumpMap={parts.bump} bumpScale={0.6} roughness={0.96} />
          <meshStandardMaterial attach="material-1" color="#8f6c42" roughness={1} />
        </mesh>
        <mesh geometry={parts.fiberGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -CARD_T + 0.004, 0]}>
          <meshStandardMaterial color="#e6d3ad" roughness={1} />
        </mesh>
      </group>
      {/* La table de jardin en plastique blanc. */}
      <mesh geometry={parts.topGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, TOP_Y - 0.42, 0]}>
        <meshPhysicalMaterial attach="material-0" map={parts.plastic} roughness={0.42} clearcoat={0.35} clearcoatRoughness={0.4} />
        <meshPhysicalMaterial attach="material-1" color="#e9e8e3" roughness={0.45} clearcoat={0.3} />
      </mesh>
      <mesh geometry={parts.lipGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, TOP_Y, 0]}>
        <meshPhysicalMaterial color="#f3f2ee" roughness={0.4} clearcoat={0.4} />
      </mesh>
      {/* Les pieds, qui s'écartent vers le sol. */}
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[(sx ?? 0) * (TOP_W / 2 - 1.2), (TOP_Y + GROUND_Y) / 2 - 0.3, (sz ?? 0) * (TOP_D / 2 - 1.2)]} rotation={[(sz ?? 0) * -0.08, 0, (sx ?? 0) * 0.08]}>
          <boxGeometry args={[0.9, -GROUND_Y - 0.6, 0.9]} />
          <meshStandardMaterial color="#d9d8d3" roughness={0.5} />
        </mesh>
      ))}
      {/* L'ombre de la table sur le goudron, poussée par le lampadaire. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.6, GROUND_Y + 0.02, 1.4]}>
        <planeGeometry args={[TOP_W * 1.5, TOP_D * 1.4]} />
        <meshBasicMaterial map={shadowTexture()} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------- les dominos ----------

/** Petit décalage fixe d'une pierre, tiré de son nom : moins de 3° et de 4 % de sa largeur. */
function handJitter(tile: string): { rot: number; dx: number; dz: number } {
  let h = 0;
  for (const ch of tile) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = seeded(h + 1);
  return { rot: (rnd() - 0.5) * 0.09, dx: (rnd() - 0.5) * 0.06, dz: (rnd() - 0.5) * 0.06 };
}

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
  // Posée à la main : chaque pierre est un peu de travers (toujours le même angle pour la même pierre).
  const j = useMemo(() => handJitter(p.tile), [p.tile]);
  return (
    <group position={[p.x + j.dx, 0, p.z + j.dz]} rotation={[0, p.rot + j.rot, 0]}>
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

/** Place la caméra à `dist` de la table, en visant le point (x, 0, z). */
function aim(cam: THREE.PerspectiveCamera, dist: number, z: number, x = 0) {
  cam.position.set(x, Math.cos(TILT) * dist, Math.sin(TILT) * dist + z);
  cam.lookAt(x, 0, z);
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
function fitDistance(cam: THREE.PerspectiveCamera, pts: THREE.Vector3[], z: number, m: Margins, x = 0): number {
  let lo = 2;
  let hi = 90;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    aim(cam, mid, z, x);
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

/** Taille voulue d'une pierre de la chaîne à l'écran (petit côté, en pixels CSS) : comme dans la main. */
const TILE_PX = 40;

/**
 * La caméra suit le jeu de près, pour que les pierres soient grosses comme celles de la main :
 * - pendant le tour des autres, elle glisse doucement vers la dernière pierre posée ;
 * - à mon tour, elle cadre les bouts où je peux jouer (et recule juste assez s'ils sont loin) ;
 * - « vue d'ensemble » (bouton, double-tap ou deux doigts) : toute la table, rebord compris.
 * Les mouvements sont lents et amortis (pas d'à-coups).
 */
function CameraRig({ focus, overview, tableRot, chainRot, margins }: { focus: { x: number; z: number }[]; overview: boolean; tableRot: number; chainRot: number; margins: Margins }) {
  const { camera, size } = useThree();
  const current = useRef<{ dist: number; x: number; z: number } | null>(null);
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
    // Distance où une pierre de la chaîne fait TILE_PX de large à l'écran.
    const fov = THREE.MathUtils.degToRad(cam.fov);
    const close = (CHAIN_SCALE * size.height) / (2 * Math.tan(fov / 2) * TILE_PX);
    return { ...best, close: Math.min(close, best.dist), cam };
  }, [camera, size.width, size.height, tableRot, margins]);
  const wanted = useMemo(() => {
    const whole = { dist: table.dist, x: 0, z: table.z };
    if (overview || focus.length === 0) return whole;
    const rot = new THREE.Matrix4().makeRotationY(chainRot);
    const world = focus.map((f) => new THREE.Vector3(f.x * CHAIN_SCALE, 0, f.z * CHAIN_SCALE).applyMatrix4(rot));
    const cx = world.reduce((s, v) => s + v.x, 0) / world.length;
    const cz = world.reduce((s, v) => s + v.z, 0) / world.length;
    // Chaque point compte avec une pierre autour (plus un peu d'air).
    const pad = 1.6;
    const pts = focus.flatMap((f) => corners(f.x - pad, f.x + pad, f.z - pad, f.z + pad, TILE_H, chainRot, CHAIN_SCALE));
    const need = fitDistance(table.cam, pts, cz, margins, cx);
    const dist = THREE.MathUtils.clamp(need, table.close, table.dist);
    // Si tout ne tient qu'en reculant au maximum, on montre toute la table, bien centrée.
    if (need >= table.dist) return whole;
    return { dist, x: cx, z: cz };
  }, [focus, overview, chainRot, table, margins]);
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const cur = current.current ?? { ...wanted };
    const k = 1 - Math.exp(-dt / 0.45);
    cur.dist += (wanted.dist - cur.dist) * k;
    cur.x += (wanted.x - cur.x) * k;
    cur.z += (wanted.z - cur.z) * k;
    current.current = cur;
    aim(cam, cur.dist, cur.z, cur.x);
  });
  useEffect(() => {
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

// ---------- la scène ----------

const PORTRAIT_MARGINS: Margins = { x: 0.02, top: 0.24, bottom: 0.02 };
const LANDSCAPE_MARGINS: Margins = { x: 0.02, top: 0.18, bottom: 0.01 };

function Scene({ chain, chainStart, targets, onPick, freshTile, shuffleKey, players, reducedMotion, glowEnds, landscape = false, overview }: Props & { overview: boolean }) {
  // Portrait : la table est en long et la chaîne tournée d'un quart de tour pour suivre sa longueur.
  // Paysage : on tourne la table ; la chaîne court alors dans la largeur de l'écran.
  const tableRot = landscape ? Math.PI / 2 : 0;
  const chainRot = landscape ? 0 : Math.PI / 2;
  const { tiles, slots } = useMemo(() => layoutChain(chain, chainStart, CHAIN_HALF_W), [chain, chainStart]);
  const endTile = (end: End) => tiles.find((t) => t.index === (end === "left" ? 0 : chain.length - 1));
  // Ce que la caméra suit : les bouts où poser la pierre choisie, sinon mes bouts jouables,
  // sinon la dernière pierre posée.
  const focusKey = `${chain.length}|${targets.join()}|${[...new Set(glowEnds)].join()}|${freshTile ?? ""}`;
  const focus = useMemo(() => {
    if (chain.length === 0) return [];
    if (targets.length > 0) return targets.map((e) => ({ x: slots[e].x, z: slots[e].z }));
    const at = (end: End) => {
      const p = endTile(end);
      return p ? [{ x: p.x, z: p.z }] : [];
    };
    if (glowEnds.length > 0) return [...new Set(glowEnds)].flatMap(at);
    const fresh = tiles.find((t) => t.tile === freshTile);
    if (fresh) return [{ x: fresh.x, z: fresh.z }];
    return [...at("left"), ...at("right")];
  }, [focusKey, tiles, slots]);
  const [shuffled, setShuffled] = useState<string | null>(null);
  const showShuffle = !reducedMotion && chain.length === 0 && shuffled !== shuffleKey;
  return (
    <>
      <CameraRig focus={focus} overview={overview} tableRot={tableRot} chainRot={chainRot} margins={landscape ? LANDSCAPE_MARGINS : PORTRAIT_MARGINS} />
      {/* La nuit : un peu de bleu partout, et le lampadaire qui éclaire la table d'un côté. */}
      <hemisphereLight args={["#b4c4e0", "#1a1714", 0.75]} />
      <spotLight position={[-6, 22, -5]} angle={0.55} penumbra={0.9} intensity={520} decay={2} color="#fff3e2" />
      <pointLight position={[8, 5, 9]} intensity={18} color="#7f9cd0" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2} color="#ffe2b4" position={[-3, 7, -2]} rotation-x={Math.PI / 2} scale={[8, 5, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#8fa8d8" position={[6, 3, 5]} scale={3} />
        <Lightformer form="rect" intensity={0.25} color="#3a3836" position={[0, -2, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
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
        <Bloom luminanceThreshold={0.96} luminanceSmoothing={0.1} intensity={0.35} mipmapBlur />
        <Vignette offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

/** Loupe : « voir toute la table » / « suivre le jeu de près ». */
function ViewIcon({ overview }: { overview: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {overview ? (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2M11 8v6M8 11h6" />
        </>
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  );
}

export default function Table3D(props: Props) {
  const { t } = useI18n();
  // Vue d'ensemble : bouton, ou pincer à deux doigts (rapprocher = tout voir, écarter = de près).
  const [overview, setOverview] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<number | null>(null);
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const release = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };
  return (
    <div
      className="relative h-full w-full"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) pinchStart.current = spread();
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const start = pinchStart.current;
        if (start === null) return;
        const d = spread() - start;
        if (Math.abs(d) > 40) {
          setOverview(d < 0);
          pinchStart.current = spread();
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.5, far: 120, position: [0, 30, 14] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Suspense fallback={null}>
          <Scene {...props} overview={overview} />
        </Suspense>
      </Canvas>
      {props.chain.length > 0 && (
        <button
          type="button"
          aria-pressed={overview}
          aria-label={t(overview ? "domino.viewFollow" : "domino.viewAll")}
          title={t(overview ? "domino.viewFollow" : "domino.viewAll")}
          onClick={() => setOverview((v) => !v)}
          className="cafe-panel absolute end-2 bottom-2 z-10 flex size-11 items-center justify-center rounded-full text-gold-light transition-transform duration-200 active:scale-95"
        >
          <ViewIcon overview={overview} />
        </button>
      )}
    </div>
  );
}
