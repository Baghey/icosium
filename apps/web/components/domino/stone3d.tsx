"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Une pierre de domino en 3D, dessinée maison :
 * - un bloc d'ivoire épais aux arêtes bien arrondies, au grain d'os très léger, verni ;
 * - sur le dessus, exactement le dessin des pierres de la main (gros points noirs, trait, clou doré).
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

/** Le dessus de la pierre (presque toute la face, coins arrondis compris). */
const TOP_W = 2 - 0.1;
const TOP_D = 1 - 0.1;

/**
 * Le même dessin que les pierres de la main (components/domino/tile.tsx), couché à l'horizontale :
 * ivoire dégradé, liseré blanc, reflet verni, gros points noirs avec leur reflet, trait et clou doré.
 */
function faceSvg(a: number, b: number): string {
  const H = 100;
  const W = (100 * TOP_W) / TOP_D;
  const half = W / 2;
  const cx = W / 2;
  const cy = H / 2;
  const pips = (v: number, x0: number) =>
    (PIPS[v] ?? [])
      .map(([px, py]) => {
        // Même placement que la main : rangées de trois dans la longueur.
        const x = x0 + (half - 100) / 2 + (0.04 + py * 0.92) * 100;
        const y = (0.02 + (1 - px) * 0.96) * 100;
        return `<circle cx="${x + 0.8}" cy="${y + 1.2}" r="12.5" fill="#fff" fill-opacity="0.75"/><circle cx="${x}" cy="${y}" r="12" fill="url(#pip)"/><path d="M ${x + 8.6} ${y - 3.5} A 9.3 9.3 0 0 1 ${x - 3.5} ${y + 8.6}" fill="none" stroke="#ffe9c4" stroke-opacity="0.55" stroke-width="1.8" stroke-linecap="round"/>`;
      })
      .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * 6)}" height="${H * 6}">
<defs>
<linearGradient id="face" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="0.5" stop-color="#f7eedb"/><stop offset="1" stop-color="#e6d6b4"/></linearGradient>
<radialGradient id="gloss" cx="0.25" cy="0.12" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="pip" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="#3a2a1b"/><stop offset="0.6" stop-color="#150d07"/><stop offset="1" stop-color="#050302"/></radialGradient>
<radialGradient id="pin" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fbe3a2"/><stop offset="0.5" stop-color="#c8962f"/><stop offset="1" stop-color="#6e4b14"/></radialGradient>
</defs>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="16" fill="url(#face)" stroke="#b59c6c" stroke-width="1.6"/>
<rect x="5" y="4.5" width="${W - 10}" height="${H - 9}" rx="13" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="2.5"/>
<rect x="5" y="4.5" width="${W - 10}" height="${H - 9}" rx="13" fill="url(#gloss)"/>
<path d="M ${cx} 14 V ${cy - 11} M ${cx} ${cy + 11} V ${H - 14}" stroke="#7d6744" stroke-width="3.2" stroke-linecap="round"/>
<path d="M ${cx + 2.6} 14 V ${cy - 11} M ${cx + 2.6} ${cy + 11} V ${H - 14}" stroke="#fff" stroke-opacity="0.8" stroke-width="1.4" stroke-linecap="round"/>
<circle cx="${cx}" cy="${cy + 1.2}" r="7" fill="#5b3e10" fill-opacity="0.35"/>
<circle cx="${cx}" cy="${cy}" r="6.5" fill="url(#pin)" stroke="#6e4b14" stroke-width="0.8"/>
<circle cx="${cx - 2}" cy="${cy - 2.2}" r="1.8" fill="#fff6d8" fill-opacity="0.9"/>
${pips(a, 0)}${pips(b, half)}
</svg>`;
}

const tops = new Map<string, THREE.CanvasTexture>();
/** Le dessin de la face, rendu une fois par pierre (28 au plus) dans une texture. */
function topTexture(a: number, b: number): THREE.CanvasTexture {
  const key = `${a}-${b}`;
  const hit = tops.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * TOP_D) / TOP_W);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const img = new Image();
  img.onload = () => {
    (c.getContext("2d") as CanvasRenderingContext2D).drawImage(img, 0, 0, c.width, c.height);
    tex.needsUpdate = true;
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(faceSvg(a, b))}`;
  tops.set(key, tex);
  return tex;
}

/** La pierre posée à plat, face visible (le groupe est centré sur la pierre). */
export function Stone({ a, b }: { a: number; b: number }) {
  // Sans éclairage : la face est exactement celle de la main, quelle que soit la lampe.
  // Un peu moins que le blanc pur, pour que le halo (bloom) ne la fasse pas briller.
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: topTexture(a, b), transparent: true, alphaTest: 0.02, color: "#f0f0f0", toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    [a, b],
  );
  return (
    <>
      <mesh geometry={stoneGeometry()} material={ivoryMaterial()} />
      <mesh position={[0, TILE_H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[TOP_W, TOP_D]} />
      </mesh>
    </>
  );
}
