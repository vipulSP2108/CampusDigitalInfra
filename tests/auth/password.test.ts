import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, constantTimeEqual } from '@/lib/auth/password';

describe('password hashing (scrypt)', () => {
  it('produces a well-formed scrypt hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    const parts = hash.split('$');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte salt
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/); // 64-byte key
  });

  it('produces a different salt (and hash) each call', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('s3cret-passw0rd');
    expect(await verifyPassword('s3cret-passw0rd', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-passw0rd');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('rejects missing/malformed/empty stored hashes without throwing', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', undefined)).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$onlytwo')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$aa$bb')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$$')).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('asd@123', 'asd@123')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(constantTimeEqual('asd@123', 'asd@124')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeEqual('short', 'longer-value')).toBe(false);
  });
});