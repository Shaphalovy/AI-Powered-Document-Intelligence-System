import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  countAdmins(): Promise<number> {
    return this.repo.count({ where: { role: 'admin' } });
  }

  create(email: string, passwordHash: string, role: UserRole): Promise<User> {
    return this.repo.save(
      this.repo.create({
        email: email.trim().toLowerCase(),
        passwordHash,
        role,
      }),
    );
  }
}