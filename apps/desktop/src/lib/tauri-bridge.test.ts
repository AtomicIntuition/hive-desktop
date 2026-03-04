import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { getRuntimePort, getAppVersion, getDataDir } from "./tauri-bridge";

const mockInvoke = vi.mocked(invoke);

describe("tauri-bridge", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("getRuntimePort invokes correct command", async () => {
    mockInvoke.mockResolvedValue(45678);
    const result = await getRuntimePort();
    expect(result).toBe(45678);
    expect(mockInvoke).toHaveBeenCalledWith("get_runtime_port");
  });

  it("getAppVersion invokes correct command", async () => {
    mockInvoke.mockResolvedValue("0.2.0");
    const result = await getAppVersion();
    expect(result).toBe("0.2.0");
    expect(mockInvoke).toHaveBeenCalledWith("get_app_version");
  });

  it("getDataDir invokes correct command", async () => {
    mockInvoke.mockResolvedValue("/Users/test/.hive");
    const result = await getDataDir();
    expect(result).toBe("/Users/test/.hive");
    expect(mockInvoke).toHaveBeenCalledWith("get_data_dir");
  });
});
