import { requireEnv } from '../config/env';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresSeconds: number;
}

export function loadAuthConfig(): AuthConfig {
  const jwtSecret = requireEnv('JWT_SECRET');
  if (jwtSecret.length < 32 || jwtSecret.startsWith('change-me')) {
    throw new Error(
      'JWT_SECRET must be a random string of at least 32 characters',
    );
  }
  const jwtExpiresSeconds = Number(process.env.JWT_EXPIRES_SECONDS ?? '3600');
  if (!Number.isInteger(jwtExpiresSeconds) || jwtExpiresSeconds <= 0) {
    throw new Error('JWT_EXPIRES_SECONDS must be a positive integer');
  }
  return { jwtSecret, jwtExpiresSeconds };
}