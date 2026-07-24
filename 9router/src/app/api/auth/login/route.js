import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { isOidcConfigured } from "@/lib/auth/oidc";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";
import { isLocalRequest } from "@/dashboardGuard";
import { createClient } from "@supabase/supabase-js";

const RESET_HINT = "Forgot password? Reset to default via 9Router CLI → Settings → Reset Password to Default.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function isTunnelRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
  const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
  return (tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost);
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const lock = checkLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s. ${RESET_HINT}`, retryAfter: lock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    const body = await request.json();
    const password = body.password || "";
    const userEmail = (body.email || body.username || "").trim();

    const settings = await getSettings();

    // Block login via tunnel/tailscale if dashboard access is disabled
    if (isTunnelRequest(request, settings) && settings.tunnelDashboardAccess !== true) {
      return NextResponse.json({ error: "Dashboard access via tunnel is disabled" }, { status: 403 });
    }

    if (settings.authMode === "oidc" && isOidcConfigured(settings)) {
      return NextResponse.json({ error: "Password login is disabled. Use OIDC sign in." }, { status: 403 });
    }

    // --- Strategy 1: Supabase Auth (TaiLieu HOU Users - Admin & Management) ---
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (userEmail && userEmail.includes("@") && supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: password,
        });

        if (!authError && authData?.user) {
          // Check role in profiles table
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name, email")
            .eq("id", authData.user.id)
            .maybeSingle();

          const userRole = profile?.role || "free";
          const ALLOWED_ROLES = ["admin", "management"];

          if (ALLOWED_ROLES.includes(userRole)) {
            recordSuccess(ip);
            const cookieStore = await cookies();
            await setDashboardAuthCookie(cookieStore, request, {
              username: profile?.email || userEmail,
              role: userRole,
              userId: authData.user.id,
            });
            return NextResponse.json({ success: true, user: { email: userEmail, role: userRole } }, { headers: NO_STORE_HEADERS });
          } else {
            return NextResponse.json(
              { error: `Tài khoản (${userEmail}) có quyền '${userRole}' không có quyền truy cập 9Router (Yêu cầu quyền Admin hoặc Management).` },
              { status: 403 }
            );
          }
        }
      } catch (supabaseErr) {
        console.warn("[Auth] Supabase auth error, falling back to local auth:", supabaseErr.message);
      }
    }

    // --- Strategy 2: Local 9Router Password Fallback ---
    const storedHash = settings.password;
    let isValid = false;
    if (storedHash) {
      isValid = await bcrypt.compare(password, storedHash);
    } else {
      const initialPassword = process.env.INITIAL_PASSWORD || "123456";
      isValid = password === initialPassword;
    }

    if (isValid) {
      recordSuccess(ip);
      const cookieStore = await cookies();
      await setDashboardAuthCookie(cookieStore, request, { username: "admin", role: "admin" });

      const mustChangePassword =
        !storedHash && !process.env.INITIAL_PASSWORD && !isLocalRequest(request);

      return NextResponse.json({ success: true, mustChangePassword }, { headers: NO_STORE_HEADERS });
    }

    const { remainingBeforeLock } = recordFail(ip);
    const postLock = checkLock(ip);
    if (postLock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${postLock.retryAfter}s. ${RESET_HINT}`, retryAfter: postLock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { "Retry-After": String(postLock.retryAfter) } }
      );
    }
    return NextResponse.json(
      { error: `Invalid password. ${remainingBeforeLock} attempt(s) left before lockout.`, remainingBeforeLock },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
