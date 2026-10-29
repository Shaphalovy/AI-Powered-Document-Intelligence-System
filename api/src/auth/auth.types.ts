import type { Request } from 'express';
import type { UserRole } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

export interface AuthUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}