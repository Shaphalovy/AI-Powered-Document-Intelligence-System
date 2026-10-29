import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  private dummyHash?: string;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; tokenType: 'Bearer' }> {
    const user = await this.users.findByEmail(email);

    // Always run one hash check so unknown emails take the same time as wrong passwords.
    let hash = user?.passwordHash;
    if (!hash) {
      this.dummyHash ??= await this.passwords.hash(randomUUID());
      hash = this.dummyHash;
    }
    const valid = await this.passwords.verify(password, hash);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, tokenType: 'Bearer' };
  }
}