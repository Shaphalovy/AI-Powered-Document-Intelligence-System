import { DocumentQueueService } from './document-queue.service';
import { DOCUMENT_JOB } from './queue.constants';

const ID = '0b6c1d2e-3f4a-4b5c-8d9e-0a1b2c3d4e5f';

function makeQueue() {
  return {
    add: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DocumentQueueService', () => {
  it('adds a job with the document id as payload and as jobId', async () => {
    const queue = makeQueue();
    const service = new DocumentQueueService(queue as never);
    await service.enqueue(ID);
    expect(queue.add).toHaveBeenCalledWith(
      DOCUMENT_JOB,
      { documentId: ID },
      { jobId: ID },
    );
  });

  it('rejects an id that is not a UUID and adds nothing', async () => {
    const queue = makeQueue();
    const service = new DocumentQueueService(queue as never);
    await expect(service.enqueue('bad:id')).rejects.toThrow('Invalid document id');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('closes the queue on shutdown', async () => {
    const queue = makeQueue();
    const service = new DocumentQueueService(queue as never);
    await service.onModuleDestroy();
    expect(queue.close).toHaveBeenCalledTimes(1);
  });
});