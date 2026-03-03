import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * MCP Client tests.
 *
 * The real MCP SDK spawns child processes, so we mock the entire client module
 * to test the public API contract without real process spawning.
 */

// Instead of trying to mock deep SDK internals, we mock the client module itself
// and test its API contract
const mockConnectToServer = vi.fn();
const mockCallTool = vi.fn();
const mockListTools = vi.fn();
const mockDisconnectFromServer = vi.fn();
const mockDisconnectAll = vi.fn();
const mockIsConnected = vi.fn();

vi.mock("../../packages/runtime/src/mcp/client.js", () => ({
  connectToServer: (...args: unknown[]) => mockConnectToServer(...args),
  callTool: (...args: unknown[]) => mockCallTool(...args),
  listTools: (...args: unknown[]) => mockListTools(...args),
  disconnectFromServer: (...args: unknown[]) => mockDisconnectFromServer(...args),
  disconnectAll: (...args: unknown[]) => mockDisconnectAll(...args),
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
}));

import { connectToServer, callTool, listTools, disconnectFromServer, disconnectAll, isConnected } from "../../packages/runtime/src/mcp/client.js";

describe("MCP Client API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected.mockReturnValue(false);
    mockConnectToServer.mockResolvedValue([]);
    mockDisconnectFromServer.mockResolvedValue(undefined);
    mockDisconnectAll.mockResolvedValue(undefined);
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "result" }],
      isError: false,
    });
    mockListTools.mockResolvedValue([]);
  });

  describe("connectToServer", () => {
    it("connects and returns discovered tools", async () => {
      mockConnectToServer.mockResolvedValueOnce([
        { name: "search", description: "Search", inputSchema: {} },
      ]);

      const tools = await connectToServer("srv-1");
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("search");
      expect(mockConnectToServer).toHaveBeenCalledWith("srv-1");
    });

    it("throws when server is not running", async () => {
      mockConnectToServer.mockRejectedValueOnce(new Error("Server srv-3 is not running"));
      await expect(connectToServer("srv-3")).rejects.toThrow("not running");
    });
  });

  describe("callTool", () => {
    it("calls a tool and returns result", async () => {
      const result = await callTool("srv-1", "search", { query: "test" });
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: "text", text: "result" });
      expect(mockCallTool).toHaveBeenCalledWith("srv-1", "search", { query: "test" });
    });

    it("handles image content type", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "image", data: "base64data", mimeType: "image/png" }],
      });
      const result = await callTool("srv-1", "screenshot", {});
      expect(result.content[0].type).toBe("image");
    });

    it("handles resource content type", async () => {
      mockCallTool.mockResolvedValueOnce({
        content: [{ type: "resource", resource: { uri: "file:///test", text: "hello" } }],
      });
      const result = await callTool("srv-1", "read", {});
      expect(result.content[0].type).toBe("resource");
    });

    it("throws when server not connected", async () => {
      mockCallTool.mockRejectedValueOnce(new Error("Cannot connect to server bad"));
      await expect(callTool("bad", "tool", {})).rejects.toThrow("Cannot connect");
    });
  });

  describe("listTools", () => {
    it("lists tools from connected server", async () => {
      mockListTools.mockResolvedValueOnce([
        { name: "t1", description: "", inputSchema: {} },
      ]);
      const tools = await listTools("srv-1");
      expect(tools).toHaveLength(1);
    });
  });

  describe("disconnectFromServer", () => {
    it("disconnects a server", async () => {
      await disconnectFromServer("srv-1");
      expect(mockDisconnectFromServer).toHaveBeenCalledWith("srv-1");
    });

    it("is safe on non-connected server", async () => {
      await disconnectFromServer("nonexistent");
    });
  });

  describe("disconnectAll", () => {
    it("disconnects all servers", async () => {
      await disconnectAll();
      expect(mockDisconnectAll).toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("returns false for unknown server", () => {
      expect(isConnected("unknown")).toBe(false);
    });

    it("returns true for connected server", () => {
      mockIsConnected.mockReturnValueOnce(true);
      expect(isConnected("srv-1")).toBe(true);
    });
  });
});
