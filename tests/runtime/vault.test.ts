import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../../packages/runtime/src/vault/store.js";

describe("Vault Encryption", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "sk-ant-api-key-12345";
    const { encrypted, iv } = encrypt(plaintext);

    expect(encrypted).toBeInstanceOf(Buffer);
    expect(iv).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(16);

    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "same-secret";
    const result1 = encrypt(plaintext);
    const result2 = encrypt(plaintext);

    // IVs should be different (random)
    expect(result1.iv.equals(result2.iv)).toBe(false);
    // Ciphertexts should be different
    expect(result1.encrypted.equals(result2.encrypted)).toBe(false);
    // But both decrypt to the same value
    expect(decrypt(result1.encrypted, result1.iv)).toBe(plaintext);
    expect(decrypt(result2.encrypted, result2.iv)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const { encrypted, iv } = encrypt("");
    expect(decrypt(encrypted, iv)).toBe("");
  });

  it("handles long strings", () => {
    const plaintext = "x".repeat(10000);
    const { encrypted, iv } = encrypt(plaintext);
    expect(decrypt(encrypted, iv)).toBe(plaintext);
  });

  it("handles unicode characters", () => {
    const plaintext = "secret-key-with-emoji-🔑-and-日本語";
    const { encrypted, iv } = encrypt(plaintext);
    expect(decrypt(encrypted, iv)).toBe(plaintext);
  });

  it("fails to decrypt with wrong IV", () => {
    const { encrypted } = encrypt("test");
    const wrongIv = Buffer.alloc(16, 0);
    expect(() => decrypt(encrypted, wrongIv)).toThrow();
  });

  it("fails to decrypt corrupted data", () => {
    const { encrypted, iv } = encrypt("test");
    encrypted[0] ^= 0xff; // Corrupt a byte
    expect(() => decrypt(encrypted, iv)).toThrow();
  });
});
