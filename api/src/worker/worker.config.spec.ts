import { loadWorkerConfig } from './worker.config';

describe('loadWorkerConfig', () => {
  it('uses defaults', () => {
    expect(loadWorkerConfig({ PROCESSOR_URL: 'http://processor:8001' })).toEqual({
      processorUrl: 'http://processor:8001',
      processorTimeoutMs: 300000,
      concurrency: 2,
    });
  });

  it('reads custom values', () => {
    const config = loadWorkerConfig({
      PROCESSOR_URL: 'https://p.example.com',
      PROCESSOR_TIMEOUT_MS: '60000',
      WORKER_CONCURRENCY: '4',
    });
    expect(config).toEqual({
      processorUrl: 'https://p.example.com',
      processorTimeoutMs: 60000,
      concurrency: 4,
    });
  });

  it('removes a trailing slash from the processor URL', () => {
    const config = loadWorkerConfig({ PROCESSOR_URL: 'http://processor:8001/' });
    expect(config.processorUrl).toBe('http://processor:8001');
  });

  it('rejects a missing processor URL', () => {
    expect(() => loadWorkerConfig({})).toThrow('PROCESSOR_URL');
  });

  it('rejects a value that is not a URL', () => {
    expect(() => loadWorkerConfig({ PROCESSOR_URL: 'not a url' })).toThrow(
      'not a valid URL',
    );
  });

  it('rejects a URL with another protocol', () => {
    expect(() => loadWorkerConfig({ PROCESSOR_URL: 'ftp://processor' })).toThrow(
      'http://',
    );
  });

  it('rejects bad numbers', () => {
    const base = { PROCESSOR_URL: 'http://processor:8001' };
    expect(() => loadWorkerConfig({ ...base, WORKER_CONCURRENCY: '0' })).toThrow(
      'between 1 and 10',
    );
    expect(() => loadWorkerConfig({ ...base, WORKER_CONCURRENCY: 'abc' })).toThrow(
      'whole number',
    );
    expect(() => loadWorkerConfig({ ...base, PROCESSOR_TIMEOUT_MS: '10' })).toThrow(
      'between',
    );
  });
});