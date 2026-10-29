import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function contextFor(user: unknown, handler: () => void) {
  class Dummy {}
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => Dummy,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without role requirements', () => {
    const handler = () => undefined;
    expect(guard.canActivate(contextFor(undefined, handler))).toBe(true);
  });

  it('allows a user with the required role', () => {
    const handler = () => undefined;
    Roles('admin')(handler);
    const ctx = contextFor({ id: 'u1', role: 'admin' }, handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('forbids a user without the required role', () => {
    const handler = () => undefined;
    Roles('admin')(handler);
    const ctx = contextFor({ id: 'u2', role: 'user' }, handler);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('forbids when there is no authenticated user', () => {
    const handler = () => undefined;
    Roles('admin')(handler);
    expect(() => guard.canActivate(contextFor(undefined, handler))).toThrow(
      ForbiddenException,
    );
  });
});