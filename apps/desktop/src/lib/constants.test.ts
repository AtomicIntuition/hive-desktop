import { describe, it, expect } from "vitest";
import { RUNTIME_PORT, RUNTIME_URL, WS_URL, HIVE_MARKET_URL } from "./constants";

describe("constants", () => {
  it("RUNTIME_PORT is 45678", () => {
    expect(RUNTIME_PORT).toBe(45678);
  });

  it("RUNTIME_URL uses correct port", () => {
    expect(RUNTIME_URL).toBe("http://127.0.0.1:45678");
  });

  it("WS_URL uses correct port and path", () => {
    expect(WS_URL).toBe("ws://127.0.0.1:45678/ws");
  });

  it("HIVE_MARKET_URL is correct", () => {
    expect(HIVE_MARKET_URL).toBe("https://hive-mcp.vercel.app");
  });
});
