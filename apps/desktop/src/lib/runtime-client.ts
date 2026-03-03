import { RUNTIME_URL } from "./constants.js";
import type { McpServer, Workflow, Credential, MarketTool, MarketCategory } from "@hive-desktop/shared";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${RUNTIME_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Health ──────────────────────────────────────────

export async function checkHealth(): Promise<{ status: string; version: string; uptime: number }> {
  return request("/api/health");
}

// ── Servers ─────────────────────────────────────────

export async function listServers(): Promise<McpServer[]> {
  return request("/api/servers");
}

export async function installServer(data: { slug: string; name: string; npmPackage?: string; installCommand?: string }): Promise<McpServer> {
  return request("/api/servers", { method: "POST", body: JSON.stringify(data) });
}

export async function updateServer(id: string, data: { status?: string; pid?: number }): Promise<McpServer> {
  return request(`/api/servers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function removeServer(id: string): Promise<void> {
  return request(`/api/servers/${id}`, { method: "DELETE" });
}

// ── Workflows ───────────────────────────────────────

export async function listWorkflows(): Promise<Workflow[]> {
  return request("/api/workflows");
}

export async function createWorkflow(data: { name: string; description?: string; trigger: unknown; steps: unknown[] }): Promise<Workflow> {
  return request("/api/workflows", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      trigger: JSON.stringify(data.trigger),
      steps: JSON.stringify(data.steps),
    }),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  return request(`/api/workflows/${id}`, { method: "DELETE" });
}

// ── Vault ───────────────────────────────────────────

export async function listCredentials(): Promise<Credential[]> {
  return request("/api/vault");
}

export async function storeCredential(data: { name: string; value: string; serverSlug?: string }): Promise<Credential> {
  return request("/api/vault", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteCredential(id: string): Promise<void> {
  return request(`/api/vault/${id}`, { method: "DELETE" });
}

// ── Market ──────────────────────────────────────────

export async function searchMarketTools(params?: { q?: string; category?: string; sort?: string; limit?: number }): Promise<{ tools: MarketTool[]; total: number }> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  if (params?.sort) search.set("sort", params.sort);
  if (params?.limit) search.set("limit", String(params.limit));
  return request(`/api/market/tools?${search.toString()}`);
}

export async function getMarketTool(slug: string): Promise<MarketTool> {
  return request(`/api/market/tools/${slug}`);
}

export async function getMarketCategories(): Promise<MarketCategory[]> {
  return request("/api/market/categories");
}

// ── AI ──────────────────────────────────────────────

export async function getAiStatus(): Promise<{ configured: boolean; provider: string }> {
  return request("/api/ai/status");
}
