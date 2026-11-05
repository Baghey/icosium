"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Une pierre de domino en 3D, dessinée maison :
 * - un bloc d'ivoire épais aux arêtes bien arrondies, au grain d'os très léger, verni ;
 * - des points creusés (vrai relief grâce à une carte de hauteur), noirs et brillants au fond ;
 * - un trait central gravé et un clou en laiton en relief.
 * Tout est généré au premier affichage (aucune image à télécharger).
 */

export const TILE_H = 0.4; // épaisseur d'une pierre (une largeur = 1, une longueur = 2)
const RADIUS = 0.15;

let geometry: THREE.BufferGeometry | null = null;
export function stoneGeometry(): THREE.BufferGeometry {
  geometry ??= new RoundedBoxGeometry(2, TILE_H, 1, 6, RADIUS);
  return geometry;
}

/** Un léger grain d'os : taches douces et fines veines dans le sens de la longueur. */
function drawGrain(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = "#f7efdd";
  g.fillRect(0, 0, W, H);
  // Pseudo-hasard fixe : toutes les pierres ont le même grain, d'un écran à l'autre.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 20 + rnd() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const warm = rnd() > 0.5;
    grd.addColorStop(0, warm ? "rgba(214,190,140,0.025)" : "rgba(255,253,245,0.06)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const y = rnd() * H;
    g.strokeStyle = `rgba(190,165,115,${0.012 + rnd() * 0.018})`;
    g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath();
    g.moveTo(-10, y);
    g.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 14, W * 0.7, y + (rnd() - 0.5) * 14, W + 10, y + (rnd() - 0.5) * 8);
    g.stroke();
  }
}

function grainTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  drawGrain(c.getContext("2d") as CanvasRenderingContext2D, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let ivoryMat: THREE.MeshPhysicalMaterial | null = null;
/** L'ivoire verni de la pierre. */
export function ivoryMaterial(): THREE.MeshPhysicalMaterial {
  ivoryMat ??= new THREE.MeshPhysicalMaterial({
    color: "#fffaf0",
    map: grainTexture(),
    roughness: 0.4,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.6,
    sheen: 0.4,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#fff1d6"),
    specularIntensity: 0.4,
  });
  return ivoryMat;
}

let brassMat: THREE.MeshStandardMaterial | null = null;
function brassMaterial(): THREE.MeshStandardMaterial {
  brassMat ??= new THREE.MeshStandardMaterial({ color: "#e0b04f", metalness: 1, roughness: 0.22, emissive: "#3a2504", emissiveIntensity: 0.35 });
  return brassMat;
}
let pinGeo: THREE.BufferGeometry | null = null;
function pinGeometry(): THREE.BufferGeometry {
  // Un petit dôme (demi-sphère aplatie) pour attraper la lumière.
  pinGeo ??= new THREE.SphereGeometry(0.095, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1);
  return pinGeo;
}

/** Positions des points dans une moitié (carré 0..1). */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

/** Face visible : la zone plate du dessus (sans les arêtes arrondies). */
const FACE_W = 2 - 2 * RADIUS;
const FACE_D = 1 - 2 * RADIUS;

type Face = { color: THREE.CanvasTexture; bump: THREE.CanvasTexture; pips: THREE.CanvasTexture };
const faces = new Map<string, Face>();

/**
 * Dessine la face a|b deux fois : en couleur (points noirs brillants, trait gravé) et en hauteur
 * (blanc = surface, noir = creux) pour que la lumière creuse vraiment les points.
 */
function face(a: number, b: number): Face {
  const key = `${a}-${b}`;
  const hit = faces.get(key);
  if (hit) return hit;
  const W = 1024;
  const H = Math.round((W * FACE_D) / FACE_W);
  const half = W / 2;
  const R = H * 0.14; // rayon d'un point (gros points, comme sur les pierres de la main)
  const make = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return [c, c.getContext("2d") as CanvasRenderingContext2D] as const;
  };
  const [cc, g] = make();
  const [bc, h] = make();
  // Les points, seuls sur fond transparent : posés par-dessus sans éclairage, ils restent d'un noir
  // franc quel que soit le reflet de la lampe (comme sur les pierres de la main).
  const [pc, q] = make();
  h.fillStyle = "#fff";
  h.fillRect(0, 0, W, H);
  // Même ivoire que le reste de la pierre, pour que la face ne se voie pas comme une étiquette.
  drawGrain(g, W, H);

  const pipsOf = (v: number, x0: number) =>
    // Quart de tour : les rangées de trois points suivent la longueur de la pierre, comme sur un vrai domino.
    (PIPS[v] ?? []).map(([px, py]) => [x0 + (0.04 + py * 0.92) * half, (0.02 + (1 - px) * 0.96) * H] as const);
  const all = [...pipsOf(a, 0), ...pipsOf(b, half)];

  for (const [x, y] of all) {
    const ink = q.createRadialGradient(x - R * 0.25, y - R * 0.3, R * 0.1, x, y, R);
    ink.addColorStop(0, "#2a1d12");
    ink.addColorStop(0.7, "#0c0805");
    ink.addColorStop(1, "#020100");
    q.fillStyle = ink;
    q.beginPath();
    q.arc(x, y, R, 0, Math.PI * 2);
    q.fill();
    // Le reflet de la paroi éclairée, comme sur le dessin de la main.
    q.strokeStyle = "rgba(255,233,196,0.5)";
    q.lineCap = "round";
    q.lineWidth = R * 0.14;
    q.beginPath();
    q.arc(x, y, R * 0.76, Math.PI * 0.05, Math.PI * 0.55);
    q.stroke();
    // Couleur : le fond du creux, presque noir, avec une lueur chaude en bas à droite (la paroi éclairée).
    const body = g.createRadialGradient(x - R * 0.25, y - R * 0.3, R * 0.1, x, y, R);
    body.addColorStop(0, "#1c140c");
    body.addColorStop(0.7, "#0a0604");
    body.addColorStop(1, "#000000");
    g.fillStyle = body;
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,236,200,0.55)";
    g.lineWidth = R * 0.12;
    g.beginPath();
    g.arc(x, y, R * 0.8, Math.PI * 0.05, Math.PI * 0.6);
    g.stroke();
    // Ombre douce sur le bord haut-gauche du creux (le rebord cache la lumière).
    g.strokeStyle = "rgba(60,40,20,0.35)";
    g.lineWidth = R * 0.18;
    g.beginPath();
    g.arc(x, y, R * 1.06, Math.PI * 1.05, Math.PI * 1.7);
    g.stroke();
    // Hauteur : un creux en cuvette.
    const cup = h.createRadialGradient(x, y, 0, x, y, R * 1.08);
    cup.addColorStop(0, "#000");
    cup.addColorStop(0.72, "#222");
    cup.addColorStop(0.92, "#aaa");
    cup.addColorStop(1, "#fff");
    h.fillStyle = cup;
    h.beginPath();
    h.arc(x, y, R * 1.08, 0, Math.PI * 2);
    h.fill();
  }

  // Le trait central gravé (sombre, avec un liseré clair), interrompu par le clou.
  const top = H * 0.1;
  const bottom = H * 0.9;
  const gap = H * 0.11;
  for (const [y0, y1] of [
    [top, H / 2 - gap],
    [H / 2 + gap, bottom],
  ] as const) {
    g.lineCap = "round";
    g.strokeStyle = "rgba(80,60,34,0.95)";
    g.lineWidth = W * 0.007;
    g.beginPath();
    g.moveTo(half, y0);
    g.lineTo(half, y1);
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.65)";
    g.lineWidth = W * 0.003;
    g.beginPath();
    g.moveTo(half + W * 0.006, y0);
    g.lineTo(half + W * 0.006, y1);
    g.stroke();
    h.lineCap = "round";
    h.strokeStyle = "#555";
    h.lineWidth = W * 0.008;
    h.beginPath();
    h.moveTo(half, y0);
    h.lineTo(half, y1);
    h.stroke();
  }

  const color = new THREE.CanvasTexture(cc);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  const bump = new THREE.CanvasTexture(bc);
  bump.anisotropy = 8;
  const pips = new THREE.CanvasTexture(pc);
  pips.colorSpace = THREE.SRGBColorSpace;
  pips.anisotropy = 16;
  const out = { color, bump, pips };
  faces.set(key, out);
  return out;
}

/** La pierre posée à plat, face visible (le groupe est centré sur la pierre). */
export function Stone({ a, b }: { a: number; b: number }) {
  const material = useMemo(() => {
    const f = face(a, b);
    return new THREE.MeshPhysicalMaterial({
      map: f.color,
      bumpMap: f.bump,
      bumpScale: 0.9,
      color: "#fffaf0",
      roughness: 0.4,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.6,
      sheen: 0.4,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#fff1d6"),
      specularIntensity: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }, [a, b]);
  const pipMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: face(a, b).pips, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    [a, b],
  );
  return (
    <>
      <mesh geometry={stoneGeometry()} material={ivoryMaterial()} />
      <mesh position={[0, TILE_H / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[FACE_W, FACE_D]} />
      </mesh>
      <mesh position={[0, TILE_H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pipMaterial}>
        <planeGeometry args={[FACE_W, FACE_D]} />
      </mesh>
      <mesh position={[0, TILE_H / 2 - 0.004, 0]} geometry={pinGeometry()} material={brassMaterial()} />
    </>
  );
}
