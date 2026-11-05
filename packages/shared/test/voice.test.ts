import { describe, expect, it } from "vitest";
import { TEST_VOICE_ROOM, isValidRoomName } from "../src/voice";

describe("isValidRoomName", () => {
  it("accepte le salon de test", () => {
    expect(isValidRoomName(TEST_VOICE_ROOM)).toBe(true);
  });
  it("refuse majuscules, espaces et noms trop longs", () => {
    expect(isValidRoomName("Test")).toBe(false);
    expect(isValidRoomName("a b")).toBe(false);
    expect(isValidRoomName("-abc")).toBe(false);
    expect(isValidRoomName("a".repeat(49))).toBe(false);
  });
});
