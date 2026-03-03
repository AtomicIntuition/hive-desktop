import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

// Mock DB
const rows: Record<string, unknown>[] = [];
const mockDbRun = vi.fn((... _args: unknown[]) => ({ changes: 1 }));
const mockDbGet = vi.fn((..._args: unknown[]) => undefined);
const mockDbAll = vi.fn(() => rows);
const mockPrepare = vi.fn(() => ({ run: mockDbRun, get: mockDbGet, all: mockDbAll }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock vault encryption
vi.mock("../../packages/runtime/src/vault/store.js", () => ({
  encrypt: (text: string) => ({
    encrypted: Buffer.from(`enc-${text}`),
    iv: Buffer.from("mock-iv-16bytes!"),
  }),
  decrypt: (encrypted: Buffer, _iv: Buffer) => encrypted.toString().replace("enc-", ""),
}));

// Mock nanoid
vi.mock("nanoid", () => ({ nanoid: () => "cred-123" }));

import { vaultRoutes } from "../../packages/runtime/src/routes/vault.js";

describe("vault routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(vaultRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/vault returns credentials list", async () => {
    mockDbAll.mockReturnValueOnce([
      { id: "c1", name: "STRIPE_KEY", server_slug: "stripe-mcp", created_at: "2026-01-01", updated_at: "2026-01-01" },
    ]);

    const res = await app.inject({ method: "GET", url: "/api/vault" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("STRIPE_KEY");
    expect(body[0]).not.toHaveProperty("encrypted_value");
  });

  it("POST /api/vault stores an encrypted credential", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/vault",
      payload: { name: "MY_KEY", value: "secret123", serverSlug: "test-mcp" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.id).toBe("string");
    expect(body.name).toBe("MY_KEY");
    expect(mockDbRun).toHaveBeenCalled();
  });

  it("PATCH /api/vault/:id updates a credential", async () => {
    mockDbGet.mockReturnValueOnce({ id: "c1" }); // existing check

    const res = await app.inject({
      method: "PATCH",
      url: "/api/vault/c1",
      payload: { value: "newsecret" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
  });

  it("PATCH /api/vault/:id returns 404 for missing credential", async () => {
    mockDbGet.mockReturnValueOnce(undefined);

    const res = await app.inject({
      method: "PATCH",
      url: "/api/vault/bad",
      payload: { name: "renamed" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("GET /api/vault/:id/verify returns valid=true for good credential", async () => {
    mockDbGet.mockReturnValueOnce({
      encrypted_value: Buffer.from("enc-secret"),
      iv: Buffer.from("mock-iv-16bytes!"),
    });

    const res = await app.inject({ method: "GET", url: "/api/vault/c1/verify" });
    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(true);
  });

  it("GET /api/vault/:id/verify returns 404 for missing", async () => {
    mockDbGet.mockReturnValueOnce(undefined);
    const res = await app.inject({ method: "GET", url: "/api/vault/bad/verify" });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /api/vault/:id deletes credential", async () => {
    mockDbRun.mockReturnValueOnce({ changes: 1 });
    const res = await app.inject({ method: "DELETE", url: "/api/vault/c1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("DELETE /api/vault/:id returns 404 for missing", async () => {
    mockDbRun.mockReturnValueOnce({ changes: 0 });
    const res = await app.inject({ method: "DELETE", url: "/api/vault/bad" });
    expect(res.statusCode).toBe(404);
  });
});
