import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import type { Credential } from "@hive-desktop/shared";

export async function vaultRoutes(app: FastifyInstance): Promise<void> {
  // List credentials (no values returned)
  app.get("/api/vault", async () => {
    const db = getDb();
    const rows = db
      .prepare("SELECT id, name, server_slug, created_at, updated_at FROM credentials ORDER BY name")
      .all();
    return rows.map(mapCredentialRow);
  });

  // Store a credential
  app.post<{ Body: { name: string; value: string; serverSlug?: string } }>(
    "/api/vault",
    async (request) => {
      const db = getDb();
      const id = nanoid();
      const { name, value, serverSlug } = request.body;

      // Phase 2 will add AES-256 encryption — for now store as plain blob
      const encoder = new TextEncoder();
      const encrypted = Buffer.from(encoder.encode(value));
      const iv = Buffer.from(encoder.encode(nanoid(16)));

      db.prepare(
        `INSERT INTO credentials (id, name, server_slug, encrypted_value, iv)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, name, serverSlug ?? null, encrypted, iv);

      return { id, name, serverSlug, createdAt: new Date().toISOString() };
    }
  );

  // Delete a credential
  app.delete<{ Params: { id: string } }>("/api/vault/:id", async (request, reply) => {
    const db = getDb();
    const result = db.prepare("DELETE FROM credentials WHERE id = ?").run(request.params.id);
    if (result.changes === 0) return reply.status(404).send({ error: "Credential not found" });
    return { success: true };
  });
}

function mapCredentialRow(row: unknown): Credential {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    serverSlug: r.server_slug as string | undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
