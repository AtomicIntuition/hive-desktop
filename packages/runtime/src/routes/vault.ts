import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import { encrypt, decrypt } from "../vault/store.js";
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

  // Store a credential (encrypted with AES-256-GCM)
  app.post<{ Body: { name: string; value: string; serverSlug?: string } }>(
    "/api/vault",
    async (request) => {
      const db = getDb();
      const id = nanoid();
      const { name, value, serverSlug } = request.body;

      const { encrypted, iv } = encrypt(value);

      db.prepare(
        `INSERT INTO credentials (id, name, server_slug, encrypted_value, iv)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, name, serverSlug ?? null, encrypted, iv);

      return { id, name, serverSlug, createdAt: new Date().toISOString() };
    }
  );

  // Update a credential value
  app.patch<{ Params: { id: string }; Body: { value?: string; name?: string; serverSlug?: string } }>(
    "/api/vault/:id",
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const { value, name, serverSlug } = request.body;

      const existing = db.prepare("SELECT id FROM credentials WHERE id = ?").get(id);
      if (!existing) return reply.status(404).send({ error: "Credential not found" });

      if (value) {
        const { encrypted, iv } = encrypt(value);
        db.prepare("UPDATE credentials SET encrypted_value = ?, iv = ?, updated_at = datetime('now') WHERE id = ?")
          .run(encrypted, iv, id);
      }
      if (name) {
        db.prepare("UPDATE credentials SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
      }
      if (serverSlug !== undefined) {
        db.prepare("UPDATE credentials SET server_slug = ?, updated_at = datetime('now') WHERE id = ?")
          .run(serverSlug || null, id);
      }

      return { success: true };
    }
  );

  // Verify a credential can be decrypted (health check)
  app.get<{ Params: { id: string } }>("/api/vault/:id/verify", async (request, reply) => {
    const db = getDb();
    const row = db.prepare("SELECT encrypted_value, iv FROM credentials WHERE id = ?").get(request.params.id) as
      | { encrypted_value: Buffer; iv: Buffer }
      | undefined;

    if (!row) return reply.status(404).send({ error: "Credential not found" });

    try {
      decrypt(row.encrypted_value, row.iv);
      return { valid: true };
    } catch {
      return { valid: false, error: "Decryption failed — credential may be corrupted" };
    }
  });

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
