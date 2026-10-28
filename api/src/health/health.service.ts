import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { requireEnv } from '../config/env';

const TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    connectionTimeoutMillis: TIMEOUT_MS,
    max: 2,
  });

  private readonly redis = new Redis(requireEnv('REDIS_URL'), {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  constructor() {
    this.pool.on('error', () => undefined);
    this.redis.on('error', () => undefined);
  }

  async checkDb(): Promise<boolean> {
    try {
      await withTimeout(this.pool.query('SELECT 1'), TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  }

  async checkRedis(): Promise<boolean> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      const reply = await withTimeout(this.redis.ping(), TIMEOUT_MS);
      return reply === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.redis.disconnect();
  }
}