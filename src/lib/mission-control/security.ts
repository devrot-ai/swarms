import crypto from "node:crypto";

export interface ValidatedKey {
  encryptedKey: string;
  keyRef: string;
  fingerprint: string;
}

function getEncryptionKey() {
  const envKey = process.env.MISSION_CONTROL_KMS_KEY;
  if (!envKey) {
    return crypto.createHash("sha256").update("mission-control-local-dev-key").digest();
  }

  const asBuffer = Buffer.from(envKey, "base64");
  if (asBuffer.length === 32) return asBuffer;

  return crypto.createHash("sha256").update(envKey).digest();
}

function keyLooksValid(apiKey: string, provider: string) {
  if (apiKey.length < 20) return false;

  switch (provider) {
    case "openai":
      return /^sk-[A-Za-z0-9_-]+$/.test(apiKey);
    case "anthropic":
      return /^sk-ant-[A-Za-z0-9_-]+$/.test(apiKey);
    case "google":
      return /^[A-Za-z0-9_-]{20,}$/.test(apiKey);
    case "ollama":
      // Ollama runs locally and does not require an API key; accept empty string.
      return true;
    default:
      return true;
  }
}

export function validateAndEncryptKey(apiKey: string, provider: string): ValidatedKey {
  if (!keyLooksValid(apiKey, provider)) {
    throw new Error("Invalid API key format for selected provider.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");

  const fingerprint = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  const keyRef = `key_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  return {
    encryptedKey: payload,
    keyRef,
    fingerprint,
  };
}
