import type { FastifyInstance } from "fastify";

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // Health check for AI provider
  app.get("/api/ai/status", async () => {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return { configured: hasKey, provider: "claude" };
  });

  // Phase 4: NL → workflow translation will be added here
  app.post("/api/ai/plan-workflow", async (_request, reply) => {
    return reply.status(501).send({
      error: "AI planner not yet implemented",
      message: "Coming in Phase 4",
    });
  });
}
