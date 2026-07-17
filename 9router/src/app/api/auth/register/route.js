import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { supabase } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { username, password, confirmPassword } = await request.json();

    // 1. Kiểm tra tính hợp lệ cơ bản ở BFF
    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || !password.trim()) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters long" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 2. Thao tác trực tiếp với Database Supabase (không qua Edge Function)
    try {
      // 2.1. Kiểm tra username đã tồn tại chưa
      const { data: existingUser, error: checkError } = await supabase
        .from("custom_users")
        .select("username")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (checkError) {
        console.error("[Auth Register Check Error]:", checkError);
        return NextResponse.json({ error: "Database connection error" }, { status: 500 });
      }

      if (existingUser) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }

      // 2.2. Mã hóa mật khẩu
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);

      // 2.3. Lưu người dùng mới vào bảng `custom_users`
      const { error: insertError } = await supabase
        .from("custom_users")
        .insert([{
          username: cleanUsername,
          password: hashedPassword,
          created_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error("[Auth Register Insert Error]:", insertError);
        return NextResponse.json({ error: "Could not create user. Database error." }, { status: 500 });
      }
    } catch (err) {
      console.error("[Auth Register Direct DB Error]:", err);
      return NextResponse.json({ error: "Failed to connect to database" }, { status: 500 });
    }

    // 3. Đăng ký thành công -> Tạo cookie xác thực đăng nhập tự động
    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, { username: cleanUsername });

    console.log(`[Auth Proxy] Đăng ký thành công tài khoản mới: ${cleanUsername}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
