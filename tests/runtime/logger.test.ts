import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must set env before import
process.env.HIVE_LOG_LEVEL = "debug";

describe("createLogger", () => {
  let createLogger: typeof import("../../packages/runtime/src/logger.js").createLogger;

  beforeEach(async () => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Dynamic import to pick up env
    const mod = await import("../../packages/runtime/src/logger.js");
    createLogger = mod.createLogger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a logger with the given scope", () => {
    const log = createLogger("test-scope");
    expect(log).toHaveProperty("debug");
    expect(log).toHaveProperty("info");
    expect(log).toHaveProperty("warn");
    expect(log).toHaveProperty("error");
  });

  it("info logs with correct format", () => {
    const log = createLogger("mcp");
    log.info("Server started");
    expect(console.log).toHaveBeenCalledOnce();
    const msg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[INFO]");
    expect(msg).toContain("[mcp]");
    expect(msg).toContain("Server started");
  });

  it("debug logs when level is debug", () => {
    const log = createLogger("db");
    log.debug("Query executed");
    expect(console.debug).toHaveBeenCalledOnce();
    const msg = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[DEBUG]");
    expect(msg).toContain("[db]");
  });

  it("warn logs correctly", () => {
    const log = createLogger("vault");
    log.warn("Key expiring soon");
    expect(console.warn).toHaveBeenCalledOnce();
    const msg = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[WARN]");
  });

  it("error logs correctly", () => {
    const log = createLogger("runtime");
    log.error("Failed to start");
    expect(console.error).toHaveBeenCalledOnce();
    const msg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[ERROR]");
  });

  it("includes JSON data when provided", () => {
    const log = createLogger("api");
    log.info("Request", { method: "GET", path: "/health" });
    const msg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain('{"method":"GET","path":"/health"}');
  });

  it("handles unserializable data gracefully", () => {
    const log = createLogger("api");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    log.info("Circular", circular);
    const msg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("[unserializable]");
  });

  it("includes ISO timestamp", () => {
    const log = createLogger("test");
    log.info("test");
    const msg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // ISO format: 2026-03-03T...
    expect(msg).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
