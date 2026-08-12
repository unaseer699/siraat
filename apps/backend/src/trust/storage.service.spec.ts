import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn().mockImplementation((params: unknown) => params),
}));

const CONFIG: Record<string, string> = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'test-access',
  S3_SECRET_KEY: 'test-secret',
  S3_BUCKET: 'test-bucket',
  S3_REGION: 'us-east-1',
};

describe('StorageService', () => {
  let svc: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue('https://presigned.example.com/file?sig=abc123');

    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (!(key in CONFIG)) throw new Error(`Missing config key: ${key}`);
              return CONFIG[key];
            },
            get: (key: string, def?: string) => CONFIG[key] ?? def,
          },
        },
      ],
    }).compile();

    svc = module.get(StorageService);
  });

  it('returns the pre-signed URL produced by the presigner', async () => {
    const url = await svc.getPresignedDownloadUrl('trust/pvc/noc.pdf');
    expect(url).toBe('https://presigned.example.com/file?sig=abc123');
  });

  it('passes expiresIn: 900 (15 min) to getSignedUrl', async () => {
    await svc.getPresignedDownloadUrl('trust/pvc/noc.pdf');
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: 900 }),
    );
  });

  it('passes the correct file key and bucket name to GetObjectCommand', async () => {
    const { GetObjectCommand } = jest.requireMock('@aws-sdk/client-s3') as {
      GetObjectCommand: jest.Mock;
    };
    await svc.getPresignedDownloadUrl('trust/pvc/noc.pdf');
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'trust/pvc/noc.pdf', Bucket: 'test-bucket' }),
    );
  });

  it('initializes S3Client with forcePathStyle: true (MinIO + DO Spaces compatibility)', () => {
    const { S3Client } = jest.requireMock('@aws-sdk/client-s3') as { S3Client: jest.Mock };
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: true }),
    );
  });

  it('initializes S3Client with the configured endpoint', () => {
    const { S3Client } = jest.requireMock('@aws-sdk/client-s3') as { S3Client: jest.Mock };
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'http://localhost:9000' }),
    );
  });

  // ─── Bucket-prefix stripping (regression for bad data) ───────────────────────

  it('strips bucket name prefix from file_ref before using it as the S3 Key', async () => {
    const { GetObjectCommand } = jest.requireMock('@aws-sdk/client-s3') as {
      GetObjectCommand: jest.Mock;
    };
    await svc.getPresignedDownloadUrl('test-bucket/trust/taj-residencia/rda-lop-224kanal.jpg');
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'trust/taj-residencia/rda-lop-224kanal.jpg',
      }),
    );
  });

  it('does not alter a file_ref that is already bucket-relative (no prefix)', async () => {
    const { GetObjectCommand } = jest.requireMock('@aws-sdk/client-s3') as {
      GetObjectCommand: jest.Mock;
    };
    await svc.getPresignedDownloadUrl('trust/pvc/noc.pdf');
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'trust/pvc/noc.pdf',
      }),
    );
  });
});
