import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpTool, McpToolCallResult } from "@hive-desktop/shared";
import { mcpManager } from "./manager.js";

interface ConnectedClient {
  client: Client;
  transport: StdioClientTransport;
  tools: McpTool[];
  serverId: string;
}

const clients = new Map<string, ConnectedClient>();

/**
 * Connect to a running MCP server and discover its tools.
 * The server must already be spawned by McpManager.
 */
export async function connectToServer(serverId: string): Promise<McpTool[]> {
  // If already connected with live tools, return cached
  const existing = clients.get(serverId);
  if (existing) {
    return existing.tools;
  }

  const managed = mcpManager.get(serverId);
  if (!managed || managed.status !== "running" || !managed.process) {
    throw new Error(`Server ${serverId} is not running`);
  }

  const { npmPackage, installCommand, slug } = managed;

  // Build env with credentials
  const { getCredentialsForServer, getAllCredentialsAsEnv } = await import("../vault/store.js");
  const serverEnv = getCredentialsForServer(slug);
  const allEnv = getAllCredentialsAsEnv();

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...allEnv,
    ...serverEnv,
  };

  // Create transport — spawn a fresh process for the SDK connection
  let command: string;
  let args: string[];

  if (installCommand === "uvx") {
    command = "uvx";
    args = [npmPackage];
  } else {
    command = "npx";
    args = ["-y", npmPackage];
  }

  const transport = new StdioClientTransport({ command, args, env });

  const client = new Client({
    name: "hive-desktop",
    version: "0.1.0",
  });

  await client.connect(transport);

  // Discover tools
  const allTools: McpTool[] = [];
  let cursor: string | undefined;

  do {
    const result = await client.listTools({ cursor });
    for (const tool of result.tools) {
      allTools.push({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema as Record<string, unknown>,
      });
    }
    cursor = result.nextCursor;
  } while (cursor);

  const connected: ConnectedClient = { client, transport, tools: allTools, serverId };
  clients.set(serverId, connected);

  return allTools;
}

/**
 * Call a tool on a connected MCP server.
 */
export async function callTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<McpToolCallResult> {
  const connected = clients.get(serverId);
  if (!connected) {
    // Try to connect first
    await connectToServer(serverId);
    const retryConnected = clients.get(serverId);
    if (!retryConnected) {
      throw new Error(`Cannot connect to server ${serverId}`);
    }
    return callToolOnClient(retryConnected, toolName, args);
  }

  return callToolOnClient(connected, toolName, args);
}

async function callToolOnClient(
  connected: ConnectedClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<McpToolCallResult> {
  const result = await connected.client.callTool({
    name: toolName,
    arguments: args,
  });

  const content = (result.content as Array<Record<string, unknown>>).map((item) => {
    if (item.type === "text") {
      return { type: "text" as const, text: item.text as string };
    }
    if (item.type === "image") {
      return { type: "image" as const, data: item.data as string, mimeType: item.mimeType as string };
    }
    if (item.type === "resource") {
      const resource = item.resource as Record<string, unknown>;
      return { type: "resource" as const, resource: { uri: resource.uri as string, text: resource.text as string | undefined } };
    }
    return { type: "text" as const, text: JSON.stringify(item) };
  });

  return {
    content,
    isError: result.isError as boolean | undefined,
    structuredContent: result.structuredContent as Record<string, unknown> | undefined,
  };
}

/**
 * List tools for a server (connecting if needed).
 */
export async function listTools(serverId: string): Promise<McpTool[]> {
  const existing = clients.get(serverId);
  if (existing) return existing.tools;
  return connectToServer(serverId);
}

/**
 * Disconnect from a server and clean up.
 */
export async function disconnectFromServer(serverId: string): Promise<void> {
  const connected = clients.get(serverId);
  if (!connected) return;

  try {
    await connected.client.close();
  } catch {
    // Ignore close errors
  }
  clients.delete(serverId);
}

/**
 * Disconnect all clients (for graceful shutdown).
 */
export async function disconnectAll(): Promise<void> {
  const promises = Array.from(clients.keys()).map((id) => disconnectFromServer(id));
  await Promise.all(promises);
}

/**
 * Check if we have an active connection to a server.
 */
export function isConnected(serverId: string): boolean {
  return clients.has(serverId);
}
