import { join } from 'path';
import { DataSource } from 'typeorm';
import { requireEnv } from '../config/env';

export default new DataSource({
  type: 'postgres',
  url: requireEnv('DATABASE_URL'),
  migrations: [join(__dirname, 'migrations', '*.js')],
  migrationsTableName: 'typeorm_migrations',
});