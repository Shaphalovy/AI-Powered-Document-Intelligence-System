import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { DocumentQueueService } from '../queue/document-queue.service';
import { DocumentEntity } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { INCOMING_DIR_NAME } from './multer.options';
import { ProcessingEventEntity } from './processing-event.entity';
import { UPLOAD_CONFIG, type UploadConfig } from './upload.config';
import { UploadInterceptor } from './upload.interceptor';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);
const CSV = Buffer.from('invoice_no,total\nINV-1,100.00\n');
const GARBAGE = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

type Change = { criteria: Record<string, unknown>; changes: Record<string, unknown> };

describe('POST /documents', () => {
  let app: INestApplication;
  let dir: string;
  let saved: DocumentEntity[];
  let updates: Change[];
  let events: ProcessingEventEntity[];
  let enqueued: string[];
  let enqueueCalls: number;
  let failSave: boolean;
  let failUpdate: boolean;
  let failEvent: boolean;
  let queueError: Error | null;

  const config = (): UploadConfig => ({
    dir,
    maxFileBytes: 4096,
    maxFilesPerRequest: 3,
  });

  const incomingFiles = () => {
    const incoming = path.join(dir, INCOMING_DIR_NAME);
    return fs.existsSync(incoming) ? fs.readdirSync(incoming) : [];
  };
  const storedFiles = () =>
    fs.readdirSync(dir).filter((name) => name !== INCOMING_DIR_NAME);

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docintel-upload-'));
    saved = [];
    updates = [];
    events = [];
    enqueued = [];
    enqueueCalls = 0;
    failSave = false;
    failUpdate = false;
    failEvent = false;
    queueError = null;

    const fakeDocuments = {
      create: (data: Partial<DocumentEntity>) => data as DocumentEntity,
      save: (entity: DocumentEntity) => {
        if (failSave) {
          return Promise.reject(new Error('database is down'));
        }
        saved.push(entity);
        return Promise.resolve(entity);
      },
      update: (criteria: Record<string, unknown>, changes: Record<string, unknown>) => {
        if (failUpdate) {
          return Promise.reject(new Error('update failed'));
        }
        updates.push({ criteria, changes });
        return Promise.resolve({ affected: 1 });
      },
    };
    const fakeEvents = {
      create: (data: Partial<ProcessingEventEntity>) => data as ProcessingEventEntity,
      save: (entity: ProcessingEventEntity) => {
        if (failEvent) {
          return Promise.reject(new Error('event write failed'));
        }
        events.push(entity);
        return Promise.resolve(entity);
      },
    };
    const fakeQueue = {
      enqueue: (documentId: string) => {
        enqueueCalls += 1;
        if (queueError) {
          return Promise.reject(queueError);
        }
        enqueued.push(documentId);
        return Promise.resolve();
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        DocumentsService,
        UploadInterceptor,
        { provide: UPLOAD_CONFIG, useValue: config() },
        { provide: getRepositoryToken(DocumentEntity), useValue: fakeDocuments },
        { provide: getRepositoryToken(ProcessingEventEntity), useValue: fakeEvents },
        { provide: DocumentQueueService, useValue: fakeQueue },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Stands in for the global JWT guard: a header decides whether a user is "logged in".
    app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
      if (req.headers['x-test-user']) {
        req.user = { id: 'user-1', role: 'user' };
      }
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const post = () => request(app.getHttpServer()).post('/documents').set('x-test-user', '1');

  it('accepts valid files, stores them under random names and saves rows', async () => {
    const res = await post()
      .attach('files', PDF, 'invoice.pdf')
      .attach('files', PNG, 'scan.png')
      .attach('files', CSV, 'data.csv');

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(3);
    expect(res.body.rejected).toBe(0);
    expect(saved.map((d) => d.fileType).sort()).toEqual(['csv', 'pdf', 'png']);
    for (const doc of saved) {
      expect(doc.ownerId).toBe('user-1');
      expect(doc.status).toBe('uploaded');
      expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.storedPath).toMatch(/^[0-9a-f-]{36}\.(pdf|png|csv)$/);
      expect(fs.existsSync(path.join(dir, doc.storedPath))).toBe(true);
    }
    expect(storedFiles()).toHaveLength(3);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('rejects a file whose extension does not match its content, but keeps the good ones', async () => {
    const res = await post()
      .attach('files', PDF, 'good.pdf')
      .attach('files', CSV, 'fake.pdf');

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(1);
    const rejected = res.body.results.find((r: { status: string }) => r.status === 'rejected');
    expect(rejected.originalFilename).toBe('fake.pdf');
    expect(rejected.reason).toContain('does not match');
    expect(saved).toHaveLength(1);
    expect(storedFiles()).toHaveLength(1);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('rejects binary garbage and empty files with 422 when nothing is accepted', async () => {
    const res = await post()
      .attach('files', GARBAGE, 'broken.pdf')
      .attach('files', Buffer.alloc(0), 'empty.csv');

    expect(res.status).toBe(422);
    expect(res.body.accepted).toBe(0);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[1].reason).toBe('The file is empty');
    expect(saved).toHaveLength(0);
    expect(storedFiles()).toHaveLength(0);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('returns 400 when no files are sent', async () => {
    const res = await post().field('x', 'y');
    expect(res.status).toBe(400);
  });

  it('returns 413 for a file above the size limit and leaves nothing on disk', async () => {
    const res = await post()
      .attach('files', PDF, 'small.pdf')
      .attach('files', Buffer.concat([PDF, Buffer.alloc(5000, 65)]), 'big.pdf');

    expect(res.status).toBe(413);
    expect(saved).toHaveLength(0);
    expect(storedFiles()).toHaveLength(0);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('returns 400 when too many files are sent', async () => {
    const res = await post()
      .attach('files', PDF, '1.pdf')
      .attach('files', PDF, '2.pdf')
      .attach('files', PDF, '3.pdf')
      .attach('files', PDF, '4.pdf');

    expect(res.status).toBe(400);
    expect(saved).toHaveLength(0);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('returns 400 for a file sent under the wrong field name', async () => {
    const res = await post().attach('document', PDF, 'invoice.pdf');
    expect(res.status).toBe(400);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('returns 400 when extra text fields are sent', async () => {
    const res = await post().field('note', 'hello').attach('files', PDF, 'invoice.pdf');
    expect(res.status).toBe(400);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('returns 401 without a logged-in user and does not store anything', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .attach('files', PDF, 'invoice.pdf');
    expect(res.status).toBe(401);
    expect(saved).toHaveLength(0);
    expect(storedFiles()).toHaveLength(0);
    expect(incomingFiles()).toHaveLength(0);
  });

  it('never uses the client path or name for the stored file', async () => {
    const res = await post().attach('files', PDF, '../../etc/passwd.pdf');
    expect(res.status).toBe(201);
    expect(saved[0].originalFilename).toBe('passwd.pdf');
    expect(saved[0].storedPath).not.toContain('passwd');
    expect(storedFiles()).toHaveLength(1);
  });

  it('keeps non-ASCII file names intact', async () => {
    const name = 'r\u00e9sum\u00e9-\u20ac.pdf';
    const res = await post().attach('files', PDF, name);
    expect(res.status).toBe(201);
    expect(saved[0].originalFilename).toBe(name);
  });

  it('removes the stored file and reports an error when the database save fails', async () => {
    failSave = true;
    const res = await post().attach('files', PDF, 'invoice.pdf');

    expect(res.status).toBe(422);
    expect(res.body.results[0].reason).toBe('Internal error while saving the file');
    expect(storedFiles()).toHaveLength(0);
    expect(incomingFiles()).toHaveLength(0);
    expect(enqueueCalls).toBe(0);
  });

  it('queues every accepted document, marks it queued and writes an event', async () => {
    const res = await post()
      .attach('files', PDF, 'a.pdf')
      .attach('files', CSV, 'b.csv');

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(2);
    expect(res.body.queued).toBe(2);
    expect([...enqueued].sort()).toEqual(saved.map((d) => d.id).sort());
    expect(updates).toHaveLength(2);
    expect(updates[0].changes).toEqual({ status: 'queued' });
    expect(updates[0].criteria).toMatchObject({ status: 'uploaded' });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.stage === 'enqueue' && e.status === 'succeeded')).toBe(true);
    for (const result of res.body.results) {
      expect(result.queued).toBe(true);
      expect(result.documentStatus).toBe('queued');
    }
  });

  it('keeps the file and reports queued false when the queue is down, without leaking secrets', async () => {
    queueError = new Error('Connection is closed. redis://:supersecret@redis:6379');
    const res = await post().attach('files', PDF, 'a.pdf');

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(1);
    expect(res.body.queued).toBe(0);
    expect(res.body.results[0].queued).toBe(false);
    expect(res.body.results[0].documentStatus).toBe('uploaded');
    expect(JSON.stringify(res.body)).not.toContain('supersecret');
    expect(saved).toHaveLength(1);
    expect(storedFiles()).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('failed');
    expect(events[0].message ?? '').not.toContain('supersecret');
  });

  it('tries the queue only once per request when it is down', async () => {
    queueError = new Error('ECONNREFUSED');
    const res = await post()
      .attach('files', PDF, 'a.pdf')
      .attach('files', CSV, 'b.csv')
      .attach('files', PNG, 'c.png');

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(3);
    expect(res.body.queued).toBe(0);
    expect(enqueueCalls).toBe(1);
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.status === 'failed')).toBe(true);
    expect(storedFiles()).toHaveLength(3);
  });

  it('still succeeds when the status update fails after queueing', async () => {
    failUpdate = true;
    const res = await post().attach('files', PDF, 'a.pdf');

    expect(res.status).toBe(201);
    expect(res.body.results[0].queued).toBe(true);
    expect(res.body.results[0].documentStatus).toBe('uploaded');
    expect(enqueued).toHaveLength(1);
    expect(storedFiles()).toHaveLength(1);
  });

  it('still succeeds when writing the processing event fails', async () => {
    failEvent = true;
    const res = await post().attach('files', PDF, 'a.pdf');

    expect(res.status).toBe(201);
    expect(res.body.results[0].queued).toBe(true);
    expect(res.body.results[0].documentStatus).toBe('queued');
    expect(storedFiles()).toHaveLength(1);
  });
});