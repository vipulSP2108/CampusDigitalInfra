import { describe, it, expect, beforeEach } from 'vitest';
import { checkCsrfOrigin } from '@/lib/security/csrf';

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe('checkCsrfOrigin', () => {
  const originalBaseUrl = process.env.APP_BASE_URL;

  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://maintenance.iitgn.ac.in';
  });

  it('allows safe methods (GET/HEAD/OPTIONS) without origin checks', () => {
    expect(checkCsrfOrigin(headers({ origin: 'https://evil.example' }), 'GET').ok).toBe(true);
    expect(checkCsrfOrigin(headers({ origin: 'https://evil.example' }), 'HEAD').ok).toBe(true);
    expect(checkCsrfOrigin(headers({ origin: 'https://evil.example' }), 'OPTIONS').ok).toBe(true);
  });

  it('allows mutating requests with no Origin/Referer (non-browser client)', () => {
    expect(checkCsrfOrigin(headers({ host: 'maintenance.iitgn.ac.in' }), 'POST').ok).toBe(true);
  });

  it('allows same-origin mutations (Origin matches host)', () => {
    const h = headers({
      host: 'maintenance.iitgn.ac.in',
      'x-forwarded-proto': 'https',
      origin: 'https://maintenance.iitgn.ac.in',
    });
    expect(checkCsrfOrigin(h, 'POST').ok).toBe(true);
  });

  it('allows same-origin mutations via APP_BASE_URL when host header differs', () => {
    const h = headers({
      host: 'internal-1234.onrender.com',
      origin: 'https://maintenance.iitgn.ac.in',
    });
    expect(checkCsrfOrigin(h, 'POST').ok).toBe(true);
  });

  it('blocks cross-origin mutations', () => {
    const h = headers({
      host: 'maintenance.iitgn.ac.in',
      'x-forwarded-proto': 'https',
      origin: 'https://evil.example',
    });
    const result = checkCsrfOrigin(h, 'POST');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Cross-origin');
  });

  it('blocks cross-origin PUT/PATCH/DELETE', () => {
    const h = headers({ host: 'maintenance.iitgn.ac.in', origin: 'https://evil.example' });
    expect(checkCsrfOrigin(h, 'PUT').ok).toBe(false);
    expect(checkCsrfOrigin(h, 'PATCH').ok).toBe(false);
    expect(checkCsrfOrigin(h, 'DELETE').ok).toBe(false);
  });

  it('falls back to Referer origin when Origin is absent', () => {
    const same = headers({
      host: 'maintenance.iitgn.ac.in',
      'x-forwarded-proto': 'https',
      referer: 'https://maintenance.iitgn.ac.in/admin',
    });
    expect(checkCsrfOrigin(same, 'POST').ok).toBe(true);

    const cross = headers({
      host: 'maintenance.iitgn.ac.in',
      referer: 'https://evil.example/attack',
    });
    expect(checkCsrfOrigin(cross, 'POST').ok).toBe(false);
  });

  it('uses first value of comma-separated forwarded headers', () => {
    const h = headers({
      'x-forwarded-proto': 'https, http',
      'x-forwarded-host': 'maintenance.iitgn.ac.in, internal',
      origin: 'https://maintenance.iitgn.ac.in',
    });
    expect(checkCsrfOrigin(h, 'POST').ok).toBe(true);
  });

  it('restores APP_BASE_URL', () => {
    if (originalBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalBaseUrl;
    expect(true).toBe(true);
  });
});