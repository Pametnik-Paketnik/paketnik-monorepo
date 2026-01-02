import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MulterFile } from '../common/interfaces/multer.interface';
import { FlocicService } from './flocic.service';

export interface UploadOptions {
  bucket: 'images' | 'models';
  path: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly buckets = {
    images: 'box-images',
    models: 'face-auth-models',
  };

  constructor(
    private configService: ConfigService,
    private flocicService: FlocicService,
  ) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<number>('MINIO_PORT');
    const useSSL = this.configService.get<boolean>('MINIO_USE_SSL', false);
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');

    if (!endpoint || !accessKey || !secretKey) {
      throw new Error('MinIO configuration is incomplete');
    }

    this.s3Client = new S3Client({
      endpoint: `http${useSSL ? 's' : ''}://${endpoint}:${port}`,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      region: 'us-east-1', // Required for MinIO
      forcePathStyle: true,
    });

    void this.ensureBucketsExist();
  }

  private async ensureBucketsExist(): Promise<void> {
    for (const [bucketType, bucketName] of Object.entries(this.buckets)) {
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        this.logger.log(`Bucket '${bucketName}' exists`);

        // Ensure bucket policy is set even if bucket exists
        await this.setBucketPolicy(
          bucketType as keyof typeof this.buckets,
          bucketName,
        );
      } catch (error: unknown) {
        const awsError = error as {
          name?: string;
          $metadata?: { httpStatusCode?: number };
        };
        if (
          awsError.name === 'NotFound' ||
          awsError.$metadata?.httpStatusCode === 404
        ) {
          try {
            // Create bucket
            const createBucketCommand = new CreateBucketCommand({
              Bucket: bucketName,
            });

            await this.s3Client.send(createBucketCommand);
            this.logger.log(`Created bucket '${bucketName}'`);

            // Set bucket policy based on bucket type
            await this.setBucketPolicy(
              bucketType as keyof typeof this.buckets,
              bucketName,
            );
          } catch (createError: unknown) {
            this.logger.error(
              `Failed to create bucket '${bucketName}':`,
              createError,
            );
          }
        } else {
          this.logger.error(`Error checking bucket '${bucketName}':`, error);
        }
      }
    }
  }

  private async setBucketPolicy(
    bucketType: keyof typeof this.buckets,
    bucketName: string,
  ): Promise<void> {
    try {
      if (bucketType === 'images') {
        // Make images bucket public for read access
        const publicPolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };

        const putPolicyCommand = new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(publicPolicy),
        });

        await this.s3Client.send(putPolicyCommand);
        this.logger.log(`Set public read policy for bucket '${bucketName}'`);
      } else {
        // Keep other buckets (like models) private
        const privatePolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Deny',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };

        const putPolicyCommand = new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(privatePolicy),
        });

        await this.s3Client.send(putPolicyCommand);
        this.logger.log(`Bucket '${bucketName}' kept private`);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to set policy for bucket '${bucketName}':`,
        error,
      );
    }
  }

  async uploadFile(
    file: MulterFile,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const { bucket, path, contentType, metadata } = options;
    const timestamp = Date.now();
    const fileExtension = file.originalname.split('.').pop() || '';

    let bufferToUpload = file.buffer;
    let finalContentType = contentType || file.mimetype;
    let finalExtension = fileExtension;

    // Compress images using FLoCIC
    if (options.bucket === 'images' && this.isImageFile(file.mimetype)) {
      try {
        this.logger.log(
          `Compressing image with FLoCIC: ${file.originalname} (${file.buffer.length} bytes)`,
        );
        bufferToUpload = await this.flocicService.compressImage(file.buffer);
        finalContentType = 'application/octet-stream'; // FLoCIC compressed format
        finalExtension = 'flc'; // FLoCIC extension
        this.logger.log(
          `Compression complete: ${file.buffer.length} -> ${bufferToUpload.length} bytes (${((1 - bufferToUpload.length / file.buffer.length) * 100).toFixed(2)}% reduction)`,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `FLoCIC compression failed, using original: ${errorMessage}`,
        );
        // Fallback to original if compression fails
      }
    }

    const key = `${path}/${timestamp}.${finalExtension}`;

    try {
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
        Body: bufferToUpload,
        ContentType: finalContentType,
        Metadata: {
          ...(metadata || {}),
          originalSize: file.buffer.length.toString(),
          compressed: (
            options.bucket === 'images' && finalExtension === 'flc'
          ).toString(),
          originalMimeType: file.mimetype,
        },
        ACL: 'public-read',
      });

      await this.s3Client.send(putObjectCommand);
      this.logger.log(`File uploaded successfully: ${key}`);

      // Generate public URL using MINIO_PUBLIC_ENDPOINT
      const publicUrl = this.getFileUrl(bucket, key);

      return {
        key,
        url: publicUrl,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to upload file: ${errorMessage}`);
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Get file from MinIO storage
   */
  async getFile(
    bucket: keyof typeof this.buckets,
    key: string,
  ): Promise<Buffer> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
      });

      const response = await this.s3Client.send(getObjectCommand);
      const chunks: Uint8Array[] = [];

      if (response.Body) {
        const stream = response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get file: ${errorMessage}`);
      throw new Error(`Failed to get file: ${errorMessage}`);
    }
  }

  /**
   * Check if file is an image based on MIME type
   */
  private isImageFile(mimetype: string): boolean {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
      mimetype,
    );
  }

  async deleteFile(
    bucket: keyof typeof this.buckets,
    key: string,
  ): Promise<void> {
    try {
      const deleteObjectCommand = new DeleteObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
      });

      await this.s3Client.send(deleteObjectCommand);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete file: ${errorMessage}`);
      throw new Error(`Failed to delete file: ${errorMessage}`);
    }
  }

  getFileUrl(bucket: keyof typeof this.buckets, key: string): string {
    const publicEndpoint = this.configService.get<string>(
      'MINIO_PUBLIC_ENDPOINT',
    );
    const publicEndpointPort =
      this.configService.get<string>('MINIO_PUBLIC_PORT');
    if (publicEndpoint && publicEndpointPort) {
      return `${publicEndpoint}:${publicEndpointPort}/${this.buckets[bucket]}/${key}`;
    }

    // Fallback to configured endpoint
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<number>('MINIO_PORT');
    const useSSL = this.configService.get<boolean>('MINIO_USE_SSL', false);
    return `http${useSSL ? 's' : ''}://${endpoint}:${port}/${this.buckets[bucket]}/${key}`;
  }

  async getSignedUrl(
    bucket: keyof typeof this.buckets,
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn,
      });

      return signedUrl;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate signed URL: ${errorMessage}`);
      throw new Error(`Failed to generate signed URL: ${errorMessage}`);
    }
  }

  // Convenience method for uploading box images
  async uploadBoxImage(file: MulterFile, boxId: string): Promise<UploadResult> {
    return this.uploadFile(file, {
      bucket: 'images',
      path: `boxes/${boxId}`,
      metadata: {
        boxId,
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  // Convenience method for uploading ML models
  async uploadModel(
    file: MulterFile,
    modelName: string,
  ): Promise<UploadResult> {
    return this.uploadFile(file, {
      bucket: 'models',
      path: `models/${modelName}`,
      contentType: 'application/octet-stream',
      metadata: {
        modelName,
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  // Get box image public URL
  getBoxImageUrl(key: string): string {
    return this.getFileUrl('images', key);
  }

  // Get model signed URL (private access)
  async getModelUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return this.getSignedUrl('models', key, expiresIn);
  }
}
