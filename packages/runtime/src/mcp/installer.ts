import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import { isInstalled } from "./registry.js";
import type { McpServer, ServerEnvVar } from "@hive-desktop/shared";

const execAsync = promisify(exec);

interface InstallOptions {
  slug: string;
  name: string;
  description?: string;
  npmPackage: string;
  installCommand?: "npx" | "uvx";
  envVars?: ServerEnvVar[];
}

/**
 * Install an MCP server from the Hive Market.
 *
 * For npx-based servers, we don't actually pre-install — npx handles
 * downloading on first run. We just register it in the database.
 *
 * For uvx-based servers, same approach — uvx fetches on demand.
 *
 * The "install" step is really about registering the server config
 * so it can be managed (started, stopped, configured).
 */
export async function installServer(options: InstallOptions): Promise<McpServer> {
  const { slug, name, description, npmPackage, installCommand = "npx", envVars } = options;

  if (isInstalled(slug)) {
    throw new Error(`Server "${slug}" is already installed`);
  }

  // Optionally verify the package exists
  try {
    if (installCommand === "npx") {
      await execAsync(`npm view ${npmPackage} version`, { timeout: 10000 });
    }
  } catch {
    // Don't block install if npm view fails (network issues, private packages, etc.)
  }

  const db = getDb();
  const id = nanoid();

  db.prepare(
    `INSERT INTO servers (id, slug, name, description, npm_package, install_command, env_vars, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'stopped')`
  ).run(
    id,
    slug,
    name,
    description ?? "",
    npmPackage,
    installCommand,
    envVars ? JSON.stringify(envVars) : null,
  );

  const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(id);
  return mapRow(row);
}

/**
 * Uninstall a server — remove from DB.
 * Caller should ensure the server is stopped first.
 */
export function uninstallServer(serverId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM servers WHERE id = ?").run(serverId);
  return result.changes > 0;
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
