import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { LIFECYCLE_CONFIG } from "@/config/lifecycle";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.email) {
      return NextResponse.json(
        { success: false, error: "Authentication required to access personal request history." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "active";
    const email = currentUser.email.toLowerCase().trim();
    const emailVariants = [email, currentUser.email, currentUser.email.toUpperCase()];

    const now = new Date();
    const threeDaysGraceThreshold = new Date(
      now.getTime() - LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS * 24 * 60 * 60 * 1000
    );

    // Filter condition for active operational requests:
    // Either non-closed, or closed within the active 3-day reopen grace window
    const activeWhereClause = {
      requesterEmail: { in: emailVariants },
      OR: [
        { status: { not: "CLOSED" } },
        { closedAt: { gt: threeDaysGraceThreshold } },
      ],
    };

    // -------------------------------------------------------------------------
    // ON-DEMAND FETCH: Query Secondary Archival DB when history is requested
    // (Tickets enter this database after their 3-day cooldown expires)
    // -------------------------------------------------------------------------
    if (type === "history") {
      const archivedDbRequests = await prisma.archivedRequest.findMany({
        where: {
          requesterEmail: { in: emailVariants },
        },
        orderBy: { originalCreatedAt: "desc" },
      });

      const historyRequests = archivedDbRequests.map((a) => ({
        id: a.id,
        ticketNumber: a.ticketNumber,
        trackingToken: a.trackingToken,
        category: a.category,
        departmentId: a.departmentId,
        departmentName: a.departmentName || a.domain,
        domain: a.domain,
        subDomain1: a.subDomain1,
        subDomain2: a.subDomain2,
        requesterName: a.requesterName,
        requesterEmail: a.requesterEmail,
        requesterPhone: a.requesterPhone,
        locationCategory: a.locationCategory,
        locationDetail: a.locationDetail,
        corridor: a.corridor,
        availability: a.availability,
        subject: a.subject,
        description: a.description,
        priority: a.priority,
        isUrgent: a.priority === "EMERGENCY" || a.priority === "HIGH",
        status: a.status || "CLOSED",
        createdAt: a.originalCreatedAt,
        closedAt: a.closedAt,
        archivedAt: a.archivedAt,
        purgeDueAt: a.purgeDueAt,
        assignedStaff: a.assignedStaffName
          ? { name: a.assignedStaffName, email: a.assignedStaffEmail }
          : null,
        satisfactionRating: a.satisfactionRating,
        feedbackComments: a.feedbackComments,
        followUpsCount: 0,
        attachmentsCount: 0,
        isArchived: true,
        fromDb: "ARCHIVED_DB",
      }));

      const activeCount = await prisma.maintenanceRequest.count({
        where: activeWhereClause,
      });

      return NextResponse.json({
        success: true,
        type: "history",
        historyRequests,
        count: historyRequests.length,
        historyCount: historyRequests.length,
        activeCount,
      });
    }

    // -------------------------------------------------------------------------
    // DEFAULT: Fetch active requests in Primary DB (includes closed tickets within 3-day reopen cooldown)
    // -------------------------------------------------------------------------
    const activeDbRequests = await prisma.maintenanceRequest.findMany({
      where: activeWhereClause,
      include: {
        department: true,
        assignedStaff: {
          select: { id: true, name: true, email: true, phone: true },
        },
        attachments: true,
        _count: {
          select: { followUps: true, attachments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeRequests = activeDbRequests.map((r) => {
      const isClosed = r.status === "CLOSED";
      let reopenDeadline: string | null = null;
      let canReopen = !isClosed;
      if (isClosed && r.closedAt) {
        const deadline = new Date(
          new Date(r.closedAt).getTime() + LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS * 24 * 60 * 60 * 1000
        );
        canReopen = Date.now() <= deadline.getTime();
        reopenDeadline = deadline.toISOString();
      }

      return {
        id: r.id,
        ticketNumber: r.ticketNumber,
        trackingToken: r.trackingToken,
        category: r.category,
        departmentId: r.departmentId,
        departmentName: r.department?.name || r.domain,
        domain: r.domain,
        subDomain1: r.subDomain1,
        subDomain2: r.subDomain2,
        requesterName: r.requesterName,
        requesterEmail: r.requesterEmail,
        requesterPhone: r.requesterPhone,
        locationCategory: r.locationCategory,
        locationDetail: r.locationDetail,
        corridor: r.corridor,
        availability: r.availability,
        subject: r.subject,
        description: r.description,
        priority: r.priority,
        isUrgent: r.isUrgent,
        status: r.status,
        createdAt: r.createdAt,
        closedAt: r.closedAt,
        updatedAt: r.updatedAt,
        assignedStaff: r.assignedStaff,
        followUpsCount: r._count?.followUps || 0,
        attachmentsCount: r._count?.attachments || 0,
        isArchived: false,
        fromDb: "ACTIVE_DB",
        canReopen,
        reopenDeadline,
      };
    });

    const historyCount = await prisma.archivedRequest.count({
      where: {
        requesterEmail: { in: emailVariants },
      },
    });

    return NextResponse.json({
      success: true,
      type: "active",
      user: {
        name: currentUser.name,
        email: currentUser.email,
        roleCode: currentUser.roleCode,
        roleName: currentUser.roleName,
      },
      activeRequests,
      count: activeRequests.length,
      activeCount: activeRequests.length,
      historyCount,
    });
  } catch (error) {
    console.error("Error fetching user requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user requests." },
      { status: 500 }
    );
  }
}
