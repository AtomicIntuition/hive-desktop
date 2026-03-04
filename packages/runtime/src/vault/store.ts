import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { getDb } from "../db/index.js";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Derive an encryption key from machine-specific data.
// This isn't a substitute for OS keychain (Phase 5), but it means
// the raw DB file is useless without this specific machine context.
function deriveKey(): Buffer {
  const machineId = `${hostname()}:${userInfo().username}:hive-desktop-vault-v1`;
  return scryptSync(machineId, "hive-desktop-salt-v1", KEY_LENGTH);
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = deriveKey();
  return cachedKey;
}

export function encrypt(plaintext: string): { encrypted: Buffer; iv: Buffer } {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return { encrypted, iv };
}

export function decrypt(encrypted: Uint8Array, iv: Uint8Array): string {
  const key = getKey();

  // Auth tag is the last 16 bytes
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(Buffer.from(authTag));

  return decipher.update(Buffer.from(ciphertext)) + decipher.final("utf8");
}

// ── Credential helpers for MCP server env injection ────

export function getCredentialValue(id: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT encrypted_value, iv FROM credentials WHERE id = ?").get(id) as
    | { encrypted_value: Uint8Array; iv: Uint8Array }
    | undefined;
  if (!row) return null;
  return decrypt(row.encrypted_value, row.iv);
}

export function getCredentialsForServer(serverSlug: string): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, name, encrypted_value, iv FROM credentials WHERE server_slug = ?")
    .all(serverSlug) as Array<{ id: string; name: string; encrypted_value: Uint8Array; iv: Uint8Array }>;

  const env: Record<string, string> = {};
  for (const row of rows) {
    try {
      env[row.name] = decrypt(row.encrypted_value, row.iv);
    } catch {
      // Skip corrupted credentials
    }
  }
  return env;
}

export function getAllCredentialsAsEnv(): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT name, encrypted_value, iv FROM credentials")
    .all() as Array<{ name: string; encrypted_value: Uint8Array; iv: Uint8Array }>;

  const env: Record<string, string> = {};
  for (const row of rows) {
    try {
      env[row.name] = decrypt(row.encrypted_value, row.iv);
    } catch {
      // Skip corrupted credentials
    }
  }
  return env;
}
