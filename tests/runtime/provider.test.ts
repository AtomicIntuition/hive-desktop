import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockDbRun, get: mockDbGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock vault encryption
const mockEncrypt = vi.fn(() => ({
  encrypted: Buffer.from("encrypted-data"),
  iv: Buffer.from("iv-data"),
}));
const mockDecrypt = vi.fn(() => "sk-ant-decrypted-key");
vi.mock("../../packages/runtime/src/vault/store.js", () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    apiKey: string;
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey;
    }
  },
}));

import { getClient, isConfigured, getApiKey, setApiKey, removeApiKey } from "../../packages/runtime/src/ai/provider.js";

describe("AI Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockReturnValue(undefined);
    delete process.env.ANTHROPIC_API_KEY;
    // Reset module-level cache by calling removeApiKey
    removeApiKey();
  });

  describe("getApiKey", () => {
    it("returns null when no key is configured", () => {
      expect(getApiKey()).toBeNull();
    });

    it("returns key from DB when stored", () => {
      mockDbGet.mockReturnValueOnce({
        value: JSON.stringify({
          encrypted: Buffer.from("data").toString("hex"),
          iv: Buffer.from("iv").toString("hex"),
        }),
      });
      expect(getApiKey()).toBe("sk-ant-decrypted-key");
      expect(mockDecrypt).toHaveBeenCalled();
    });

    it("falls back to env var when DB has no key", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-env-key";
      expect(getApiKey()).toBe("sk-ant-env-key");
    });

    it("falls back to env when DB decrypt fails", () => {
      mockDbGet.mockReturnValueOnce({ value: "invalid-json" });
      process.env.ANTHROPIC_API_KEY = "sk-ant-fallback";
      expect(getApiKey()).toBe("sk-ant-fallback");
    });
  });

  describe("isConfigured", () => {
    it("returns false when no key", () => {
      expect(isConfigured()).toBe(false);
    });

    it("returns true when env key exists", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      expect(isConfigured()).toBe(true);
    });
  });

  describe("setApiKey", () => {
    it("encrypts and stores the key in settings", () => {
      setApiKey("sk-ant-new-key");
      expect(mockEncrypt).toHaveBeenCalledWith("sk-ant-new-key");
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe("removeApiKey", () => {
    it("deletes the key from settings", () => {
      removeApiKey();
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe("getClient", () => {
    it("throws when no key is configured", () => {
      expect(() => getClient()).toThrow("API key not configured");
    });

    it("returns an Anthropic client when key is available", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test-client";
      const client = getClient();
      expect(client).toBeDefined();
      expect((client as unknown as { apiKey: string }).apiKey).toBe("sk-ant-test-client");
    });

    it("caches the client on repeated calls", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-cached";
      const c1 = getClient();
      const c2 = getClient();
      expect(c1).toBe(c2);
    });
  });
});
