import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "us-east-1";
const endpoint = process.env.AWS_S3_ENDPOINT_URL || undefined;

export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  // Pointing at an S3-compatible server (MinIO, LocalStack, etc.) requires forcePathStyle.
  ...(endpoint ? {
    endpoint,
    forcePathStyle: true,
  } : {}),
});
