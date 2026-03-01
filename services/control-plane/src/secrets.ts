import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { config, type SecretsProvider } from "./config.js";

type SecretKey = string;

type StoredSecret = {
  iv: string;
  tag: string;
  data: string;
};

export interface SecretStore {
  setSecret(key: SecretKey, plaintext: string): Promise<void>;
  getSecret(key: SecretKey): Promise<string | null>;
}

class EncryptedMemorySecretStore implements SecretStore {
  private readonly map = new Map<SecretKey, StoredSecret>();
  private readonly key: Buffer;

  constructor(master: string) {
    this.key = createHash("sha256").update(master).digest();
  }

  async setSecret(key: SecretKey, plaintext: string): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    this.map.set(key, {
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: encrypted.toString("base64"),
    });
  }

  async getSecret(key: SecretKey): Promise<string | null> {
    const blob = this.map.get(key);
    if (!blob) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(blob.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(blob.data, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }
}

class PlaceholderExternalSecretStore implements SecretStore {
  private readonly fallback: EncryptedMemorySecretStore;

  constructor(master: string) {
    this.fallback = new EncryptedMemorySecretStore(master);
  }

  async setSecret(key: SecretKey, plaintext: string): Promise<void> {
    await this.fallback.setSecret(key, plaintext);
  }

  async getSecret(key: SecretKey): Promise<string | null> {
    return this.fallback.getSecret(key);
  }
}

export function createSecretStore(provider: SecretsProvider): SecretStore {
  const master = process.env.SECRET_MASTER_KEY ?? "dev-only-master-key";

  if (provider === "env") {
    return new EncryptedMemorySecretStore(master);
  }

  if (provider === "vault" || provider === "kms") {
    return new PlaceholderExternalSecretStore(master);
  }

  return new EncryptedMemorySecretStore(master);
}

export const secretStore = createSecretStore(config.secrets.provider);
