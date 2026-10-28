import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [db, redis] = await Promise.all([
      this.health.checkDb(),
      this.health.checkRedis(),
    ]);
    const healthy = db && redis;
    res.status(healthy ? 200 : 503);
    return { status: healthy ? 'ok' : 'degraded', db, redis };
  }
}