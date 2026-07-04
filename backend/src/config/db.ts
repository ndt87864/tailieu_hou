import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("WARN: Supabase credentials missing from Env!");
}

// Client dùng service role để lấy dữ liệu bỏ qua RLS
// BẬT keepalive để tái dùng TCP connection — tránh tạo connection mới mỗi query
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  // Không override global fetch → dùng Node.js built-in với keep-alive mặc định
});

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  // Không override global fetch → dùng Node.js built-in với keep-alive mặc định
});
