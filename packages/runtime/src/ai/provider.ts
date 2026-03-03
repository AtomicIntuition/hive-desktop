/**
 * AI provider — manages the Anthropic API key and client lifecycle.
 *
 * The API key is stored encrypted in the settings table (via vault encryption)
 * and loaded into memory on demand. The key can also come from the
 * ANTHROPIC_API_KEY env var as a fallback.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/index.js";
import { encrypt, decrypt } from "../vault/store.js";

let cachedClient: Anthropic | null = null;
let cachedKey: string | null = null;

/**
 * Get or create an Anthropic client.
 * Checks: 1) in-memory cache, 2) DB settings, 3) env var.
 */
export function getClient(): Anthropic {
  const key = getApiKey();
  if (!key) {
    throw new Error("Anthropic API key not configured. Set it in Settings or via ANTHROPIC_API_KEY env var.");
  }

  // Return cached client if key hasn't changed
  if (cachedClient && cachedKey === key) {
    return cachedClient;
  }

  cachedClient = new Anthropic({ apiKey: key });
  cachedKey = key;
  return cachedClient;
}

/**
 * Check if an API key is configured.
 */
export function isConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Get the API key from settings or env.
 */
export function getApiKey(): string | null {
  // Check DB settings first
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'anthropic_api_key'").get() as { value: string } | undefined;

  if (row?.value) {
    try {
      // Value is stored as JSON: { encrypted: hex, iv: hex }
      const { encrypted, iv } = JSON.parse(row.value);
      return decrypt(Buffer.from(encrypted, "hex"), Buffer.from(iv, "hex"));
    } catch {
      // Corrupted entry — fall through to env
    }
  }

  // Fallback to env var
  return process.env.ANTHROPIC_API_KEY ?? null;
}

/**
 * Store the API key encrypted in the settings table.
 */
export function setApiKey(key: string): void {
  const db = getDb();
  const { encrypted, iv } = encrypt(key);
  const value = JSON.stringify({
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
  });

  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('anthropic_api_key', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(value);

  // Clear cache so next getClient() picks up new key
  cachedClient = null;
  cachedKey = null;
}

/**
 * Remove the stored API key.
 */
export function removeApiKey(): void {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key = 'anthropic_api_key'").run();
  cachedClient = null;
  cachedKey = null;
}
