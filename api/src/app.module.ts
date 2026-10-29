import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { requireEnv } from './config/env';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: requireEnv('DATABASE_URL'),
      autoLoadEntities: true,
      synchronize: false,
    }),
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}