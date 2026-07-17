import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import bcrypt from "https://esm.sh/bcryptjs@2.4.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Lấy thông tin kết nối từ biến môi trường của Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    // Sử dụng SERVICE_ROLE_KEY để có toàn quyền thao tác cơ sở dữ liệu (bypass RLS)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? ""

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const action = url.searchParams.get("action")

    const { username, password, confirmPassword } = await req.json()
    const cleanUsername = String(username || "").trim().toLowerCase()

    if (!cleanUsername || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // --- ĐĂNG KÝ (REGISTER) ---
    if (action === "register") {
      if (password !== confirmPassword) {
        return new Response(
          JSON.stringify({ error: "Passwords do not match" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Kiểm tra username đã tồn tại chưa
      const { data: existingUser, error: checkError } = await supabase
        .from("custom_users")
        .select("username")
        .eq("username", cleanUsername)
        .maybeSingle()

      if (checkError) {
        console.error("Lỗi khi kiểm tra user tồn tại:", checkError)
      }

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "Username is already taken" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Mã hóa mật khẩu
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      // Lưu người dùng mới vào bảng `custom_users`
      const { error: insertError } = await supabase
        .from("custom_users")
        .insert([{
          username: cleanUsername,
          password: hashedPassword,
          created_at: new Date().toISOString()
        }])

      if (insertError) {
        console.error("Lỗi khi thêm user vào database:", insertError)
        return new Response(
          JSON.stringify({ error: "Could not create user. Database error." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      console.log(`[Auth Edge Function] Đăng ký thành công tài khoản: ${cleanUsername}`)
      return new Response(
        JSON.stringify({ success: true, username: cleanUsername }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // --- ĐĂNG NHẬP (LOGIN) ---
    if (action === "login") {
      const { data: user, error: fetchError } = await supabase
        .from("custom_users")
        .select("*")
        .eq("username", cleanUsername)
        .maybeSingle()

      if (fetchError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid username or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // So khớp mật khẩu
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        return new Response(
          JSON.stringify({ error: "Invalid username or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      console.log(`[Auth Edge Function] Đăng nhập thành công tài khoản: ${cleanUsername}`)
      return new Response(
        JSON.stringify({ success: true, username: cleanUsername }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("Lỗi hệ thống trong Edge Function:", err)
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
