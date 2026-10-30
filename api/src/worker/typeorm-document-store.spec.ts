import { CLAIMABLE_STATUSES } from './typeorm-document-store';

describe('CLAIMABLE_STATUSES', () => {
  it('lets a worker resume a document left in "processing" by a crashed worker', () => {
    expect(CLAIMABLE_STATUSES).toContain('processing');
  });

  it('never lets a worker pick up a finished document', () => {
    for (const finished of ['completed', 'needs_review', 'failed']) {
      expect(CLAIMABLE_STATUSES).not.toContain(finished);
    }
  });
});
