import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [db, redis, processor] = await Promise.all([
      this.health.checkDb(),
      this.health.checkRedis(),
      this.health.checkProcessor(),
    ]);
    const healthy = db && redis && processor;
    res.status(healthy ? 200 : 503);
    return { status: healthy ? 'ok' : 'degraded', db, redis, processor };
  }
}