import { prisma } from "@/lib/prisma";
import {
  LIFECYCLE_CONFIG,
  calculatePurgeDate,
  isClosedTicketArchiveDue,
} from "@/config/lifecycle";

export interface ArchivalSweepResult {
  archivedAdminClosedCount: number;
  archivedUserClosedCount: number;
  purgedCount: number;
  processedAt: string;
}

/**
 * Transfers a single maintenance request to secondary archival storage and removes it from the active database.
 */
export async function archiveSingleRequest(requestId: string) {
  const req = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: {
      department: true,
      assignedStaff: true,
      attachments: true,
      statusEvents: {
        orderBy: { createdAt: "asc" },
      },
      followUps: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!req) return null;

  const now = new Date();
  const closedAt = req.closedAt || now;
  const purgeDueAt = calculatePurgeDate(now);

  const archiveData = {
    ticketNumber: req.ticketNumber,
    trackingToken: req.trackingToken,
    category: req.category,
    departmentId: req.departmentId,
    departmentName: req.department?.name || req.domain,
    domain: req.domain,
    subDomain1: req.subDomain1,
    subDomain2: req.subDomain2,
    requesterName: req.requesterName,
    requesterEmail: req.requesterEmail,
    requesterPhone: req.requesterPhone,
    sharePhoneWithStaff: req.sharePhoneWithStaff ?? true,
    locationCategory: req.locationCategory,
    locationDetail: req.locationDetail,
    corridor: req.corridor,
    availability: req.availability,
    subject: req.subject,
    description: req.description,
    priority: req.priority,
    status: "CLOSED",
    closedByRole: req.closedByRole || "admin",
    closedAt,
    archivedAt: now,
    purgeDueAt,
    statusEventsJson: JSON.stringify(req.statusEvents),
    followUpsJson: JSON.stringify(req.followUps),
    attachmentsJson: JSON.stringify(req.attachments),
    assignedStaffName: req.assignedStaff?.name || null,
    assignedStaffEmail: req.assignedStaff?.email || null,
    reopenCount: req.reopenCount,
    satisfactionRating: req.satisfactionRating,
    feedbackComments: req.feedbackComments,
    originalCreatedAt: req.createdAt,
  };

  const [archived] = await prisma.$transaction([
    prisma.archivedRequest.upsert({
      where: { ticketNumber: req.ticketNumber },
      create: archiveData,
      update: archiveData,
    }),
    prisma.maintenanceRequest.delete({
      where: { id: req.id },
    }),
  ]);

  return archived;
}

/**
 * Sweeps the database according to institutional lifecycle rules:
 * 1. Closed requests whose grace period expired -> transferred to secondary storage.
 *    - Admin/staff closed: 3 days grace
 *    - User/resident closed: 15 minutes grace
 * 2. Archived requests older than 180 days -> permanently purged.
 */
export async function checkAndRunArchivalSweep(): Promise<ArchivalSweepResult> {
  const now = new Date();

  // For admin-closed: 3 days threshold
  const adminThreshold = new Date(
    now.getTime() - LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS * 24 * 60 * 60 * 1000
  );

  // For user-closed: 15 minutes threshold
  const userThreshold = new Date(
    now.getTime() - LIFECYCLE_CONFIG.USER_CLOSED_ARCHIVE_DELAY_MINUTES * 60 * 1000
  );

  // Find all closed tickets
  const closedTickets = await prisma.maintenanceRequest.findMany({
    where: {
      status: "CLOSED",
    },
    select: { id: true, closedAt: true, closedByRole: true },
  });

  // Filter in-memory based on who closed it and their respective grace period
  const closedDueCandidates = closedTickets.filter((c) => {
    if (!c.closedAt) return false;
    const closedTime = new Date(c.closedAt).getTime();
    if (c.closedByRole === "requester") {
      // User-closed: 15 minutes
      return closedTime <= userThreshold.getTime();
    }
    // Admin/staff-closed: 3 days
    return closedTime <= adminThreshold.getTime();
  });

  let archivedAdminClosedCount = 0;
  let archivedUserClosedCount = 0;
  for (const c of closedDueCandidates) {
    try {
      await archiveSingleRequest(c.id);
      if (c.closedByRole === "requester") {
        archivedUserClosedCount++;
      } else {
        archivedAdminClosedCount++;
      }
    } catch (e) {
      console.error(`Failed to archive closed request ${c.id}:`, e);
    }
  }

  // 3. Purge expired records from secondary database (> 180 days)
  const purgeResult = await prisma.archivedRequest.deleteMany({
    where: {
      purgeDueAt: { lte: now },
    },
  });

  return {
    archivedAdminClosedCount,
    archivedUserClosedCount,
    purgedCount: purgeResult.count,
    processedAt: now.toISOString(),
  };
}

/**
 * Retrieves archived requests from the secondary database for administrative review.
 */
export async function getArchivedRequests(limit: number = 100) {
  return prisma.archivedRequest.findMany({
    take: limit,
    orderBy: { archivedAt: "desc" },
  });
}

/**
 * Retrieves a single archived request by ticket number.
 */
export async function getArchivedRequestByTicket(ticketNumber: string) {
  const cleanNum = ticketNumber.trim().toUpperCase();
  const archived = await prisma.archivedRequest.findUnique({
    where: { ticketNumber: cleanNum },
  });

  if (!archived) return null;

  return {
    ...archived,
    createdAt: archived.originalCreatedAt,
    department: {
      id: archived.departmentId,
      name: archived.departmentName || archived.domain,
    },
    assignedStaff: archived.assignedStaffName
      ? {
          name: archived.assignedStaffName,
          email: archived.assignedStaffEmail,
          phone: null,
        }
      : null,
    statusEvents: JSON.parse(archived.statusEventsJson || "[]"),
    followUps: JSON.parse(archived.followUpsJson || "[]"),
    attachments: JSON.parse(archived.attachmentsJson || "[]"),
    isArchived: true,
  };
}
