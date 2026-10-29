import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { requireEnv } from '../config/env';

/** Shared by the API and the worker so both use the same database settings. */
export function typeOrmOptions(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: requireEnv('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: false,
  };
}