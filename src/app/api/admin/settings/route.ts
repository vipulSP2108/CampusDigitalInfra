import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const settingsRecords = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settingsRecords) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({
      success: true,
      settings: {
        allowStaffViewUnassigned: settingsMap["allow_staff_view_unassigned"] !== "false",
        ...settingsMap,
      },
    });
  } catch (error) {
    console.error("Error reading system settings:", error);
    return NextResponse.json({ success: false, error: "Failed to read settings." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.roleLevel > 2 && currentUser.roleCode !== "OVERALL_ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only Overall Admin and Department Admins can change settings." },
        { status: 403 }
      );
    }

    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: "Key and value are required." }, { status: 400 });
    }

    const stringVal = String(value);

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: stringVal,
        category: "staff_permissions",
        description: "Controls whether department technicians can view unassigned pool tasks in their department queue.",
      },
      update: {
        value: stringVal,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Setting ${key} updated successfully.`,
      setting,
    });
  } catch (error) {
    console.error("Error updating system setting:", error);
    return NextResponse.json({ success: false, error: "Failed to update setting." }, { status: 500 });
  }
}

