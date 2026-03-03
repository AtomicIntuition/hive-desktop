import { invoke } from "@tauri-apps/api/core";

export async function getRuntimePort(): Promise<number> {
  return invoke<number>("get_runtime_port");
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>("get_app_version");
}

export async function getDataDir(): Promise<string> {
  return invoke<string>("get_data_dir");
}
