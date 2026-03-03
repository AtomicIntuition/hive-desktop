import { getDb } from "../db/index.js";
import type { McpServer } from "@hive-desktop/shared";

/**
 * Check if a server is already installed by slug.
 */
export function isInstalled(slug: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT id FROM servers WHERE slug = ?").get(slug);
  return !!row;
}

/**
 * Get a server by slug.
 */
export function getBySlug(slug: string): McpServer | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM servers WHERE slug = ?").get(slug);
  if (!row) return null;
  return mapRow(row);
}

/**
 * Get a server by ID.
 */
export function getById(id: string): McpServer | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(id);
  if (!row) return null;
  return mapRow(row);
}

/**
 * Get all installed servers.
 */
export function getAll(): McpServer[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM servers ORDER BY installed_at DESC").all();
  return rows.map(mapRow);
}

/**
 * Get servers with a specific status.
 */
export function getByStatus(status: McpServer["status"]): McpServer[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM servers WHERE status = ?").all(status);
  return rows.map(mapRow);
}

function mapRow(row: unknown): McpServer {
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
