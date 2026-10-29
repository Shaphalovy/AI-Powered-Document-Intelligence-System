import { PasswordService } from './password.service';

jest.setTimeout(30000);

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies the correct password', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(await service.verify('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(await service.verify('wrong password', hash)).toBe(false);
  });

  it('uses a different salt every time', async () => {
    const a = await service.hash('same-password-123');
    const b = await service.hash('same-password-123');
    expect(a).not.toEqual(b);
  });

  it('does not contain the plain password', async () => {
    const hash = await service.hash('SuperSecret-Value-42');
    expect(hash).not.toContain('SuperSecret-Value-42');
  });

  it('rejects malformed stored hashes', async () => {
    expect(await service.verify('x', 'not-a-hash')).toBe(false);
    expect(await service.verify('x', 'scrypt$1$2$3')).toBe(false);
  });
});