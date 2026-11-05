/**
 * Textures de la table de rue, dessinées au premier affichage (rien à télécharger) :
 * - le carton beige posé sur la table, avec ses fibres, ses taches d'humidité, ses traces
 *   d'impression et un bout de scotch ;
 * - le dessus de la table de jardin en plastique blanc.
 * Un pseudo-hasard à graine fixe garde le même dessin d'un écran à l'autre.
 */

export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d") as CanvasRenderingContext2D];
}

/** Grain fin, pixel par pixel : `amount` = écart maximal de luminosité. */
function grain(g: CanvasRenderingContext2D, w: number, h: number, amount: number, rnd: () => number) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = (d[i] ?? 0) + n;
    d[i + 1] = (d[i + 1] ?? 0) + n;
    d[i + 2] = (d[i + 2] ?? 0) + n * 0.9;
  }
  g.putImageData(img, 0, 0);
}

/** Une tache aux contours irréguliers (eau, thé renversé) : un cerne plus foncé sur le bord. */
function stain(g: CanvasRenderingContext2D, x: number, y: number, r: number, rnd: () => number, dark: number) {
  const pts: [number, number][] = [];
  const n = 26;
  const phase = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.22 * Math.sin(a * 2 + (phase[0] ?? 0)) + 0.12 * Math.sin(a * 5 + (phase[1] ?? 0)) + 0.06 * Math.sin(a * 9 + (phase[2] ?? 0));
    pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * (0.7 + rnd() * 0.05)]);
  }
  const path = new Path2D();
  pts.forEach(([px, py], i) => (i ? path.lineTo(px, py) : path.moveTo(px, py)));
  path.closePath();
  g.save();
  g.filter = `blur(${Math.max(2, r * 0.06)}px)`;
  g.fillStyle = `rgba(96,64,30,${0.16 * dark})`;
  g.fill(path);
  g.filter = `blur(${Math.max(1, r * 0.02)}px)`;
  g.strokeStyle = `rgba(80,50,22,${0.32 * dark})`;
  g.lineWidth = Math.max(2, r * 0.035);
  g.stroke(path);
  g.restore();
}

/**
 * Le carton. Largeur de la texture = largeur de la table (FELT_W), hauteur = profondeur.
 * `w`, `h` : taille du carton en unités de la scène, pour garder les proportions.
 */
