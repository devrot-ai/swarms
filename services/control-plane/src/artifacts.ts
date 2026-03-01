import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "./config.js";
import { writeArtifactMetadata } from "./audit.js";
import { v4 as uuid } from "uuid";

const endpointUrl = new URL(config.minio.endpoint);
const s3 = new S3Client({
  endpoint: `${endpointUrl.protocol}//${endpointUrl.host}`,
  forcePathStyle: true,
  region: config.minio.region,
  credentials: {
    accessKeyId: config.minio.accessKeyId,
    secretAccessKey: config.minio.secretAccessKey,
  },
});

export async function storeArtifact(params: {
  sessionId: string;
  body: string;
  contentType?: string;
}): Promise<{ id: string; key: string; url: string }> {
  const id = uuid();
  const key = `${params.sessionId}/${id}.json`;
  const bodyBuffer = Buffer.from(params.body, "utf8");

  await s3.send(
    new PutObjectCommand({
      Bucket: config.minio.bucket,
      Key: key,
      Body: bodyBuffer,
      ContentType: params.contentType ?? "application/json",
    }),
  );

  await writeArtifactMetadata({
    id,
    sessionId: params.sessionId,
    storageKey: key,
    bucket: config.minio.bucket,
    contentType: params.contentType ?? "application/json",
    sizeBytes: bodyBuffer.byteLength,
    createdAt: new Date().toISOString(),
  });

  const url = `${config.minio.endpoint}/${config.minio.bucket}/${key}`;
  return { id, key, url };
}
