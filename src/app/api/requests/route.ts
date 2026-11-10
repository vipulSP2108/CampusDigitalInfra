import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { buildDepartmentFilter } from "@/lib/auth/rbac";
import { sortComplaintsByOperationalPriority } from "@/lib/queue/sorting";
import { rateLimit, clientKey, envInt } from "@/lib/security/rateLimit";
import crypto from "crypto";

// Map domains to department codes
const DOMAIN_TO_DEPT_CODE: Record<string, string> = {
  "Electrical": "ELEC",
  "Civil": "CIVIL",
  "Plumbing": "PLUMB",
  "Air-Conditioning": "HVAC",
  "Water-Cooler": "COOLER",
  "Carpentry": "CARP",
  "Network/IT": "IT",
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const currentUser = await getCurrentUser();

    // Query parameters
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");
    const search = searchParams.get("search");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category");

    // Base where clause enforcing RBAC
    let whereClause: any = {};

    const isStaffCall = searchParams.get("staffView") === "true";

    if (!isStaffCall || !currentUser) {
      // Unauthenticated or public resident query: must verify identity with BOTH email and 10-digit mobile number
      // to prevent unauthorized snooping on campus residents
      const requesterEmail = searchParams.get("email");
      const requesterPhone = searchParams.get("phone");
      if (!requesterEmail || !requesterPhone) {
        return NextResponse.json(
          {
            success: false,
            error: "To protect resident privacy, looking up complaints requires both your registered email and 10-digit mobile number.",
          },
          { status: 401 }
        );
      }
      const cleanPhone = requesterPhone.replace(/\D/g, "").slice(-10);
      whereClause.requesterEmail = requesterEmail.toLowerCase().trim();
      whereClause.requesterPhone = cleanPhone;
    } else {
      // Authenticated Staff: Check Role and Department scoping
      const isFieldStaff = currentUser.roleCode === "DEPT_STAFF" || currentUser.roleLevel === 3;
      if (isFieldStaff) {
        // Enforce technician scoping: Technicians never see each other's assigned tasks.
        // Admins control whether technicians can also view unassigned pool tasks.
        const setting = await prisma.systemSetting.findUnique({
          where: { key: "allow_staff_view_unassigned" },
        });
        const allowUnassigned = setting ? setting.value !== "false" : true;

        whereClause.departmentId = currentUser.departmentId || "NO_DEPT_ASSIGNED";
        if (allowUnassigned) {
          whereClause.AND = [
            ...(whereClause.AND || []),
            {
              OR: [
                { assignedStaffId: currentUser.id },
                { assignedStaffId: null },
              ],
            },
          ];
        } else {
          whereClause.assignedStaffId = currentUser.id;
        }
      } else {
        const deptFilter = buildDepartmentFilter(currentUser, departmentId || undefined);
        whereClause = { ...whereClause, ...deptFilter };
      }
    }

    // Additional filters
    if (status && status !== "ALL") {
      whereClause.status = status;
    }
    if (priority && priority !== "ALL") {
      whereClause.priority = priority;
    }
    if (category && category !== "ALL") {
      whereClause.category = category;
    }
    if (search && search.trim() !== "") {
      const q = search.trim();
      const searchOr = [
        { ticketNumber: { contains: q } },
        { subject: { contains: q } },
        { requesterName: { contains: q } },
        { locationDetail: { contains: q } },
        { description: { contains: q } },
      ];
      whereClause.AND = [...(whereClause.AND || []), { OR: searchOr }];
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where: whereClause,
      include: {
        department: true,
        assignedStaff: {
          select: { id: true, name: true, email: true, phone: true },
        },
        attachments: true,
        followUps: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { followUps: true, attachments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Sort complaints by operational priority according to role context
    const sortedRequests = sortComplaintsByOperationalPriority(requests, currentUser);

    return NextResponse.json({
      success: true,
      count: sortedRequests.length,
      userRole: currentUser ? {
        level: currentUser.roleLevel,
        code: currentUser.roleCode,
        departmentName: currentUser.departmentName,
      } : null,
      requests: sortedRequests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Anti-abuse: cap public complaint submissions per IP.
    const submitLimit = envInt("RATE_LIMIT_SUBMIT_MAX", 10);
    const rl = rateLimit(clientKey(req, "submit"), submitLimit, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many submissions from this network. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = await req.json();

    // Anti-bot honeypot check
    if (body.website_url) {
      return NextResponse.json(
        { success: false, error: "Spam detected." },
        { status: 400 }
      );
    }

    const {
      category,
      domain,
      subDomain1,
      subDomain2,
      requesterName,
      requesterEmail,
      requesterPhone,
      locationCategory,
      locationDetail,
      corridor,
      availability,
      subject,
      description,
      priority = "NORMAL",
      isUrgent = false,
      attachments = [],
    } = body;

    // Basic validation (Email is primary and mandatory; phone is optional for resident privacy)
    if (!requesterName || !requesterEmail || !subject || !domain || !locationDetail) {
      return NextResponse.json(
        { success: false, error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    // Determine target department
    const targetDeptCode = DOMAIN_TO_DEPT_CODE[domain] || "CIVIL";
    let department = await prisma.department.findUnique({
      where: { code: targetDeptCode },
    });

    if (!department) {
      department = await prisma.department.findFirst();
    }

    if (!department) {
      return NextResponse.json(
        { success: false, error: "Department service unavailable." },
        { status: 500 }
      );
    }

    // Generate Collision-Proof Unique Ticket Number: e.g. IITGN-2026-XXXX
    const year = new Date().getFullYear();
    const existingTickets = await prisma.maintenanceRequest.findMany({
      where: {
        ticketNumber: {
          startsWith: `IITGN-${year}-`,
        },
      },
      select: { ticketNumber: true },
    });

    let maxSeq = 0;
    for (const t of existingTickets) {
      const match = t.ticketNumber.match(/IITGN-\d{4}-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    let nextSeq = maxSeq + 1;
    let ticketNumber = `IITGN-${year}-${String(nextSeq).padStart(4, "0")}`;
    while (await prisma.maintenanceRequest.findUnique({ where: { ticketNumber } })) {
      nextSeq++;
      ticketNumber = `IITGN-${year}-${String(nextSeq).padStart(4, "0")}`;
    }

    // Generate cryptographically random secret tracking token
    const trackingToken = crypto.randomBytes(16).toString("hex");

    const cleanedPhone =
      requesterPhone && typeof requesterPhone === "string" && requesterPhone.trim()
        ? requesterPhone.replace(/\D/g, "").slice(-10)
        : null;

    // Create the Request
    const newRequest = await prisma.maintenanceRequest.create({
      data: {
        ticketNumber,
        trackingToken,
        category: category || "general",
        departmentId: department.id,
        domain,
        subDomain1: subDomain1 || "General",
        subDomain2: subDomain2 || null,
        requesterName: requesterName.trim(),
        requesterEmail: requesterEmail.trim().toLowerCase(),
        requesterPhone: cleanedPhone,
        sharePhoneWithStaff: body.sharePhoneWithStaff !== false,
        locationCategory: locationCategory || "Campus",
        locationDetail: locationDetail.trim(),
        corridor: corridor || null,
        availability: availability || "Anytime during working hours",
        subject: subject.trim(),
        description: description ? description.trim() : subject.trim(),
        priority: "NORMAL",
        isUrgent: false,
        status: "SUBMITTED",
      },
    });

    // Create initial submission audit event
    await prisma.statusEvent.create({
      data: {
        requestId: newRequest.id,
        performedByName: requesterName,
        eventType: "SUBMISSION",
        toStatus: "SUBMITTED",
        note: `Complaint filed via Open Public Portal for ${domain} (${department.name}).`,
      },
    });

    // Check user authentication: Guest users are NOT allowed to add images
    const currentUser = await getCurrentUser();
    const isGuest = !currentUser;

    // Handle optional attachments ONLY for authenticated users
    if (!isGuest && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.url && att.name) {
          await prisma.attachment.create({
            data: {
              requestId: newRequest.id,
              url: att.url,
              originalName: att.name,
              mimeType: att.type || "image/jpeg",
              sizeBytes: att.size || 1024,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      ticketNumber: newRequest.ticketNumber,
      trackingToken: newRequest.trackingToken,
      department: department.name,
      message: "Complaint successfully registered with Institute Works Department.",
    });
  } catch (error) {
    console.error("Error creating maintenance request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit maintenance request." },
      { status: 500 }
    );
  }
}
