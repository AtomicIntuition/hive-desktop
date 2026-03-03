import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { getDb } from "../db/index.js";
import { getCredentialsForServer, getAllCredentialsAsEnv } from "../vault/store.js";
import type { ServerStatus } from "@hive-desktop/shared";

export interface ManagedServer {
  id: string;
  slug: string;
  name: string;
  npmPackage: string;
  installCommand: "npx" | "uvx";
  process: ChildProcess | null;
  status: ServerStatus;
  logs: LogEntry[];
  restartCount: number;
  lastError?: string;
}

export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
}

const MAX_LOG_LINES = 500;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY_MS = 2000;

class McpManager extends EventEmitter {
  private servers = new Map<string, ManagedServer>();

  /** Start an MCP server process by its database ID */
  async start(serverId: string): Promise<ManagedServer> {
    // If already running, return
    const existing = this.servers.get(serverId);
    if (existing?.status === "running" && existing.process) {
      return existing;
    }

    // Load from DB
    const db = getDb();
    const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as Record<string, unknown> | undefined;
    if (!row) throw new Error(`Server not found: ${serverId}`);

    const npmPackage = row.npm_package as string;
    if (!npmPackage) throw new Error(`Server ${row.slug} has no npm package configured`);

    const slug = row.slug as string;
    const installCommand = (row.install_command as "npx" | "uvx") ?? "npx";

    const managed: ManagedServer = {
      id: serverId,
      slug,
      name: row.name as string,
      npmPackage,
      installCommand,
      process: null,
      status: "stopped",
      logs: [],
      restartCount: 0,
    };

    this.servers.set(serverId, managed);
    await this.spawnProcess(managed);
    return managed;
  }

  /** Stop an MCP server process */
  async stop(serverId: string): Promise<void> {
    const managed = this.servers.get(serverId);
    if (!managed) return;

    managed.restartCount = MAX_RESTART_ATTEMPTS; // Prevent auto-restart
    this.killProcess(managed);
    managed.status = "stopped";
    this.updateDbStatus(serverId, "stopped", undefined);
    this.emit("status", { id: serverId, status: "stopped" as ServerStatus });
  }

  /** Restart an MCP server */
  async restart(serverId: string): Promise<ManagedServer> {
    await this.stop(serverId);
    const managed = this.servers.get(serverId);
    if (managed) {
      managed.restartCount = 0;
    }
    return this.start(serverId);
  }

  /** Get a managed server instance */
  get(serverId: string): ManagedServer | undefined {
    return this.servers.get(serverId);
  }

  /** Get logs for a server */
  getLogs(serverId: string): LogEntry[] {
    return this.servers.get(serverId)?.logs ?? [];
  }

  /** Get all managed servers */
  getAll(): ManagedServer[] {
    return Array.from(this.servers.values());
  }

