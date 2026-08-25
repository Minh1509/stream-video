import { registerAs } from '@nestjs/config';

export default registerAs('awsS3', () => ({
  awsS3Region: process.env.AWS_S3_REGION,
  awsS3AccessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  awsS3SecretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  awsS3BucketName: process.env.AWS_S3_BUCKET_NAME,
  cloudFrontUrl: process.env.CLOUDFRONT_URL,
  credentialsRequired: process.env.AWS_S3_CREDENTIALS_REQUIRED === 'true',
  endpoint: process.env.AWS_S3_ENDPOINT,
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE
    ? process.env.AWS_S3_FORCE_PATH_STYLE === 'true'
    : undefined,
  minioEnabled: process.env.MINIO_ENABLED === 'true',
  minioUrl: process.env.MINIO_URL,
}));
