import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

const secret = 'a'.repeat(48);

function contextFor(request: object, handler: () => void = () => undefined) {
  class Dummy {}
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => Dummy,
  } as unknown as ExecutionContext;
}

function b64(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

type FakeRequest = { headers: { authorization?: string }; user?: unknown };

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: 60 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const guard = new JwtAuthGuard(jwt, new Reflector());

  const call = (authorization?: string) => {
    const request: FakeRequest = { headers: { authorization } };
    return { request, result: guard.canActivate(contextFor(request)) };
  };

  it('rejects a request without a token', async () => {
    await expect(call().result).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a garbage token', async () => {
    await expect(call('Bearer not-a-token').result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const other = new JwtService({ secret: 'b'.repeat(48) });
    const token = await other.signAsync({ sub: 'u1', role: 'admin' });
    await expect(call(`Bearer ${token}`).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const plain = new JwtService({ secret });
    const token = await plain.signAsync({
      sub: 'u1',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(call(`Bearer ${token}`).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unsigned token (alg none)', async () => {
    const token = [
      b64({ alg: 'none', typ: 'JWT' }),
      b64({ sub: 'u1', role: 'admin' }),
      '',
    ].join('.');
    await expect(call(`Bearer ${token}`).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token with an invalid role', async () => {
    const token = await jwt.signAsync({ sub: 'u1', role: 'hacker' });
    await expect(call(`Bearer ${token}`).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and sets request.user', async () => {
    const token = await jwt.signAsync({ sub: 'u1', role: 'admin' });
    const { request, result } = call(`Bearer ${token}`);
    await expect(result).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', role: 'admin' });
  });

  it('lets public routes through without a token', async () => {
    const handler = () => undefined;
    Public()(handler);
    const request: FakeRequest = { headers: {} };
    await expect(
      guard.canActivate(contextFor(request, handler)),
    ).resolves.toBe(true);
  });
});