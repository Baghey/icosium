import { describe, expect, it } from "vitest";
import { MIN_AGE, ageOn, checkBirthdate, parseBirthdate } from "../src/age";

const NOW = new Date(Date.UTC(2026, 10, 5)); // 5 novembre 2026

describe("parseBirthdate", () => {
  it("accepte une date valide", () => {
    expect(parseBirthdate("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
  });
  it("refuse les dates impossibles ou mal formées", () => {
    expect(parseBirthdate("2001-02-29")).toBeNull();
    expect(parseBirthdate("2001-13-01")).toBeNull();
    expect(parseBirthdate("05/11/2000")).toBeNull();
    expect(parseBirthdate("")).toBeNull();
  });
});

describe("ageOn", () => {
  it("compte les années révolues", () => {
    expect(ageOn("2010-11-05", NOW)).toBe(16);
    expect(ageOn("2010-11-06", NOW)).toBe(15);
    expect(ageOn("1990-01-01", NOW)).toBe(36);
  });
  it("refuse une date dans le futur", () => {
    expect(ageOn("2027-01-01", NOW)).toBeNull();
  });
});

describe("checkBirthdate", () => {
  it(`accepte à partir de ${MIN_AGE} ans le jour même`, () => {
    expect(checkBirthdate("2010-11-05", NOW)).toEqual({ ok: true, age: 16 });
  });
  it(`refuse sous ${MIN_AGE} ans, même à un jour près`, () => {
    expect(checkBirthdate("2010-11-06", NOW)).toEqual({ ok: false, reason: "too_young" });
  });
  it("refuse les dates invalides et invraisemblables", () => {
    expect(checkBirthdate("hello", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(checkBirthdate("1850-01-01", NOW)).toEqual({ ok: false, reason: "implausible" });
  });
});
