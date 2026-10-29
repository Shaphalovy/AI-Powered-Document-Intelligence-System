export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
}

/** Turns REDIS_URL into ioredis options. Error messages never contain the URL (it may hold a password). */
export function parseRedisUrl(raw: string): RedisConnectionOptions {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('REDIS_URL is not a valid URL');
  }
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;
  if (db !== undefined && (!Number.isInteger(db) || db < 0)) {
    throw new Error('REDIS_URL has an invalid database number');
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(db !== undefined ? { db } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}