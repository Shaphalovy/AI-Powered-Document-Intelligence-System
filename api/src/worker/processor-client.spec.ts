import { ProcessorClient } from './processor-client';
import { ProcessorError } from './processor-gateway';
import type { WorkerConfig } from './worker.config';

const config: WorkerConfig = {
  processorUrl: 'http://processor:8001',
  processorTimeoutMs: 1000,
  concurrency: 2,
};
const request = {
  documentId: '44eca8da-3af9-4251-b101-bb3e09e2b9e4',
  storedPath: '44eca8da-3af9-4251-b101-bb3e09e2b9e4.csv',
  fileType: 'csv' as const,
};

describe('ProcessorClient', () => {
  const client = new ProcessorClient(config);
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const answerWith = (status: number) =>
    fetchMock.mockResolvedValue(new Response(null, { status }));

  const expectError = async (retryable: boolean, message: string) => {
    const error = await client.process(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProcessorError);
    expect((error as ProcessorError).retryable).toBe(retryable);
    expect((error as ProcessorError).message).toBe(message);
  };

  it('resolves when the processor answers 200', async () => {
    answerWith(200);
    await expect(client.process(request)).resolves.toBeUndefined();
  });

  it('sends the document details as JSON to /process', async () => {
    answerWith(200);
    await client.process(request);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://processor:8001/process');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      document_id: request.documentId,
      stored_path: request.storedPath,
      file_type: 'csv',
    });
  });

  it('treats 501 as a permanent error', async () => {
    answerWith(501);
    await expectError(false, 'Processing is not implemented yet');
  });

  it('treats 5xx as a retryable error', async () => {
    answerWith(503);
    await expectError(true, 'The processor returned an error (status 503)');
  });

  it('treats 4xx as a permanent error', async () => {
    answerWith(422);
    await expectError(false, 'The processor rejected the request (status 422)');
  });

  it('treats a network error as retryable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expectError(true, 'The processor is unreachable');
  });

  it('treats a timeout as retryable', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
    );
    await expectError(true, 'The processor did not respond in time');
  });
});