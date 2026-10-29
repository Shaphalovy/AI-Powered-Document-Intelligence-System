import type { DetectedFileType } from '../documents/file-type.detector';
import { DocumentProcessingService } from './document-processing.service';
import type {
  ClaimedDocument,
  DocumentStore,
  NewProcessingEvent,
} from './document-store';
import {
  ProcessorError,
  type ProcessorGateway,
  type ProcessRequest,
} from './processor-gateway';

const ID = '44eca8da-3af9-4251-b101-bb3e09e2b9e4';

class FakeStore implements DocumentStore {
  status: Record<string, string>;
  lastError: Record<string, string | null> = {};
  attempts: Record<string, number> = {};
  events: NewProcessingEvent[] = [];
  failEvents = false;

  constructor(initialStatus: string) {
    this.status = { [ID]: initialStatus };
  }

  claim(documentId: string): Promise<ClaimedDocument | null> {
    const current = this.status[documentId];
    if (current !== 'uploaded' && current !== 'queued') {
      return Promise.resolve(null);
    }
    this.status[documentId] = 'processing';
    this.attempts[documentId] = (this.attempts[documentId] ?? 0) + 1;
    this.lastError[documentId] = null;
    return Promise.resolve({
      id: documentId,
      storedPath: `${documentId}.csv`,
      fileType: 'csv' as DetectedFileType,
      attempts: this.attempts[documentId],
    });
  }

  release(documentId: string, message: string): Promise<void> {
    this.status[documentId] = 'queued';
    this.lastError[documentId] = message;
    return Promise.resolve();
  }

  fail(documentId: string, message: string): Promise<void> {
    this.status[documentId] = 'failed';
    this.lastError[documentId] = message;
    return Promise.resolve();
  }

  complete(documentId: string): Promise<void> {
    this.status[documentId] = 'completed';
    this.lastError[documentId] = null;
    return Promise.resolve();
  }

  recordEvent(event: NewProcessingEvent): Promise<void> {
    if (this.failEvents) {
      return Promise.reject(new Error('event write failed'));
    }
    this.events.push(event);
    return Promise.resolve();
  }
}

function makeGateway(behavior: () => Promise<void>) {
  const calls: ProcessRequest[] = [];
  const gateway: ProcessorGateway = {
    process: (request) => {
      calls.push(request);
      return behavior();
    },
  };
  return { calls, gateway };
}

const first = { documentId: ID, attemptsMade: 0, maxAttempts: 3 };

describe('DocumentProcessingService', () => {
  it('fails a document without retry when the error is permanent', async () => {
    const store = new FakeStore('queued');
    const { gateway } = makeGateway(() =>
      Promise.reject(new ProcessorError('Processing is not implemented yet', false)),
    );
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).resolves.toBe('failed');
    expect(store.status[ID]).toBe('failed');
    expect(store.lastError[ID]).toBe('Processing is not implemented yet');
    expect(store.events.map((e) => e.status)).toEqual(['started', 'failed']);
  });

  it('puts the document back to queued and asks BullMQ to retry', async () => {
    const store = new FakeStore('queued');
    const { gateway } = makeGateway(() =>
      Promise.reject(new ProcessorError('The processor is unreachable', true)),
    );
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).rejects.toThrow('The processor is unreachable');
    expect(store.status[ID]).toBe('queued');
    expect(store.lastError[ID]).toBe('The processor is unreachable');
    expect(store.events.map((e) => e.status)).toEqual(['started', 'retried']);
  });

  it('fails the document for good on the last attempt', async () => {
    const store = new FakeStore('queued');
    const { gateway } = makeGateway(() =>
      Promise.reject(new ProcessorError('The processor is unreachable', true)),
    );
    const service = new DocumentProcessingService(store, gateway);

    await expect(
      service.handle({ documentId: ID, attemptsMade: 2, maxAttempts: 3 }),
    ).resolves.toBe('failed');
    expect(store.status[ID]).toBe('failed');
    expect(store.events.map((e) => e.status)).toEqual(['started', 'failed']);
  });

  it('completes the document when the processor succeeds', async () => {
    const store = new FakeStore('uploaded');
    const { gateway, calls } = makeGateway(() => Promise.resolve());
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).resolves.toBe('completed');
    expect(store.status[ID]).toBe('completed');
    expect(store.events.map((e) => e.status)).toEqual(['started', 'succeeded']);
    expect(calls).toEqual([
      { documentId: ID, storedPath: `${ID}.csv`, fileType: 'csv' },
    ]);
  });

  it('skips a document that is already being processed', async () => {
    const store = new FakeStore('processing');
    const { gateway, calls } = makeGateway(() => Promise.resolve());
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).resolves.toBe('skipped');
    expect(calls).toHaveLength(0);
    expect(store.events).toHaveLength(0);
  });

  it('skips a document that is already completed', async () => {
    const store = new FakeStore('completed');
    const { gateway, calls } = makeGateway(() => Promise.resolve());
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).resolves.toBe('skipped');
    expect(calls).toHaveLength(0);
    expect(store.status[ID]).toBe('completed');
  });

  it('processes a document only once when two jobs run at the same time', async () => {
    const store = new FakeStore('queued');
    const { gateway, calls } = makeGateway(
      () => new Promise<void>((resolve) => setTimeout(resolve, 10)),
    );
    const service = new DocumentProcessingService(store, gateway);

    const results = await Promise.all([service.handle(first), service.handle(first)]);
    expect([...results].sort()).toEqual(['completed', 'skipped']);
    expect(calls).toHaveLength(1);
  });

  it('keeps going when the event log is broken', async () => {
    const store = new FakeStore('queued');
    store.failEvents = true;
    const { gateway } = makeGateway(() => Promise.resolve());
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).resolves.toBe('completed');
    expect(store.status[ID]).toBe('completed');
  });

  it('hides the details of an unexpected error and retries', async () => {
    const store = new FakeStore('queued');
    const { gateway } = makeGateway(() =>
      Promise.reject(new Error('boom redis://:pw@host:6379')),
    );
    const service = new DocumentProcessingService(store, gateway);

    await expect(service.handle(first)).rejects.toThrow(
      'Unexpected error while processing',
    );
    expect(store.lastError[ID]).toBe('Unexpected error while processing');
    expect(JSON.stringify(store.events)).not.toContain('pw@');
    expect(store.status[ID]).toBe('queued');
  });
});