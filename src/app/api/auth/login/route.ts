import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { authenticateCredentials } from "@/lib/auth/authenticate";
import { rateLimit, clientKey, envInt } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Brute-force protection
    const limit = envInt("RATE_LIMIT_LOGIN_PER_15MIN", 10);
    const rl = rateLimit(clientKey(req, "login"), limit, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many sign-in attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = await authenticateCredentials(body?.email, body?.password);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    await createSession(result.user.email);

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Authentication failure" },
      { status: 500 }
    );
  }
}