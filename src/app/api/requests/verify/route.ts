import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey, envInt } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Brute-force protection: verification attempts are cheap to guess at.
    const limit = envInt("RATE_LIMIT_VERIFY_PER_HOUR", 30);
    const rl = rateLimit(clientKey(req, "verify"), limit, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many verification attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const { ticketNumber, token, email, phone } = await req.json();

    if (!ticketNumber) {
      return NextResponse.json(
        { success: false, error: "Ticket number is required." },
        { status: 400 }
      );
    }

    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        ticketNumber: ticketNumber.trim().toUpperCase(),
      },
    });

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Complaint ticket not found." },
        { status: 404 }
      );
    }

    // Verification Path 1: Secret Access Token
    if (token && token.trim() === request.trackingToken) {
      return NextResponse.json({
        success: true,
        verified: true,
        token: request.trackingToken,
      });
    }

    // Verification Path 2: Dual Identity Match (Registered Email + 10-Digit Phone)
    if (email && phone) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);

      const emailMatches = cleanEmail === request.requesterEmail.toLowerCase();
      const phoneMatches = Boolean(
        request.requesterPhone &&
        cleanPhone === request.requesterPhone.replace(/\D/g, "").slice(-10)
      );

      if (emailMatches && phoneMatches) {
        return NextResponse.json({
          success: true,
          verified: true,
          token: request.trackingToken,
          message: "Identity verified successfully.",
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "The provided email or mobile number does not match the complainant registered on this ticket.",
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Please provide either the secret access token or verify with your registered email and 10-digit mobile number.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { success: false, error: "Verification failed." },
      { status: 500 }
    );
  }
}
