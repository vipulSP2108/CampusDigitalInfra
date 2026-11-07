import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { ESCALATION_LEVELS } from "@/config/escalation";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { token, note } = await req.json();

    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: params.id }, { ticketNumber: params.id }],
      },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
    }

    const currentUser = await getCurrentUser();
    const isAuthorizedRequester = token && request.trackingToken === token;
    const isRequesterUser =
      currentUser &&
      currentUser.email &&
      request.requesterEmail &&
      currentUser.email.toLowerCase() === request.requesterEmail.toLowerCase();

    // Staff or Admin: Level 1 (Overall Admin), Level 2 (Dept Admin), Level 3 (Field Staff)
    const isStaffOrAdmin = Boolean(
      currentUser &&
      (currentUser.roleLevel <= 3 ||
        currentUser.roleCode === "OVERALL_ADMIN" ||
        currentUser.roleCode === "DEPT_ADMIN" ||
        currentUser.roleCode === "DEPT_STAFF")
    );

    if (!currentUser && !isAuthorizedRequester) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // ESCALATION POLICY ENFORCEMENT:
    // 1. Resident / End-User:
    //    Can ONLY escalate when staff marks the complaint as RESOLVED/DONE,
    //    within the 3-day verification grace period if the issue persists.
    // 2. Staff / Admin:
    //    Can escalate ANY matter at any time (technical/structural roadblocks).
    // -------------------------------------------------------------------------
    if (!isStaffOrAdmin) {
      if (request.status !== "RESOLVED") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Residents can only escalate after the technician marks the work as Done/Resolved, if you find the issue is not fixed within the 3-day verification grace window. For active complaints, technicians are currently attending to the issue.",
          },
          { status: 403 }
        );
      }

      // Check 3-day resolution verification grace window
      const graceMs = 3 * 24 * 60 * 60 * 1000; // 3 days
      const referenceTime = request.resolvedAt || request.updatedAt;
      const isWithinGrace = referenceTime && Date.now() - new Date(referenceTime).getTime() <= graceMs;

      if (!isWithinGrace) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The 3-day resolution verification grace window to escalate this complaint has concluded. Please submit a new maintenance request.",
          },
          { status: 403 }
        );
      }
    }

    const currentLevel = request.escalationLevel || 0;
    if (currentLevel >= 3) {
      return NextResponse.json(
        { success: false, error: "Already escalated to highest Institute authority (Level 3 Superintending Engineer)." },
        { status: 400 }
      );
    }

    const nextLevel = currentLevel + 1;
    const targetContact = ESCALATION_LEVELS.find((l) => l.level === nextLevel);
    const actorName = currentUser?.name || request.requesterName;
    const actorRole = isStaffOrAdmin ? (currentUser?.roleCode || "Staff") : "Resident";

    const escalationNote =
      note ||
      (isStaffOrAdmin
        ? `Field staff escalated issue to ${targetContact?.title || `Tier ${nextLevel}`}.`
        : `Resident reported work marked as resolved was ineffective/incomplete; escalated to ${targetContact?.title || `Tier ${nextLevel}`}.`);

    // If resident escalates a RESOLVED ticket, return it to REOPENED with elevated priority
    const statusUpdate = (!isStaffOrAdmin && request.status === "RESOLVED") ? "REOPENED" : request.status;

    await prisma.statusEvent.create({
      data: {
        requestId: request.id,
        performedById: currentUser?.id,
        performedByName: actorName,
        eventType: "ESCALATION",
        fromStatus: request.status,
        toStatus: statusUpdate,
        note: `[${actorRole}] ${escalationNote}`,
      },
    });

    const updated = await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        escalationLevel: nextLevel,
        escalatedAt: new Date(),
        escalationNote,
        status: statusUpdate,
        priority: "HIGH",
        isUrgent: true,
        ...(statusUpdate === "REOPENED" && {
          reopenCount: request.reopenCount + 1,
          reopenReason: `Escalated by resident: ${escalationNote}`,
          resolvedAt: null,
        }),
        updatedAt: new Date(),
      },
      include: {
        department: true,
        assignedStaff: {
          select: { id: true, name: true, email: true, phone: true },
        },
        attachments: true,
        statusEvents: {
          orderBy: { createdAt: "desc" },
        },
        followUps: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { followUps: true, attachments: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully escalated to ${targetContact?.title}`,
      escalationLevel: nextLevel,
      request: updated,
    });
  } catch (error) {
    console.error("Escalation error:", error);
    return NextResponse.json({ success: false, error: "Failed to escalate." }, { status: 500 });
  }
}
