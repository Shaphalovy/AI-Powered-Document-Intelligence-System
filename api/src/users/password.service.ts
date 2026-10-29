import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCallback,
  ScryptOptions,
  timingSafeEqual,
} from 'crypto';

const KEY_LENGTH = 64;
const COST = 131072; // 2^17
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const MAX_MEMORY = 256 * 1024 * 1024;

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEY_LENGTH, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELISM,
      maxmem: MAX_MEMORY,
    });
    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELISM,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }
    const [, cost, blockSize, parallelism, saltB64, keyB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    try {
      const actual = await scrypt(password, salt, expected.length, {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelism),
        maxmem: MAX_MEMORY,
      });
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}