import { prisma } from "@/lib/prisma";
import { ALLOWED_USERS } from "@/config/users";
import { constantTimeEqual, verifyPassword } from "@/lib/auth/password";

export interface AuthenticatedPayload {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  roleLevel: number;
  departmentId: string | null;
  departmentName?: string | null;
}

export type AuthResult =
  | { ok: true; user: AuthenticatedPayload }
  | { ok: false; status: number; message: string };

/**
 * Single source of truth for credential verification.
 *
 * Both /api/auth/login and /api/auth/session delegate here so neither route can
 * drift into an unauthenticated path. A password is always required.
 */
export async function authenticateCredentials(
  rawEmail: unknown,
  rawPassword: unknown
): Promise<AuthResult> {
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return { ok: false, status: 400, message: "Email is required" };
  }
  // SECURITY: never allow password-less authentication (previous short-circuit bug).
  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    return { ok: false, status: 400, message: "Password is required." };
  }

  const cleanEmail = rawEmail.toLowerCase().trim();

  // ---- 1. Configured (seeded) accounts ----
  const configured = ALLOWED_USERS.find(
    (u) => u.email.toLowerCase() === cleanEmail
  );

  if (configured) {
    const ok = configured.passwordHash
      ? await verifyPassword(rawPassword, configured.passwordHash)
      : Boolean(
          configured.password &&
            constantTimeEqual(rawPassword, configured.password)
        );

    if (!ok) {
      return { ok: false, status: 401, message: "Invalid email or password." };
    }

    let dbUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { role: true, department: true },
    });

    const role = await prisma.role.findUnique({
      where: { code: configured.roleCode },
    });

    let deptId: string | null = null;
    if (configured.departmentCode) {
      const dept = await prisma.department.findUnique({
        where: { code: configured.departmentCode },
      });
      if (dept) deptId = dept.id;
    }

    if (!dbUser && role) {
      dbUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: configured.name,
          phone: configured.phone || null,
          roleId: role.id,
          departmentId: deptId,
          active: true,
        },
        include: { role: true, department: true },
      });
    } else if (dbUser && role && dbUser.role.code !== configured.roleCode) {
      dbUser = await prisma.user.update({
        where: { email: cleanEmail },
        data: {
          roleId: role.id,
          departmentId: deptId,
          name: configured.name,
        },
        include: { role: true, department: true },
      });
    }

    if (dbUser && !dbUser.active) {
      return {
        ok: false,
        status: 403,
        message: "This account has been deactivated",
      };
    }

    await prisma.user
      .update({ where: { email: cleanEmail }, data: { lastLoginAt: new Date() } })
      .catch(() => {});

    return {
      ok: true,
      user: {
        id: dbUser?.id || cleanEmail,
        name: dbUser?.name || configured.name,
        email: cleanEmail,
        roleCode: configured.roleCode,
        roleName: configured.roleName || dbUser?.role?.name || "Authorized User",
        roleLevel:
          dbUser?.role?.level ||
          (configured.roleCode === "OVERALL_ADMIN"
            ? 1
            : configured.roleCode === "DEPT_ADMIN"
            ? 2
            : configured.roleCode === "DEPT_STAFF"
            ? 3
            : 99),
        departmentId: dbUser?.departmentId ?? null,
        departmentName: configured.departmentName || dbUser?.department?.name,
      },
    };
  }

  // ---- 2. Existing DB users (stored hash only) ----
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
    include: { role: true, department: true },
  });

  // Generic failure to avoid account enumeration.
  if (!user || !user.active || !user.passwordHash) {
    return { ok: false, status: 401, message: "Invalid email or password." };
  }

  const valid = await verifyPassword(rawPassword, user.passwordHash);
  if (!valid) {
    return { ok: false, status: 401, message: "Invalid email or password." };
  }

  await prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role.code,
      roleName: user.role.name,
      roleLevel: user.role.level,
      departmentId: user.departmentId,
      departmentName: user.department?.name,
    },
  };
}