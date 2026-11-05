"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Une pierre de domino en 3D, dessinée maison, comme celles qu'on sort dans la rue :
 * - un bloc de plastique blanc épais aux arêtes bien arrondies, légèrement brillant, un peu patiné ;
 * - des points noirs creusés (vrai relief grâce à une carte de hauteur) ;
 * - un trait central gravé.
 * Tout est généré au premier affichage (aucune image à télécharger).
 */

export const TILE_H = 0.4; // épaisseur d'une pierre (une largeur = 1, une longueur = 2)
const RADIUS = 0.15;

let geometry: THREE.BufferGeometry | null = null;
export function stoneGeometry(): THREE.BufferGeometry {
  geometry ??= new RoundedBoxGeometry(2, TILE_H, 1, 6, RADIUS);
  return geometry;
}

/** Un plastique blanc propre : un dégradé très doux, presque invisible, pour ne pas faire « plat ». */
function drawGrain(g: CanvasRenderingContext2D, W: number, H: number) {
  const grd = g.createLinearGradient(0, 0, W * 0.4, H);
  grd.addColorStop(0, "#fdfdfb");
  grd.addColorStop(1, "#f1f1ee");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
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
/** Le plastique blanc de la pierre. */
export function ivoryMaterial(): THREE.MeshPhysicalMaterial {
  ivoryMat ??= new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: grainTexture(),
    roughness: 0.38,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    specularIntensity: 0.35,
    envMapIntensity: 0.45,
  });
  return ivoryMat;
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

type Face = { color: THREE.CanvasTexture; bump: THREE.CanvasTexture };
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
  const R = H * 0.13; // rayon d'un point
  const make = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return [c, c.getContext("2d") as CanvasRenderingContext2D] as const;
  };
  const [cc, g] = make();
  const [bc, h] = make();
  h.fillStyle = "#fff";
  h.fillRect(0, 0, W, H);
  // Même ivoire que le reste de la pierre, pour que la face ne se voie pas comme une étiquette.
  drawGrain(g, W, H);

  const pipsOf = (v: number, x0: number) =>
    // Quart de tour : les rangées de trois points suivent la longueur de la pierre, comme sur un vrai domino.
    (PIPS[v] ?? []).map(([px, py]) => [x0 + (0.04 + py * 0.92) * half, (0.02 + (1 - px) * 0.96) * H] as const);
  const all = [...pipsOf(a, 0), ...pipsOf(b, half)];

  for (const [x, y] of all) {
    // Couleur : un point noir net, un peu plus clair au fond (le creux), un liseré gris sur le bord.
    const body = g.createRadialGradient(x + R * 0.2, y + R * 0.25, R * 0.05, x, y, R);
    body.addColorStop(0, "#2c2c31");
    body.addColorStop(0.55, "#111114");
    body.addColorStop(1, "#050506");
    g.fillStyle = body;
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(90,90,96,0.6)";
    g.lineWidth = R * 0.08;
    g.beginPath();
    g.arc(x, y, R * 0.98, 0, Math.PI * 2);
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

  // Le trait central gravé (sombre, avec un liseré clair).
  const top = H * 0.1;
  const bottom = H * 0.9;
  const gap = 0;
  for (const [y0, y1] of [
    [top, H / 2 - gap],
    [H / 2 + gap, bottom],
  ] as const) {
    g.lineCap = "round";
    g.strokeStyle = "rgba(30,30,34,0.9)";
    g.lineWidth = W * 0.009;
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
  color.anisotropy = 16;
  const bump = new THREE.CanvasTexture(bc);
  bump.anisotropy = 16;
  const out = { color, bump };
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
      bumpScale: 1.6,
      color: "#ffffff",
      roughness: 0.38,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      specularIntensity: 0.35,
      envMapIntensity: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }, [a, b]);
  return (
    <>
      <mesh geometry={stoneGeometry()} material={ivoryMaterial()} />
      <mesh position={[0, TILE_H / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[FACE_W, FACE_D]} />
      </mesh>
    </>
  );
}
