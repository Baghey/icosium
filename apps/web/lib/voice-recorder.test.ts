import { describe, expect, it } from "vitest";
import { toPeaks } from "./voice-recorder";

describe("toPeaks (forme d'onde d'un message vocal)", () => {
  it("donne toujours le nombre de barres demandé, entre 8 et 100", () => {
    const peaks = toPeaks(Array.from({ length: 333 }, (_, i) => Math.abs(Math.sin(i / 7))), 40);
    expect(peaks).toHaveLength(40);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...peaks)).toBe(100);
  });
  it("marche avec un enregistrement plus court que le nombre de barres", () => {
    expect(toPeaks([0.1, 0.4], 10)).toHaveLength(10);
  });
  it("dessine une ligne plate quand il n'y a rien", () => {
    expect(toPeaks([], 5)).toEqual([8, 8, 8, 8, 8]);
  });
});
