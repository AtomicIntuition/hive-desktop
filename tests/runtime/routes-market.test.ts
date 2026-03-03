import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { marketRoutes } from "../../packages/runtime/src/routes/market.js";

describe("market routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(marketRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/market/tools proxies search to Hive Market", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tools: [{ slug: "stripe-mcp" }], total: 1 }),
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/market/tools?q=stripe&limit=10",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tools).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("q=stripe"));
  });

  it("GET /api/market/tools returns empty on upstream error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const res = await app.inject({ method: "GET", url: "/api/market/tools" });
    expect(res.json()).toEqual({ tools: [], total: 0 });
  });

  it("GET /api/market/tools/:slug returns tool details", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slug: "github-mcp", name: "GitHub MCP" }),
    });

    const res = await app.inject({ method: "GET", url: "/api/market/tools/github-mcp" });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe("github-mcp");
  });

  it("GET /api/market/tools/:slug returns 404 on upstream miss", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const res = await app.inject({ method: "GET", url: "/api/market/tools/bad" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/market/tools/:slug/config returns MCP config", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ command: "npx", args: ["@test/mcp"] }),
    });

    const res = await app.inject({ method: "GET", url: "/api/market/tools/test/config?client=Cursor" });
    expect(res.statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("client=Cursor"));
  });

  it("GET /api/market/categories returns categories", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ slug: "payments", name: "Payments" }]),
    });

    const res = await app.inject({ method: "GET", url: "/api/market/categories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("GET /api/market/categories returns empty on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const res = await app.inject({ method: "GET", url: "/api/market/categories" });
    expect(res.json()).toEqual([]);
  });

  it("GET /api/market/stacks returns stacks", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ slug: "starter", name: "Starter Pack" }]),
    });

    const res = await app.inject({ method: "GET", url: "/api/market/stacks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});
