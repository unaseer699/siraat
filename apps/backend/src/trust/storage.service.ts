import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PRESIGNED_TTL_SECONDS = 900; // 15 minutes — Phase 9/10 requirement

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      // Path-style required for MinIO; also supported by DO Spaces
      forcePathStyle: true,
    });
  }

  async getPresignedDownloadUrl(fileKey: string): Promise<string> {
    // Defensive strip: if file_ref was stored with the bucket name prepended
    // (e.g. "siraat-evidence/trust/..."), remove it so the Key is bucket-relative.
    // Correct convention is "trust/society/file.pdf" — no bucket prefix.
    const key = fileKey.startsWith(`${this.bucket}/`)
      ? fileKey.slice(this.bucket.length + 1)
      : fileKey;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_TTL_SECONDS });
  }

  // HOUSE PLAN GALLERY — large files (a multi-page 3D-render PDF walkthrough
  // can easily be several MB) can't travel through the base64-JSON upload
  // routes once the frontend sits behind Vercel: Vercel's Node serverless
  // functions hard-cap the request body at 4.5MB, and base64 inflates the
  // payload by ~33% on top of that, so even a ~3MB file can trip it. This
  // hands the browser a short-lived presigned PUT URL instead, so the file
  // goes straight from the browser to the bucket — Vercel's proxy route
  // only ever sees the small JSON request for the URL itself, never the
  // file bytes.
  // PRE-DATA-POPULATION REVIEW finding #12 — ORPHAN RISK: this call only
  // issues the URL; it does not know whether the browser's PUT ever
  // happens, or whether the caller's finalize step (e.g.
  // AdminService.finalizeHousePlanImageUpload) ever runs afterward. Either
  // one failing silently (closed tab, network drop, abandoned form) leaves
  // an object sitting in the bucket under `key` with no DB row pointing to
  // it, and no part of this codebase currently sweeps for that — there is
  // no reconciliation job comparing bucket contents against file_ref/
  // storage_ref/preview_image_ref columns. This is an accepted gap for now
  // (keys are namespaced per house-plan/image id, so an orphan is at worst
  // a few KB/MB of unused storage, never a correctness or data-integrity
  // issue), tracked in REVIEW_BACKLOG.md rather than fixed here.
  async getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_TTL_SECONDS });
  }

  // HOUSE PLANS DIRECTORY Chunk 1 — first upload path this service has ever
  // needed; every prior feature (Evidence included) only ever read
  // pre-existing files manually uploaded via MinIO's console, so file_ref/
  // preview_image_ref values were always caller-supplied. `key` must already
  // be bucket-relative (same convention as getPresignedDownloadUrl's Key,
  // and as Evidence.file_ref) — this method does not prepend or strip
  // anything.
  async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(command);
    return key;
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — first delete path this service has ever
  // needed (uploadFile above was the first write path; every read before
  // that was getPresignedDownloadUrl). Backs AdminService.deleteHousePlan's
  // image cleanup so DELETE /v1/admin/house-plans/:id doesn't leave an
  // orphaned file in MinIO/DO Spaces.
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(command);
  }
}
