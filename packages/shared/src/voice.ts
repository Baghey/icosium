/** Nombre maximum de personnes dans une salle vocale de test (étape 1). */
export const VOICE_ROOM_MAX_PARTICIPANTS = 4;

/** Nom du salon de test partagé par tout le monde à l'étape 1. */
export const TEST_VOICE_ROOM = "test-room";

const ROOM_NAME = /^[a-z0-9][a-z0-9-]{1,47}$/;

/** Un nom de salon accepté par le serveur : minuscules, chiffres, tirets, 2 à 48 caractères. */
export function isValidRoomName(name: string): boolean {
  return ROOM_NAME.test(name);
}
