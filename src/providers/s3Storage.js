import { S3Client } from "@aws-sdk/client-s3";
import { S3_STORAGE } from "../config/config.js";

const s3Client = new S3Client({
  endpoint: S3_STORAGE.s3Endpoint,
  region: S3_STORAGE.s3Region,
  credentials: {
    accessKeyId: S3_STORAGE.s3AccessKey,
    secretAccessKey: S3_STORAGE.s3SecretKey,
  },
});

export default s3Client;
