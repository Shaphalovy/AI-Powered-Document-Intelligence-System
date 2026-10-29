import { loadUploadConfig } from './upload.config';

describe('loadUploadConfig', () => {
  it('uses safe defaults when nothing is set', () => {
    expect(loadUploadConfig({})).toEqual({
      dir: '/data/uploads',
      maxFileBytes: 100 * 1024 * 1024,
      maxFilesPerRequest: 20,
    });
  });

  it('reads values from the environment', () => {
    const config = loadUploadConfig({
      UPLOAD_DIR: '/srv/files',
      MAX_UPLOAD_MB: '10',
      MAX_FILES_PER_UPLOAD: '5',
    });
    expect(config).toEqual({
      dir: '/srv/files',
      maxFileBytes: 10 * 1024 * 1024,
      maxFilesPerRequest: 5,
    });
  });

  it('treats empty strings as not set', () => {
    const config = loadUploadConfig({ UPLOAD_DIR: '', MAX_UPLOAD_MB: '' });
    expect(config.dir).toBe('/data/uploads');
    expect(config.maxFileBytes).toBe(100 * 1024 * 1024);
  });

  it('rejects non-numeric limits', () => {
    expect(() => loadUploadConfig({ MAX_UPLOAD_MB: 'abc' })).toThrow(
      'MAX_UPLOAD_MB must be a whole number',
    );
    expect(() => loadUploadConfig({ MAX_FILES_PER_UPLOAD: '1.5' })).toThrow(
      'MAX_FILES_PER_UPLOAD must be a whole number',
    );
  });

  it('rejects zero and values above the hard maximum', () => {
    expect(() => loadUploadConfig({ MAX_UPLOAD_MB: '0' })).toThrow('between 1 and 500');
    expect(() => loadUploadConfig({ MAX_UPLOAD_MB: '501' })).toThrow('between 1 and 500');
    expect(() => loadUploadConfig({ MAX_FILES_PER_UPLOAD: '101' })).toThrow(
      'between 1 and 100',
    );
  });

  it('rejects a relative upload folder', () => {
    expect(() => loadUploadConfig({ UPLOAD_DIR: 'uploads' })).toThrow(
      'UPLOAD_DIR must be an absolute path',
    );
  });
});
