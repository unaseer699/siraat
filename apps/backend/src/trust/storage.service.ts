import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
}
