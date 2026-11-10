import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createSession, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { authenticateCredentials } from "@/lib/auth/authenticate";
import { rateLimit, clientKey, envInt } from "@/lib/security/rateLimit";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    // Demo profile directory: metadata only, never credentials.
    const allUsers = await prisma.user.findMany({
      include: { role: true, department: true },
      orderBy: { role: { level: "asc" } },
    });

    const demoProfiles = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleCode: u.role.code,
      roleName: u.role.name,
      roleLevel: u.role.level,
      departmentId: u.departmentId,
      departmentName: u.department?.name || "All Departments (Universal)",
    }));

    return NextResponse.json({
      success: true,
      user: currentUser,
      demoProfiles,
      // Server-authoritative flag so the UI can gate demo-only controls.
      demoMode: process.env.DEMO_MODE === "true",
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ success: false, error: "Session failure" }, { status: 500 });
  }
}

/**
 * POST /api/auth/session
 *
 * Two legitimate uses:
 *  1. Sign in with credentials (email + password) — always verified.
 *  2. Demo profile switcher, allowed only for an existing Overall Admin
 *     session or when server-side DEMO_MODE is explicitly enabled.
 *
 * Previously this endpoint accepted any email with no password at all, which
 * let anyone mint an admin session. That is fixed here.
 */
export async function POST(req: NextRequest) {
  try {
    const limit = envInt("RATE_LIMIT_SESSION_PER_15MIN", 20);
    const rl = rateLimit(clientKey(req, "session"), limit, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email: unknown = body?.email;
    const password: unknown = body?.password;

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Path A: real credential login
    if (typeof password === "string" && password.length > 0) {
      const result = await authenticateCredentials(cleanEmail, password);
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.message },
          { status: result.status }
        );
      }
      await createSession(result.user.email);
      return NextResponse.json({
        success: true,
        message: `Authenticated as ${result.user.name} (${result.user.roleName})`,
        user: result.user,
      });
    }

    // Path B: password-less switch — strictly gated
    const demoModeEnabled = process.env.DEMO_MODE === "true";
    const existing = await getCurrentUser();
    const isOverallAdmin =
      Boolean(existing) &&
      (existing!.roleLevel === 1 || existing!.roleCode === "OVERALL_ADMIN");

    if (!demoModeEnabled && !isOverallAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password is required. Profile switching is restricted to Overall Administrators or demo mode.",
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { role: true, department: true },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { success: false, error: "Staff member not found" },
        { status: 404 }
      );
    }

    await createSession(user.email);

    return NextResponse.json({
      success: true,
      message: `Authenticated as ${user.name} (${user.role.name})`,
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
    });
  } catch (error) {
    console.error("Session login error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await destroySession();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to log out" }, { status: 500 });
  }
}