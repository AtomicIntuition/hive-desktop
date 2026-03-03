import { createServer } from "./server.js";
import { getDb, closeDb } from "./db/index.js";
import { mcpManager } from "./mcp/manager.js";
import { disconnectAll } from "./mcp/client.js";

const PORT = parseInt(process.env.HIVE_RUNTIME_PORT ?? "45678", 10);

async function main() {
  // Initialize database
  getDb();
  console.log("[runtime] Database initialized");

  // Start server
  const { app } = await createServer(PORT);

  try {
    await app.listen({ port: PORT, host: "127.0.0.1" });
    console.log(`[runtime] Server listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    console.error("[runtime] Failed to start:", err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[runtime] Shutting down...");

    // Disconnect MCP SDK clients
    await disconnectAll();
    console.log("[runtime] MCP clients disconnected");

    // Stop all MCP server processes
    await mcpManager.shutdownAll();
    console.log("[runtime] MCP servers stopped");

    // Close HTTP server
    await app.close();

    // Close database
    closeDb();

    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
