/// <reference types="multer" />
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { lookup as mimeLookup } from 'mime-types';
import slugify from 'slugify';
import { s3Configuration } from '../../../configs';
import { getPresignedDownloadUrlResponseDto } from './dto/get-presign-download-url-response.dto';
import { UploadResponseDto } from './dto/upload-response.dto';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { readdir } from 'fs/promises';
import { posix, join, relative, sep } from 'path';

type MulterFile = Express.Multer.File;

@Injectable()
export class AwsS3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cloudfrontUrl: string;

  private readonly logger = new Logger(AwsS3Service.name);

  constructor(
    @Inject(s3Configuration.KEY)
    private readonly s3Config: ConfigType<typeof s3Configuration>,
  ) {
    this.bucket = this.s3Config.awsS3BucketName ?? '';
    this.cloudfrontUrl = this.s3Config.cloudFrontUrl ?? '';
    const awsConfig: S3ClientConfig = {
      region: this.s3Config?.awsS3Region,
    };
    if (this.s3Config.credentialsRequired) {
      awsConfig.credentials = {
        accessKeyId: this.s3Config?.awsS3AccessKeyId ?? '',
        secretAccessKey: this.s3Config?.awsS3SecretAccessKey ?? '',
      };
    }

    if (this.s3Config.minioEnabled) {
      awsConfig.endpoint = this.s3Config.minioUrl;
      awsConfig.forcePathStyle = true;
    } else if (this.s3Config.endpoint) {
      // Custom S3-compatible provider (e.g. Floci)
      awsConfig.endpoint = this.s3Config.endpoint;
      awsConfig.forcePathStyle = this.s3Config.forcePathStyle ?? true;
    }
    this.client = new S3Client(awsConfig);
  }

  async getPresignedUploadUrl(
    fileName: string,
    contentType: string,
    bucketFolder?: string,
    expiresInSeconds: number = 300,
  ): Promise<{
    uploadUrl: string;
    fileUrl: string;
    s3Key: string;
    s3Bucket: string;
  }> {
    const fileKey = bucketFolder
      ? `${bucketFolder}/${fileName}`
      : `${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    const fileUrl = `${this.cloudfrontUrl}/${fileKey}`;

    return { uploadUrl, fileUrl, s3Key: fileKey, s3Bucket: this.bucket };
  }

  async getPresignedDownloadUrl(
    fileKey: string,
    expiresInSeconds: number = 300,
  ): Promise<getPresignedDownloadUrlResponseDto | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });
      const downloadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });

      return {
        presignURL: downloadUrl,
        expiresInSeconds,
      };
    } catch (error) {
      this.logger.error(
        `getPresignedDownloadUrl: Error generating pre-signed download URL for ${fileKey}:`,
        error,
      );
      return null;
    }
  }

  async upload(
    file: MulterFile,
    bucketFolder?: string,
    contentType?: string,
  ): Promise<UploadResponseDto | null> {
    const originalName = file['originalName'];
    const extension = originalName.split('.').pop();
    const slugOptions = {
      replacement: '-',
      remove: undefined,
      lower: true,
      strict: true,
      locale: 'en',
      trim: true,
    };
    const nameWithoutExt = originalName.slice(0, -(extension.length + 1));
    const nameConverted = slugify(nameWithoutExt, slugOptions);
    const fileName = `${nameConverted}-${new Date().getTime()}`;
    const fileKey = bucketFolder
      ? `${bucketFolder}/${fileName}.${extension}`
      : `${fileName}.${extension}`;

    try {
      const readableStream = new Readable();
      readableStream.push(file.buffer);
      readableStream.push(null);

      const inferredContentType =
        contentType || mimeLookup(extension) || 'application/octet-stream';

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: fileKey,
          Body: readableStream,
          ContentType: inferredContentType,
        },
      });

      await upload.done();

      return {
        name: nameConverted,
        extension,
        path: fileKey,
      };
    } catch (err) {
      this.logger.error('upload: ', err);

      return null;
    }
  }

  async uploadLocalFile(
    localPath: string,
    key: string,
    contentType?: string,
  ): Promise<void> {
    const inferredContentType =
      contentType || mimeLookup(key) || 'application/octet-stream';

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: inferredContentType,
      },
    });

    await upload.done();
  }

  async uploadDirectory(localDir: string, keyPrefix: string): Promise<void> {
    const entries = await readdir(localDir, {
      recursive: true,
      withFileTypes: true,
    });

    const files = entries.filter((entry) => entry.isFile());
    await Promise.all(
      files.map((entry) => {
        const absolute = join(entry.parentPath, entry.name);
        const relativeKey = relative(localDir, absolute).split(sep).join('/');
        const key = posix.join(keyPrefix, relativeKey);
        return this.uploadLocalFile(absolute, key);
      }),
    );
  }

  async remove(fileKey: string) {
    const params = { Bucket: this.bucket, Key: fileKey };
    const cmd = new DeleteObjectCommand(params);
    try {
      const response = await this.client.send(cmd);

      return response;
    } catch (err) {
      this.logger.error('delete: ', err);
      return null;
    }
  }

  async getObjectMetadata(fileKey: string) {
    const params = { Bucket: this.bucket, Key: fileKey };
    const cmd = new HeadObjectCommand(params);
    try {
      const response = await this.client.send(cmd);
      return response;
    } catch (err) {
      this.logger.error(`getObjectMetadata failed for key ${fileKey}:`, err);
      return null;
    }
  }
}
