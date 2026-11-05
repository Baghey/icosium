import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { loadRootEnv } from "./env";
import { handleHttp } from "./http";

loadRootEnv();

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);

const httpServer = createServer(handleHttp);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer, pingInterval: 5000, pingMaxRetries: 3 }),
});

// Étape 1 : aucune salle de jeu. Le domino arrivera à l'étape 2 (gameServer.define("domino", ...)).

gameServer.listen(port, "0.0.0.0").then(() => {
  console.log(`ICOSIUM game server listening on http://0.0.0.0:${port}`);
});

const shutdown = () => void gameServer.gracefullyShutdown(true);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
