import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { seconds, Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    const user = await this.users.findById(req.user.id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, role: user.role };
  }

  // TEMPORARY route to test the roles guard. Remove when real admin routes exist.
  @Roles('admin')
  @Get('admin-ping')
  adminPing() {
    return { ok: true };
  }
}