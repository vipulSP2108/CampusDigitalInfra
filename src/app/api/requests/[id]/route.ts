import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessDepartment } from "@/lib/auth/rbac";
import { getArchivedRequestByTicket } from "@/lib/lifecycle/lifecycleService";
import { LIFECYCLE_CONFIG } from "@/config/lifecycle";
import { canStaffViewResidentPhone } from "@/config/privacy";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const identifier = params.id;
    const token = searchParams.get("token");
    const currentUser = await getCurrentUser();

    // Find request in active operational database
    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { ticketNumber: identifier }],
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
      },
    });

    if (!request) {
      // Check secondary archival database (transferred tickets)
      const archived = await getArchivedRequestByTicket(identifier);
      if (archived) {
        const isAuthorizedRequester = token && archived.trackingToken === token;
        const isAuthorizedStaff =
          Boolean(currentUser && canAccessDepartment(currentUser, archived.departmentId));
        const isRequesterUser =
          currentUser &&
          currentUser.email &&
          archived.requesterEmail &&
          currentUser.email.toLowerCase() === archived.requesterEmail.toLowerCase();

        if (!isAuthorizedRequester && !isAuthorizedStaff && !isRequesterUser) {
          return NextResponse.json(
            { success: false, error: "Access denied. Valid tracking token or staff credentials required." },
            { status: 403 }
          );
        }

        const visibleFollowUps = (archived.followUps || []).filter((f: any) => {
          if (f.isInternalStaffOnly && !isAuthorizedStaff) return false;
          return true;
        });

        const canStaffCall = canStaffViewResidentPhone(archived);
        const effectivePhone = (isRequesterUser || isAuthorizedRequester || canStaffCall)
          ? archived.requesterPhone
          : null;

        return NextResponse.json({
          success: true,
          request: {
            ...archived,
            requesterPhone: effectivePhone,
            canStaffCall,
            sharePhoneWithStaff: archived.sharePhoneWithStaff ?? true,
            followUps: visibleFollowUps,
            isArchived: true,
            canReopen: false,
            reopenReasonMessage: "This request has exceeded the grace period and is archived in secondary storage.",
          },
        });
      }

      return NextResponse.json(
        { success: false, error: "Request not found." },
        { status: 404 }
      );
    }

    // Access check:
    // 1. Requester with matching secret trackingToken
    const isAuthorizedRequester = token && request.trackingToken === token;

    // 2. Authenticated Admin / Staff with department access
    const isAuthorizedStaff =
      Boolean(currentUser && canAccessDepartment(currentUser, request.departmentId));

    // 3. Authenticated resident viewing their own complaint
    const isRequesterUser =
      currentUser &&
      currentUser.email &&
      request.requesterEmail &&
      currentUser.email.toLowerCase() === request.requesterEmail.toLowerCase();

    if (!isAuthorizedRequester && !isAuthorizedStaff && !isRequesterUser) {
      return NextResponse.json(
        { success: false, error: "Access denied. Valid tracking token or staff credentials required." },
        { status: 403 }
      );
    }

    // Filter out internal-only staff notes if viewing as a public requester
    const visibleFollowUps = request.followUps.filter((f) => {
      if (f.isInternalStaffOnly && !isAuthorizedStaff) {
        return false;
      }
      return true;
    });

    // Calculate Reopen Grace Period Status based on who closed the ticket
    const isClosed = request.status === "CLOSED";
    let canReopen = request.status !== "CLOSED";
    let reopenDeadline: string | null = null;
    let graceWindowType: "3_days" | "15_minutes" | null = null;

    if (isClosed && request.closedAt) {
      const closedByRole = request.closedByRole || "admin";
      if (closedByRole === "requester") {
        // User/resident closed: 15 minutes grace
        graceWindowType = "15_minutes";
        const graceMs = LIFECYCLE_CONFIG.USER_CLOSED_ARCHIVE_DELAY_MINUTES * 60 * 1000;
        const deadline = new Date(new Date(request.closedAt).getTime() + graceMs);
        canReopen = Date.now() <= deadline.getTime();
        reopenDeadline = deadline.toISOString();
      } else {
        // Admin/staff closed: 3 days grace
        graceWindowType = "3_days";
        const graceMs = LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS * 24 * 60 * 60 * 1000;
        const deadline = new Date(new Date(request.closedAt).getTime() + graceMs);
        canReopen = Date.now() <= deadline.getTime();
        reopenDeadline = deadline.toISOString();
      }
    }

    // Resident Phone Privacy Policy: only disclose to staff if policy and resident permit it
    const canStaffCall = canStaffViewResidentPhone(request);
    const effectivePhone = (isRequesterUser || isAuthorizedRequester || canStaffCall)
      ? request.requesterPhone
      : null;

    return NextResponse.json({
      success: true,
      request: {
        ...request,
        requesterPhone: effectivePhone,
        canStaffCall,
        sharePhoneWithStaff: request.sharePhoneWithStaff ?? true,
        followUps: visibleFollowUps,
        isArchived: false,
        canReopen,
        reopenDeadline,
        graceWindowType,
        lifecycleConfig: {
          adminGraceDays: LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS,
          userGraceMinutes: LIFECYCLE_CONFIG.USER_CLOSED_ARCHIVE_DELAY_MINUTES,
          archivePurgeDays: LIFECYCLE_CONFIG.ARCHIVE_PURGE_RETENTION_DAYS,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching request details:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch request." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { token, sharePhoneWithStaff, requesterPhone } = await req.json();
    const identifier = params.id;

    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { ticketNumber: identifier }],
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
    const isAuthorizedStaff =
      Boolean(currentUser && canAccessDepartment(currentUser, request.departmentId));

    if (!isAuthorizedRequester && !isRequesterUser && !isAuthorizedStaff) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const updateData: {
      sharePhoneWithStaff?: boolean;
      requesterPhone?: string | null;
    } = {};

    if (typeof sharePhoneWithStaff === "boolean") {
      updateData.sharePhoneWithStaff = sharePhoneWithStaff;
    }

    if (requesterPhone !== undefined) {
      if (typeof requesterPhone === "string" && requesterPhone.trim()) {
        updateData.requesterPhone = requesterPhone.replace(/\D/g, "").slice(-10);
      } else {
        updateData.requesterPhone = null;
      }
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      request: updated,
      message: "Contact preferences updated successfully.",
    });
  } catch (error) {
    console.error("Error updating request contact preferences:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update request." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identifier = params.id;
    const currentUser = await getCurrentUser();

    // STRICT PERMISSION RULE:
    // Only the Overall Admin (Level 1 Admin / OVERALL_ADMIN) has the authority to permanently delete complaints.
    // Users, technicians, and departmental staff can only mark complaints as resolved/closed.
    const isOverallAdmin =
      currentUser &&
      (currentUser.roleCode === "OVERALL_ADMIN" || currentUser.roleLevel === 1);

    if (!isOverallAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized. Permanent deletion of complaint requests is strictly restricted to the Overall Administrator. Residents and other personnel may only mark requests as resolved.",
        },
        { status: 403 }
      );
    }

    // 1. Check if the complaint exists in active MaintenanceRequest records
    const activeRequest = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { ticketNumber: identifier }],
      },
    });

    if (activeRequest) {
      // Cascade delete all active associations
      await prisma.attachment.deleteMany({ where: { requestId: activeRequest.id } });
      await prisma.followUpComment.deleteMany({ where: { requestId: activeRequest.id } });
      await prisma.statusEvent.deleteMany({ where: { requestId: activeRequest.id } });
      await prisma.maintenanceRequest.delete({ where: { id: activeRequest.id } });

      return NextResponse.json({
        success: true,
        message: `Active complaint ${activeRequest.ticketNumber} was permanently deleted from the database by Overall Admin.`,
        deletedType: "active",
      });
    }

    // 2. Check if the complaint exists in passive / secondary ArchivedRequest records
    const archivedRequest = await prisma.archivedRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { ticketNumber: identifier }],
      },
    });

    if (archivedRequest) {
      await prisma.archivedRequest.delete({ where: { id: archivedRequest.id } });

      return NextResponse.json({
        success: true,
        message: `Archived complaint ${archivedRequest.ticketNumber} was permanently purged from the secondary database by Overall Admin.`,
        deletedType: "passive",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Complaint request not found in active or archived records.",
      },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error permanently deleting maintenance request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to permanently delete request." },
      { status: 500 }
    );
  }
}
