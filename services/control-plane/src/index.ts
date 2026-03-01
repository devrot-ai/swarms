import { createServer } from "node:http";
import express from "express";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";
import { initWebSocket } from "./ws.js";
import { ensureAuditSchema } from "./audit.js";
import { startWorker } from "./queue.js";

async function main(): Promise<void> {
  await ensureAuditSchema();

  const app = express();
  app.use(express.json({ limit: "2mb" }));

  registerRoutes(app);

  const server = createServer(app);
  initWebSocket(server, config.corsOrigin);
  startWorker();

  server.listen(config.port, () => {
    process.stdout.write(`control-plane listening on ${config.port}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
