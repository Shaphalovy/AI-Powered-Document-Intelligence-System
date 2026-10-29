/** Injection token for the validated worker settings. */
export const WORKER_CONFIG = 'WORKER_CONFIG';

export interface WorkerConfig {
  /** Base URL of the processor service, without a trailing slash. */
  processorUrl: string;
  /** How long the worker waits for the processor to answer one request. */
  processorTimeoutMs: number;
  /** How many documents one worker processes at the same time. */
  concurrency: number;
}

function readInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a whole number`);
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

/** Reads and validates worker settings. Throws on bad values so the worker fails fast at startup. */
export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  const rawUrl = env.PROCESSOR_URL;
  if (!rawUrl) {
    throw new Error('Missing required environment variable: PROCESSOR_URL');
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('PROCESSOR_URL is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PROCESSOR_URL must start with http:// or https://');
  }
  return {
    processorUrl: rawUrl.replace(/\/+$/, ''),
    processorTimeoutMs: readInt(env, 'PROCESSOR_TIMEOUT_MS', 300_000, 1000, 3_600_000),
    concurrency: readInt(env, 'WORKER_CONCURRENCY', 2, 1, 10),
  };
}