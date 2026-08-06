import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";

const SYSTEM_PROXY_SECRET = process.env.NINE_ROUTER_PROXY_KEY || "hou_internal_admin_secret_2026";

function verifySsoToken(tokenString) {
  if (!tokenString || typeof tokenString !== "string") return null;
  const parts = tokenString.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SYSTEM_PROXY_SECRET)
    .update(payloadB64)
    .digest("hex");

  if (sig !== expectedSig) return null;

  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() > payload.exp) {
      return null; // Token expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  // Đảm bảo redirectPath chỉ là path tương đối an toàn
  const safeRedirect = redirectPath.startsWith("/") ? redirectPath : "/dashboard";

  const payload = verifySsoToken(token);
  if (payload) {
    // Đặt cookie auth_token cho 9router
    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, {
      sso: true,
      user: payload.email,
      role: payload.role,
    });
  }

  // Chuyển hướng thẳng tới trang đích trong Dashboard
  return NextResponse.redirect(new URL(safeRedirect, request.url));
}
