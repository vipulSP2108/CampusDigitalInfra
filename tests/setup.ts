import { vi } from 'vitest';

// Mock next/headers cookies
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock environment - COOKIE_SECRET for tests
// Note: NODE_ENV is read-only in Next.js, so we don't set it here
process.env.COOKIE_SECRET = 'test-secret-key-at-least-32-chars-long';