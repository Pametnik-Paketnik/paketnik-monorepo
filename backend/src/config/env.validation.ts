import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('dev', 'production', 'test').default('dev'),
  PORT: Joi.number().default(3000),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('6h'),

  // Direct4me
  DIRECT4ME_TOKEN: Joi.string().required(),
  DIRECT4ME_BASEURL: Joi.string().required(),
  DIRECT4ME_TOKEN_FORMAT: Joi.number().integer().min(0).max(6).required(),

  // MinIO Storage
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_PUBLIC_ENDPOINT: Joi.string().required(),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // Face Auth microservice
  FACE_AUTH_SERVICE_URL: Joi.string().required(),
  FACE_AUTH_TIMEOUT: Joi.number().default(30000),

  // Firebase Admin SDK
  FIREBASE_PROJECT_ID: Joi.string().required(),
  FIREBASE_PRIVATE_KEY: Joi.string().required(),
  FIREBASE_CLIENT_EMAIL: Joi.string().required(),
});
