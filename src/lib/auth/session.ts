import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AuthenticatedUser } from "./rbac";
import { RoleCode } from "@/config/roles";
import { sign, unsign } from "cookie-signature";

const SESSION_COOKIE_NAME = "iitgn_staff_session_v4";
const LEGACY_COOKIE_NAME = "iitgn_mrs_session";

/**
 * Get the cookie signing secret from environment.
 * Fail closed: throws if not configured or too short.
 * @param opts.required - if false, returns null instead of throwing (for optional contexts)
 */
export function getCookieSecret(opts: { required?: boolean } = { required: true }): string | null {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    if (opts.required) {
      throw new Error("COOKIE_SECRET environment variable is required");
    }
    return null;
  }
  if (secret.length < 32) {
    throw new Error("COOKIE_SECRET must be at least 32 characters");
  }
  return secret;
}

/**
 * Create a signed session cookie for the given email.
 * Only callable from Route Handlers or Server Actions (where cookies() is writable).
 */
export async function createSession(email: string): Promise<void> {
  const secret = getCookieSecret({ required: true }) as string;
  const signedEmail = sign(email, secret);

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours (spec: stateless cookies must be short-lived)
  });
}

/**
 * Destroy the session cookie.
 * Only callable from Route Handlers or Server Actions.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

/**
 * Get the current authenticated user from the signed session cookie.
 * Verifies the cookie signature before looking up the user.
 * DOES NOT mutate cookies - safe to call from Server Components.
 * Stale/tampered cookies are cleared by middleware.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = cookies();
  const signedEmail = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!signedEmail) {
    return null;
  }

  const secret = getCookieSecret({ required: false });

  if (!secret) {
    // No secret configured - treat as unauthenticated
    return null;
  }

  // Verify and unsign the cookie
  const email = unsign(signedEmail, secret);

  if (!email) {
    // Cookie was tampered with or invalid signature
    // DO NOT delete cookie here - getCurrentUser() runs in Server Components
    // where cookies() is read-only. Middleware handles cleanup.
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        department: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role.code as RoleCode,
      roleName: user.role.name,
      roleLevel: user.role.level,
      departmentId: user.departmentId,
      departmentCode: user.department?.code,
      departmentName: user.department?.name,
      permissions,
    };
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return null;
  }
}

// Backward compatibility exports (synchronous, for existing callers that can't await)
// NOTE: These must only be called from Route Handlers or Server Actions
export function setSessionUserCookie(email: string) {
  const secret = getCookieSecret({ required: true }) as string;
  const signedEmail = sign(email, secret);

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export function clearSessionUserCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}