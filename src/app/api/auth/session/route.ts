import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createSession, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    
    // Only return demo staff accounts if needed for the login selector
    const allUsers = await prisma.user.findMany({
      include: {
        role: true,
        department: true,
      },
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
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ success: false, error: "Session failure" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, department: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });
    }

    await createSession(email);

    return NextResponse.json({
      success: true,
      message: `Authenticated as ${user.name} (${user.role.name})`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleCode: user.role.code,
        roleLevel: user.role.level,
        departmentId: user.departmentId,
        departmentName: user.department?.name,
      },
    });
  } catch (error) {
    console.error("Session login error:", error);
    return NextResponse.json({ success: false, error: "Failed to authenticate" }, { status: 500 });
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
