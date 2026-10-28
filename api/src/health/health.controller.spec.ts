import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

async function build(db: boolean, redis: boolean, processor: boolean) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: HealthService,
        useValue: {
          checkDb: async () => db,
          checkRedis: async () => redis,
          checkProcessor: async () => processor,
        },
      },
    ],
  }).compile();
  return moduleRef.get(HealthController);
}

function fakeRes() {
  const status = jest.fn();
  return { res: { status } as unknown as Response, status };
}

describe('HealthController', () => {
  it('returns 200 and ok when everything is up', async () => {
    const controller = await build(true, true, true);
    const { res, status } = fakeRes();
    const body = await controller.check(res);
    expect(status).toHaveBeenCalledWith(200);
    expect(body).toEqual({ status: 'ok', db: true, redis: true, processor: true });
  });

  it('returns 503 and degraded when redis is down', async () => {
    const controller = await build(true, false, true);
    const { res, status } = fakeRes();
    const body = await controller.check(res);
    expect(status).toHaveBeenCalledWith(503);
    expect(body).toEqual({ status: 'degraded', db: true, redis: false, processor: true });
  });

  it('returns 503 and degraded when processor is down', async () => {
    const controller = await build(true, true, false);
    const { res, status } = fakeRes();
    const body = await controller.check(res);
    expect(status).toHaveBeenCalledWith(503);
    expect(body).toEqual({ status: 'degraded', db: true, redis: true, processor: false });
  });
});