import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { loadAuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const config = loadAuthConfig();

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret: config.jwtSecret,
      signOptions: { algorithm: 'HS256', expiresIn: config.jwtExpiresSeconds },
      verifyOptions: { algorithms: ['HS256'] },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}