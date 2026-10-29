import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}

bootstrap().catch((error: unknown) => {
  new Logger('Worker').error(
    `Worker failed to start: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  process.exit(1);
});