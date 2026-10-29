import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PasswordService } from './password.service';
import { UsersService } from './users.service';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      this.logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seed');
      return;
    }
    if (password.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters');
    }
    if ((await this.users.countAdmins()) > 0) {
      return;
    }

    const hash = await this.passwords.hash(password);
    await this.users.create(email, hash, 'admin');
    this.logger.log(`Admin user created: ${email}`);
  }
}