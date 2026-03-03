import type { FastifyInstance } from "fastify";

const HIVE_MARKET_URL = process.env.HIVE_MARKET_URL ?? "https://hivemarket.ai";

export async function marketRoutes(app: FastifyInstance): Promise<void> {
  // Proxy search to Hive Market API
  app.get<{ Querystring: { q?: string; category?: string; sort?: string; limit?: string; offset?: string } }>(
    "/api/market/tools",
    async (request) => {
      const params = new URLSearchParams();
      if (request.query.q) params.set("q", request.query.q);
      if (request.query.category) params.set("category", request.query.category);
      if (request.query.sort) params.set("sort", request.query.sort);
      if (request.query.limit) params.set("limit", request.query.limit);
      if (request.query.offset) params.set("offset", request.query.offset);

      const url = `${HIVE_MARKET_URL}/api/tools?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return { tools: [], total: 0 };
      return res.json();
    }
  );

  // Get tool details
  app.get<{ Params: { slug: string } }>("/api/market/tools/:slug", async (request, reply) => {
    const res = await fetch(`${HIVE_MARKET_URL}/api/tools/${request.params.slug}`);
    if (!res.ok) return reply.status(404).send({ error: "Tool not found" });
    return res.json();
  });

  // Get tool MCP config
  app.get<{ Params: { slug: string }; Querystring: { client?: string } }>(
    "/api/market/tools/:slug/config",
    async (request, reply) => {
      const client = request.query.client ?? "Claude Desktop";
      const res = await fetch(`${HIVE_MARKET_URL}/api/tools/${request.params.slug}/config?client=${encodeURIComponent(client)}`);
      if (!res.ok) return reply.status(404).send({ error: "Config not found" });
      return res.json();
    }
  );

  // Get categories
  app.get("/api/market/categories", async () => {
    const res = await fetch(`${HIVE_MARKET_URL}/api/categories`);
    if (!res.ok) return [];
    return res.json();
  });

  // Get stacks
  app.get("/api/market/stacks", async () => {
    const res = await fetch(`${HIVE_MARKET_URL}/api/stacks`);
    if (!res.ok) return [];
    return res.json();
  });
}