  /** Shut down all servers (for graceful shutdown) */
  async shutdownAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map((id) => this.stop(id));
    await Promise.all(stopPromises);
  }

  /** Get the child process for SDK connection */
  getProcess(serverId: string): ChildProcess | null {
    return this.servers.get(serverId)?.process ?? null;
  }

  // ── Internal ──────────────────────────────────────────

  private async spawnProcess(managed: ManagedServer): Promise<void> {
    const { id, slug, npmPackage, installCommand } = managed;

    // Build env: inherit process env + server-specific credentials + all credentials
    const serverEnv = getCredentialsForServer(slug);
    const allEnv = getAllCredentialsAsEnv();
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...allEnv,
      ...serverEnv, // Server-specific overrides
    };

    // Determine command and args
    let command: string;
    let args: string[];

    if (installCommand === "uvx") {
      command = "uvx";
      args = [npmPackage];
    } else {
      command = "npx";
      args = ["-y", npmPackage];
    }

    this.addLog(managed, "info", `Starting: ${command} ${args.join(" ")}`);
    managed.status = "installing";
    this.emit("status", { id, status: "installing" as ServerStatus });

    try {
      const child = spawn(command, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      managed.process = child;
      managed.status = "running";
      const pid = child.pid;

      this.updateDbStatus(id, "running", pid);
      this.emit("status", { id, status: "running" as ServerStatus, pid });
      this.addLog(managed, "info", `Started with PID ${pid}`);

      // Capture stdout
      child.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().trim().split("\n");
        for (const line of lines) {
          if (line) this.addLog(managed, "info", line);
        }
      });

      // Capture stderr
      child.stderr?.on("data", (data: Buffer) => {
        const lines = data.toString().trim().split("\n");
        for (const line of lines) {
          if (line) this.addLog(managed, "warn", line);
        }
      });

      // Handle exit
      child.on("exit", (code, signal) => {
        managed.process = null;
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        this.addLog(managed, code === 0 ? "info" : "error", `Process exited (${reason})`);

        if (code !== 0 && managed.restartCount < MAX_RESTART_ATTEMPTS) {
          // Auto-restart on unexpected exit
          managed.status = "error";
          managed.lastError = `Exited with ${reason}`;
          this.emit("status", { id, status: "error" as ServerStatus });
          this.updateDbStatus(id, "error", undefined);

          managed.restartCount++;
          this.addLog(managed, "info", `Auto-restart attempt ${managed.restartCount}/${MAX_RESTART_ATTEMPTS} in ${RESTART_DELAY_MS}ms`);

          setTimeout(() => {
            if (managed.restartCount <= MAX_RESTART_ATTEMPTS) {
              this.spawnProcess(managed);
            }
          }, RESTART_DELAY_MS);
        } else {
          managed.status = "stopped";
          this.updateDbStatus(id, "stopped", undefined);
          this.emit("status", { id, status: "stopped" as ServerStatus });
        }
      });

      // Handle spawn errors
      child.on("error", (err) => {
        managed.process = null;
        managed.status = "error";
        managed.lastError = err.message;
        this.addLog(managed, "error", `Spawn error: ${err.message}`);
        this.updateDbStatus(id, "error", undefined);
        this.emit("status", { id, status: "error" as ServerStatus });
      });

    } catch (err) {
      managed.status = "error";
      managed.lastError = (err as Error).message;
      this.addLog(managed, "error", `Failed to start: ${(err as Error).message}`);
      this.updateDbStatus(id, "error", undefined);
      this.emit("status", { id, status: "error" as ServerStatus });
      throw err;
    }
  }

  private killProcess(managed: ManagedServer): void {
    if (managed.process && !managed.process.killed) {
      managed.process.kill("SIGTERM");
      // Force kill after 5 seconds if still alive
      const pid = managed.process.pid;
      setTimeout(() => {
        if (managed.process && !managed.process.killed) {
          this.addLog(managed, "warn", "Force killing process");
          managed.process.kill("SIGKILL");
        }
      }, 5000);
      this.addLog(managed, "info", `Sent SIGTERM to PID ${pid}`);
    }
    managed.process = null;
  }

  private addLog(managed: ManagedServer, level: LogEntry["level"], message: string): void {
    const entry: LogEntry = { level, message, timestamp: new Date().toISOString() };
    managed.logs.push(entry);
    if (managed.logs.length > MAX_LOG_LINES) {
      managed.logs = managed.logs.slice(-MAX_LOG_LINES);
    }
    this.emit("log", { id: managed.id, ...entry });
  }

  private updateDbStatus(id: string, status: string, pid: number | undefined): void {
    const db = getDb();
    if (status === "running" && pid) {
      db.prepare("UPDATE servers SET status = ?, pid = ?, last_started_at = datetime('now') WHERE id = ?")
        .run(status, pid, id);
    } else {
      db.prepare("UPDATE servers SET status = ?, pid = NULL WHERE id = ?")
        .run(status, id);
    }
  }
}

// Singleton
export const mcpManager = new McpManager();
