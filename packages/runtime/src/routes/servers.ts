import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import type { McpServer } from "@hive-desktop/shared";

export async function serverRoutes(app: FastifyInstance): Promise<void> {
  // List all installed servers
  app.get("/api/servers", async () => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM servers ORDER BY installed_at DESC").all();
    return rows.map(mapServerRow);
  });

  // Get a single server
  app.get<{ Params: { id: string } }>("/api/servers/:id", async (request, reply) => {
    const db = getDb();
    const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(request.params.id);
    if (!row) return reply.status(404).send({ error: "Server not found" });
    return mapServerRow(row);
  });

  // Install a new server
  app.post<{ Body: { slug: string; name: string; npmPackage?: string; installCommand?: string; envVars?: string } }>(
    "/api/servers",
    async (request) => {
      const db = getDb();
      const id = nanoid();
      const { slug, name, npmPackage, installCommand, envVars } = request.body;

      db.prepare(
        `INSERT INTO servers (id, slug, name, npm_package, install_command, env_vars)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, slug, name, npmPackage ?? null, installCommand ?? "npx", envVars ?? null);

      const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(id);
      return mapServerRow(row);
    }
  );

  // Update server status
  app.patch<{ Params: { id: string }; Body: { status?: string; pid?: number } }>(
    "/api/servers/:id",
    async (request, reply) => {
      const db = getDb();
      const { status, pid } = request.body;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (status) {
        updates.push("status = ?");
        values.push(status);
      }
      if (pid !== undefined) {
        updates.push("pid = ?");
        values.push(pid);
      }
      if (status === "running") {
        updates.push("last_started_at = datetime('now')");
      }

      if (updates.length === 0) return reply.status(400).send({ error: "No updates provided" });

      values.push(request.params.id);
      db.prepare(`UPDATE servers SET ${updates.join(", ")} WHERE id = ?`).run(...values);

      const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(request.params.id);
      if (!row) return reply.status(404).send({ error: "Server not found" });
      return mapServerRow(row);
    }
  );

  // Delete a server
  app.delete<{ Params: { id: string } }>("/api/servers/:id", async (request, reply) => {
    const db = getDb();
    const result = db.prepare("DELETE FROM servers WHERE id = ?").run(request.params.id);
    if (result.changes === 0) return reply.status(404).send({ error: "Server not found" });
    return { success: true };
  });
}

function mapServerRow(row: unknown): McpServer {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    npmPackage: r.npm_package as string | undefined,
    installCommand: (r.install_command as "npx" | "uvx") ?? "npx",
    status: (r.status as McpServer["status"]) ?? "stopped",
    pid: r.pid as number | undefined,
    port: r.port as number | undefined,
    config: r.config ? JSON.parse(r.config as string) : undefined,
    envVars: r.env_vars ? JSON.parse(r.env_vars as string) : undefined,
    installedAt: r.installed_at as string,
    lastStartedAt: r.last_started_at as string | undefined,
  };
}