export function drawCardboard(w: number, h: number): HTMLCanvasElement {
  const W = 1024;
  const H = Math.round((W * h) / w);
  const [c, g] = canvas(W, H);
  const rnd = seeded(1962);
  // Kraft beige, un peu plus clair au centre (là où il a été moins piétiné).
  const base = g.createRadialGradient(W * 0.48, H * 0.46, W * 0.1, W * 0.5, H * 0.5, W * 0.95);
  base.addColorStop(0, "#dcbf92");
  base.addColorStop(0.7, "#d3b484");
  base.addColorStop(1, "#c6a575");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Grandes nuances (le carton n'est jamais uni).
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 60 + rnd() * 220;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() > 0.5;
    grd.addColorStop(0, light ? "rgba(236,214,170,0.16)" : "rgba(120,88,50,0.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Les cannelures du carton ondulé, à peine visibles sous la feuille du dessus.
  for (let x = 0; x < W; x += 7) {
    g.fillStyle = "rgba(255,240,210,0.035)";
    g.fillRect(x, 0, 2, H);
    g.fillStyle = "rgba(90,60,30,0.03)";
    g.fillRect(x + 3.5, 0, 2, H);
  }

  // Fibres.
  g.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const len = 3 + rnd() * 14;
    const a = rnd() * Math.PI;
    g.strokeStyle = rnd() > 0.5 ? `rgba(90,60,28,${0.08 + rnd() * 0.12})` : `rgba(245,228,190,${0.1 + rnd() * 0.12})`;
    g.lineWidth = 0.6 + rnd() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  // Impression du carton d'origine, délavée : flèches « haut » et cercle de recyclage, coupés par le bord.
  g.save();
  g.translate(W * 0.83, H * 0.12);
  g.rotate(-0.06);
  g.globalAlpha = 0.28;
  g.strokeStyle = "#5a3a22";
  g.fillStyle = "#5a3a22";
  g.lineWidth = 9;
  for (const dx of [0, 70]) {
    g.beginPath();
    g.moveTo(dx, 70);
    g.lineTo(dx, -10);
    g.stroke();
    g.beginPath();
    g.moveTo(dx - 24, 4);
    g.lineTo(dx, -36);
    g.lineTo(dx + 24, 4);
    g.closePath();
    g.fill();
  }
  g.fillRect(-26, 86, 122, 9);
  g.restore();
  g.save();
  g.translate(W * 0.14, H * 0.9);
  g.rotate(0.12);
  g.globalAlpha = 0.22;
  g.strokeStyle = "#4a2e1a";
  g.lineWidth = 7;
  for (let i = 0; i < 3; i++) {
    const a0 = (i * Math.PI * 2) / 3;
    g.beginPath();
    g.arc(0, 0, 54, a0 + 0.25, a0 + 1.8);
    g.stroke();
    const ax = Math.cos(a0 + 1.8) * 54;
    const ay = Math.sin(a0 + 1.8) * 54;
    g.beginPath();
    g.arc(ax, ay, 9, 0, Math.PI * 2);
    g.fillStyle = "#4a2e1a";
    g.fill();
  }
  g.restore();

  // Taches d'humidité et de thé renversé.
  for (let i = 0; i < 5; i++) stain(g, rnd() * W, rnd() * H, 20 + rnd() * 60, rnd, 0.4 + rnd() * 0.4);
  stain(g, W * 0.24, H * 0.3, 80, rnd, 0.6);
  // Deux ronds laissés par un verre de thé.
  for (const [x, y] of [
    [W * 0.12, H * 0.08],
    [W * 0.9, H * 0.55],
  ] as const) {
    g.save();
    g.filter = "blur(1.5px)";
    g.strokeStyle = "rgba(110,62,20,0.32)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, 38, 0.3, Math.PI * 1.85);
    g.stroke();
    g.restore();
  }

  // Éraflures : la feuille du dessus arrachée laisse voir la cannelure, plus claire.
  for (let i = 0; i < 5; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const len = 40 + rnd() * 110;
    const a = rnd() * Math.PI;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = "rgba(226,200,152,0.55)";
    g.beginPath();
    g.ellipse(0, 0, len / 2, 6 + rnd() * 8, 0, 0, Math.PI * 2);
    g.fill();
    for (let k = -len / 2; k < len / 2; k += 5) {
      g.fillStyle = "rgba(150,112,66,0.4)";
      g.fillRect(k, -5, 1.6, 10);
    }
    g.restore();
  }

  // Un bout de scotch marron sur le bord gauche.
  g.save();
  g.translate(-20, H * 0.58);
  g.rotate(-0.08);
  g.fillStyle = "rgba(176,118,48,0.42)";
  g.fillRect(0, 0, 200, 68);
  g.strokeStyle = "rgba(255,230,180,0.18)";
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(20 + i * 30, 2);
    g.lineTo(34 + i * 30, 66);
    g.stroke();
  }
  g.fillStyle = "rgba(255,240,210,0.12)";
  g.fillRect(0, 6, 200, 8);
  g.restore();

  // Le bord est plus sale : mains, pieds de table, poussière.
  const edge = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.7);
  edge.addColorStop(0, "rgba(60,40,20,0)");
  edge.addColorStop(1, "rgba(60,40,20,0.12)");
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);

  grain(g, W, H, 22, rnd);
  return c;
}

/** Relief du carton : cannelures et fibres (blanc = haut). */
export function drawCardboardBump(): HTMLCanvasElement {
  const [c, g] = canvas(512, 512);
  const rnd = seeded(77);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 8) {
    const grd = g.createLinearGradient(x, 0, x + 8, 0);
    grd.addColorStop(0, "#6c6c6c");
    grd.addColorStop(0.5, "#959595");
    grd.addColorStop(1, "#6c6c6c");
    g.fillStyle = grd;
    g.fillRect(x, 0, 8, 512);
  }
  grain(g, 512, 512, 60, rnd);
  return c;
}

/** Dessus de la table de jardin en plastique blanc : moulures, un peu de poussière, des rayures. */
export function drawPlastic(): HTMLCanvasElement {
  const S = 512;
  const [c, g] = canvas(S, S);
  const rnd = seeded(31);
  g.fillStyle = "#f1f0ec";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 30 + rnd() * 120;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(150,140,120,${0.05 + rnd() * 0.06})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = "rgba(120,115,105,0.18)";
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI;
    const l = 10 + rnd() * 40;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  grain(g, S, S, 8, rnd);
  return c;
}
