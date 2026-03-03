import { createServer } from "./server.js";
import { getDb, closeDb } from "./db/index.js";
import { mcpManager } from "./mcp/manager.js";
import { disconnectAll } from "./mcp/client.js";
import { initializeScheduler, shutdownScheduler } from "./workflow/scheduler.js";
import { createLogger } from "./logger.js";

const log = createLogger("runtime");
const PORT = parseInt(process.env.HIVE_RUNTIME_PORT ?? "45678", 10);

async function main() {
  getDb();
  log.info("Database initialized");

  const { app } = await createServer(PORT);

  try {
    await app.listen({ port: PORT, host: "127.0.0.1" });
    log.info(`Server listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    log.error("Failed to start", err);
    process.exit(1);
  }

  initializeScheduler();
  log.info("Workflow scheduler initialized");

  // Graceful shutdown
  const shutdown = async () => {
    log.info("Shutting down...");

    shutdownScheduler();
    log.info("Workflow scheduler stopped");

    await disconnectAll();
    log.info("MCP clients disconnected");

    await mcpManager.shutdownAll();
    log.info("MCP servers stopped");

    await app.close();
    closeDb();

    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Catch unhandled rejections
  process.on("unhandledRejection", (reason) => {
    log.error("Unhandled rejection", reason);
  });

  process.on("uncaughtException", (err) => {
    log.error("Uncaught exception", err);
    shutdown();
  });
}

main();
