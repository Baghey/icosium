import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("règles copiées pour les fonctions", () => {
  it.each(["domino", "ludo", "ronda"])("%s : identiques à packages/shared (sinon : pnpm sync:functions)", (game) => {
    const src = join(__dirname, "../../packages/shared/src", game);
    const copy = join(__dirname, "_shared", game);
    expect(readdirSync(copy).sort()).toEqual(readdirSync(src).sort());
    for (const f of readdirSync(src)) expect(readFileSync(join(copy, f), "utf8")).toBe(readFileSync(join(src, f), "utf8"));
  });
});
