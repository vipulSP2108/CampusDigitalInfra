import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { ALLOWED_USERS } from "@/config/users";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check against the configurable allowed users schema (src/config/users.ts)
    const configuredUser = ALLOWED_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (configuredUser) {
      // Validate password if configured
      if (
        configuredUser.password &&
        password &&
        configuredUser.password !== password
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid password. Please check your credentials." },
          { status: 401 }
        );
      }

      // Check if user already exists in database, or create/sync them on demand
      let dbUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
        include: { role: true, department: true },
      });

      const role = await prisma.role.findUnique({
        where: { code: configuredUser.roleCode },
      });

      // Resolve department if applicable
      let deptId: string | null = null;
      if (configuredUser.departmentCode) {
        const dept = await prisma.department.findUnique({
          where: { code: configuredUser.departmentCode },
        });
        if (dept) deptId = dept.id;
      }

      if (!dbUser && role) {
        dbUser = await prisma.user.create({
          data: {
            email: cleanEmail,
            name: configuredUser.name,
            phone: configuredUser.phone || null,
            roleId: role.id,
            departmentId: deptId,
            active: true,
          },
          include: { role: true, department: true },
        });
      } else if (dbUser && role && dbUser.role.code !== configuredUser.roleCode) {
        // Sync role if updated in config
        dbUser = await prisma.user.update({
          where: { email: cleanEmail },
          data: {
            roleId: role.id,
            departmentId: deptId,
            name: configuredUser.name,
          },
          include: { role: true, department: true },
        });
      }

      // Set auth session cookie
      await createSession(cleanEmail);

      return NextResponse.json({
        success: true,
        user: {
          id: dbUser?.id || cleanEmail,
          name: dbUser?.name || configuredUser.name,
          email: cleanEmail,
          roleCode: configuredUser.roleCode,
          roleName: configuredUser.roleName || dbUser?.role?.name || "Authorized User",
          roleLevel: dbUser?.role?.level || (configuredUser.roleCode === "OVERALL_ADMIN" ? 1 : configuredUser.roleCode === "DEPT_ADMIN" ? 2 : configuredUser.roleCode === "DEPT_STAFF" ? 3 : 99),
          departmentId: dbUser?.departmentId,
          departmentName: configuredUser.departmentName || dbUser?.department?.name,
        },
      });
    }

    // 2. Fallback: check existing DB users directly
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { role: true, department: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User not authorized. Add this user to src/config/users.ts or create via Admin directory.",
        },
        { status: 404 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { success: false, message: "This account has been deactivated" },
        { status: 403 }
      );
    }

    // Set cookie
    await createSession(user.email);

    return NextResponse.json({
      success: true,
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
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Authentication failure" },
      { status: 500 }
    );
  }
}
