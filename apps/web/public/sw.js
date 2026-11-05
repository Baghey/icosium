// Service worker minimal d'ICOSIUM : rend l'app installable.
// Pas de cache pour l'instant (étape 1) : tout passe par le réseau.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
