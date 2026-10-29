import { parseRedisUrl } from './redis-connection';

describe('parseRedisUrl', () => {
  it('parses host with the default port', () => {
    expect(parseRedisUrl('redis://redis')).toEqual({ host: 'redis', port: 6379 });
  });

  it('parses port, credentials and database', () => {
    expect(parseRedisUrl('redis://user:pass@host:6500/2')).toEqual({
      host: 'host',
      port: 6500,
      username: 'user',
      password: 'pass',
      db: 2,
    });
  });

  it('decodes a percent-encoded password', () => {
    expect(parseRedisUrl('redis://:p%40ss@host').password).toBe('p@ss');
  });

  it('enables TLS for rediss://', () => {
    expect(parseRedisUrl('rediss://host').tls).toEqual({});
  });

  it('rejects other schemes', () => {
    expect(() => parseRedisUrl('http://host')).toThrow('redis://');
  });

  it('does not leak the input in the error message', () => {
    expect(() => parseRedisUrl('not a url with secret123')).toThrow(
      'REDIS_URL is not a valid URL',
    );
    try {
      parseRedisUrl('not a url with secret123');
    } catch (e) {
      expect((e as Error).message).not.toContain('secret123');
    }
  });

  it('rejects an invalid database number', () => {
    expect(() => parseRedisUrl('redis://host/abc')).toThrow('database number');
  });
});