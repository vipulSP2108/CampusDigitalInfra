import { createSession, getCurrentUser, destroySession, getCookieSecret } from '@/lib/auth/session';
import { sign, unsign } from 'cookie-signature';
import { vi } from 'vitest';

const SESSION_COOKIE_NAME = 'iitgn_staff_session_v4';

// Global mock cookies map
const mockCookies = new Map();

// Mock user data
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  active: true,
  role: {
    code: 'DEPT_STAFF',
    name: 'Department Staff',
    level: 3,
    permissions: [
      { permission: { code: 'COMPLAINT_VIEW_DEPT' } },
      { permission: { code: 'COMPLAINT_UPDATE_STATUS' } },
    ],
  },
  department: {
    id: 'dept-id',
    code: 'ELEC',
    name: 'Electrical Maintenance',
  },
};

// Mock next/headers cookies at module level
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === SESSION_COOKIE_NAME) {
        return { value: mockCookies.get(name) };
      }
      return undefined;
    },
    set: (name: string, value: string) => {
      mockCookies.set(name, value);
    },
    delete: (name: string) => {
      mockCookies.delete(name);
    },
  }),
}));

// Mock Prisma - vi.hoisted ensures the mock exists before vi.mock is hoisted
const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

describe('Session Cookie Signing', () => {
  const testEmail = 'test@example.com';
  const secret = 'test-secret-key-at-least-32-chars-long';

  beforeEach(() => {
    process.env.COOKIE_SECRET = secret;
    // Note: NODE_ENV is read-only in Next.js, so we don't set it here
    mockCookies.clear();
    vi.clearAllMocks();
  });

  describe('getCookieSecret', () => {
    it('should return secret when COOKIE_SECRET is set and >= 32 chars', () => {
      const result = getCookieSecret({ required: true });
      expect(result).toBe(secret);
    });

    it('should throw when COOKIE_SECRET is missing and required=true', () => {
      delete process.env.COOKIE_SECRET;
      expect(() => getCookieSecret({ required: true })).toThrow('COOKIE_SECRET environment variable is required');
    });

    it('should return null when COOKIE_SECRET is missing and required=false', () => {
      delete process.env.COOKIE_SECRET;
      const result = getCookieSecret({ required: false });
      expect(result).toBeNull();
    });

    it('should throw when COOKIE_SECRET is too short (< 32 chars)', () => {
      process.env.COOKIE_SECRET = 'short';
      expect(() => getCookieSecret({ required: true })).toThrow('COOKIE_SECRET must be at least 32 characters');
    });
  });

  it('should create signed session cookie with 24h maxAge', async () => {
    await createSession(testEmail);
    
    const cookieValue = mockCookies.get(SESSION_COOKIE_NAME);
    expect(cookieValue).toBeDefined();
    expect(cookieValue).not.toBe(testEmail); // Should be signed, not plain email
    
    const unsigned = unsign(cookieValue, secret);
    expect(unsigned).toBe(testEmail);
  });

  it('should reject tampered cookies (returns null without throwing)', async () => {
    // Create a valid session first
    await createSession(testEmail);
    const validCookie = mockCookies.get(SESSION_COOKIE_NAME);
    
    // Tamper with the cookie
    mockCookies.set(SESSION_COOKIE_NAME, validCookie + 'tampered');
    
    // Mock prisma to not find user (since cookie is invalid)
        findUniqueMock.mockResolvedValue(null);
    
    const user = await getCurrentUser();
    expect(user).toBeNull(); // Should reject tampered cookie
  });

  it('should reject unsigned cookies (returns null without throwing)', async () => {
    // Set unsigned cookie directly (simulating an attacker)
    mockCookies.set(SESSION_COOKIE_NAME, testEmail);
    
    // Mock prisma to not find user (since cookie is invalid)
        findUniqueMock.mockResolvedValue(null);
    
    const user = await getCurrentUser();
    expect(user).toBeNull(); // Should reject unsigned cookie
  });

  it('should accept valid signed cookies', async () => {
    // Create a properly signed cookie
    const signedEmail = sign(testEmail, secret);
    mockCookies.set(SESSION_COOKIE_NAME, signedEmail);
    
    // Mock prisma to return our test user
        findUniqueMock.mockResolvedValue(mockUser);
    
    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.email).toBe(testEmail);
  });

  it('should reject cookie signed with different secret (rotation scenario)', async () => {
    // Create cookie with different secret
    const otherSecret = 'another-secret-key-at-least-32-chars-long-different';
    const signedWithOtherSecret = sign(testEmail, otherSecret);
    mockCookies.set(SESSION_COOKIE_NAME, signedWithOtherSecret);
    
    // Mock prisma to not find user
        findUniqueMock.mockResolvedValue(null);
    
    const user = await getCurrentUser();
    expect(user).toBeNull(); // Should reject cookie signed with different secret
  });

  it('should destroy session cookie', async () => {
    // Create session
    await createSession(testEmail);
    expect(mockCookies.has(SESSION_COOKIE_NAME)).toBe(true);
    
    // Destroy session
    await destroySession();
    expect(mockCookies.has(SESSION_COOKIE_NAME)).toBe(false);
  });

  it('getCurrentUser() must not throw on tampered cookie (blocker regression test)', async () => {
    // Create a valid session first
    await createSession(testEmail);
    const validCookie = mockCookies.get(SESSION_COOKIE_NAME);
    
    // Tamper with the cookie
    mockCookies.set(SESSION_COOKIE_NAME, validCookie + 'tampered');
    
    // Mock prisma to not find user
        findUniqueMock.mockResolvedValue(null);
    
    // This must NOT throw - the blocker was that getCurrentUser() called cookies().delete()
    // in a Server Component where cookies() is read-only
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('should return null for inactive user', async () => {
    const signedEmail = sign(testEmail, secret);
    mockCookies.set(SESSION_COOKIE_NAME, signedEmail);
    
        findUniqueMock.mockResolvedValue({ ...mockUser, active: false });
    
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('should return null for non-existent user', async () => {
    const signedEmail = sign(testEmail, secret);
    mockCookies.set(SESSION_COOKIE_NAME, signedEmail);
    
        findUniqueMock.mockResolvedValue(null);
    
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});