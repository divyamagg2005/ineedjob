import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const bucket = process.env.AWS_S3_BUCKET;

if (!bucket) {
  console.warn('AWS_S3_BUCKET is not configured. S3 resume uploads will be unavailable.');
}

export const s3Client = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_MIME_TYPES = new Set(['application/pdf']);

export function buildResumeObjectKey(userId: string, companyId: number, fileName: string): string {
  const safeUserId = userId.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  const safeCompany = String(companyId).replace(/[^a-z0-9._-]+/g, '-');
  const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf';
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `resumes/${safeUserId}/${safeCompany}/${uniquePart}.${ext}`;
}

export async function uploadResumeToS3({
  buffer,
  fileName,
  contentType,
  objectKey,
}: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  objectKey: string;
}): Promise<void> {
  if (!bucket) {
    throw new Error('S3 bucket is not configured.');
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
    ContentDisposition: `inline; filename="${fileName}"`,
    ACL: 'private',
  }));
}

export async function deleteResumeFromS3(objectKey?: string | null): Promise<void> {
  if (!bucket || !objectKey) {
    return;
  }

  await s3Client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));
}

export async function getResumeBufferFromS3(objectKey: string): Promise<Buffer> {
  if (!bucket) {
    throw new Error('S3 bucket is not configured.');
  }

  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));

  const body = response.Body;
  if (!body) {
    throw new Error('Resume content was not returned by S3.');
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}
