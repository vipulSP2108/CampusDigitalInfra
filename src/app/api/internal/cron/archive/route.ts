import { NextRequest, NextResponse } from "next/server";
import { checkAndRunArchivalSweep } from "@/lib/lifecycle/lifecycleService";

/**
 * Internal cron endpoint for running the archival sweep.
 * Protected by CRON_SECRET environment variable.
 * 
 * Usage: POST /api/internal/cron/archive
 * Headers: Authorization: Bearer <CRON_SECRET>
 * 
 * Configure external cron (e.g., Vercel Cron Jobs, GitHub Actions, cron-job.org)
 * to hit this endpoint every 5-15 minutes.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify internal cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET not configured on server" },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid cron secret" },
        { status: 401 }
      );
    }

    const result = await checkAndRunArchivalSweep();

    return NextResponse.json({
      success: true,
      message: `Archival sweep complete: ${result.archivedAdminClosedCount} admin-closed ticket(s) archived (>3d), ${result.archivedUserClosedCount} resident-closed ticket(s) archived (>15m), and ${result.purgedCount} expired record(s) permanently purged (>180d).`,
      result,
    });
  } catch (error) {
    console.error("Error running archival sweep via cron:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run archival sweep." },
      { status: 500 }
    );
  }
}