/**
 * Integration test: Vault Credential Management
 *
 * Tests the vault routes with real Fastify server + real SQLite DB + real encryption.
 * No mocks — exercises the actual AES-256-GCM encryption/decryption.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../../packages/runtime/src/server.js";
import type { FastifyInstance } from "fastify";
import { mkdirSync, rmSync } from "node:fs";

let app: FastifyInstance;
const testDataDir = "/tmp/hive-test-vault-" + Date.now();

beforeAll(async () => {
  process.env.HIVE_DATA_DIR = testDataDir;
  mkdirSync(testDataDir, { recursive: true });
  const server = await createServer(0);
  app = server.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { rmSync(testDataDir, { recursive: true, force: true }); } catch {}
});

describe("Vault CRUD - Integration", () => {
  let credentialId: string;

  it("GET /api/vault returns empty array initially", async () => {
    const res = await app.inject({ method: "GET", url: "/api/vault" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toEqual([]);
  });

  it("POST /api/vault stores an encrypted credential", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/vault",
      payload: {
        name: "STRIPE_API_KEY",
        value: "sk-test-12345678",
        serverSlug: "stripe-mcp",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.name).toBe("STRIPE_API_KEY");
    expect(body.serverSlug).toBe("stripe-mcp");
    credentialId = body.id;
  });

  it("GET /api/vault lists the credential (without value)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/vault" });
    expect(res.statusCode).toBe(200);
    const creds = JSON.parse(res.payload);
    expect(creds).toHaveLength(1);
    expect(creds[0].name).toBe("STRIPE_API_KEY");
    expect(creds[0].serverSlug).toBe("stripe-mcp");
    // Value should NOT be exposed in list
    expect(creds[0].value).toBeUndefined();
    expect(creds[0].encrypted_value).toBeUndefined();
  });

  it("GET /api/vault/:id/verify confirms credential is valid", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/vault/${credentialId}/verify`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.valid).toBe(true);
  });

  it("stores multiple credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/vault",
      payload: {
        name: "GITHUB_TOKEN",
        value: "ghp_test_token_123",
        serverSlug: "github-mcp",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe("GITHUB_TOKEN");

    const listRes = await app.inject({ method: "GET", url: "/api/vault" });
    const creds = JSON.parse(listRes.payload);
    expect(creds).toHaveLength(2);
  });

  it("PATCH /api/vault/:id updates credential value", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/vault/${credentialId}`,
      payload: { value: "sk-live-newkey999" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    // Verify the updated credential is still valid
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/vault/${credentialId}/verify`,
    });
    expect(JSON.parse(verifyRes.payload).valid).toBe(true);
  });

  it("PATCH /api/vault/:id updates credential name", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/vault/${credentialId}`,
      payload: { name: "STRIPE_SECRET_KEY" },
    });

    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({ method: "GET", url: "/api/vault" });
    const creds = JSON.parse(listRes.payload);
    const updated = creds.find((c: { id: string }) => c.id === credentialId);
    expect(updated.name).toBe("STRIPE_SECRET_KEY");
  });

  it("DELETE /api/vault/:id removes a credential", async () => {
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/vault/${credentialId}`,
    });
    expect(delRes.statusCode).toBe(200);

    // Verify it's gone
    const listRes = await app.inject({ method: "GET", url: "/api/vault" });
    const creds = JSON.parse(listRes.payload);
    expect(creds.find((c: { id: string }) => c.id === credentialId)).toBeUndefined();
  });

  it("DELETE /api/vault/:id returns 404 for nonexistent", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/vault/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/vault/:id/verify returns 404 for nonexistent", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/vault/nonexistent-id/verify",
    });
    expect(res.statusCode).toBe(404);
  });
});
