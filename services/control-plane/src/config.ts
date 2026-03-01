import "dotenv/config";

export type VectorProvider = "chroma" | "pinecone" | "weaviate";
export type SecretsProvider = "env" | "vault" | "kms";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? "8081"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  redisUrl: requireEnv("REDIS_URL", "redis://localhost:6379"),
  postgresUrl: requireEnv("POSTGRES_URL", "postgresql://postgres:postgres@localhost:5432/swarms"),
  minio: {
    endpoint: requireEnv("MINIO_ENDPOINT", "http://localhost:9000"),
    region: requireEnv("MINIO_REGION", "us-east-1"),
    accessKeyId: requireEnv("MINIO_ACCESS_KEY", "minioadmin"),
    secretAccessKey: requireEnv("MINIO_SECRET_KEY", "minioadmin"),
    bucket: requireEnv("MINIO_BUCKET", "swarms-artifacts"),
  },
  vector: {
    provider: (process.env.VECTOR_PROVIDER ?? "chroma") as VectorProvider,
    chromaUrl: process.env.CHROMA_URL ?? "http://localhost:8000",
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeIndex: process.env.PINECONE_INDEX,
    weaviateUrl: process.env.WEAVIATE_URL,
  },
  secrets: {
    provider: (process.env.SECRETS_PROVIDER ?? "env") as SecretsProvider,
    vaultAddr: process.env.VAULT_ADDR,
    vaultToken: process.env.VAULT_TOKEN,
    kmsKeyId: process.env.KMS_KEY_ID,
  },
  queueName: process.env.QUEUE_NAME ?? "agent-jobs",
};
