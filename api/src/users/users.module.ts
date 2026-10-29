import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeedService } from './admin-seed.service';
import { PasswordService } from './password.service';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, PasswordService, AdminSeedService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}