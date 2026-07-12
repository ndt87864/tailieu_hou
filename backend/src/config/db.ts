import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { Agent } from "undici";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("WARN: Supabase credentials missing from Env!");
}

// Cấu hình undici Agent để kích hoạt Keep-Alive thực tế cho native fetch trong Node.js 18+
const undiciAgent = new Agent({
  keepAliveTimeout: 60000, // Giữ kết nối mở trong 60 giây
  connections: 100,        // Cho phép tối đa 100 kết nối song song
});

const customFetch = (url: RequestInfo | URL, options?: any) => {
  return fetch(url, {
    ...options,
    dispatcher: undiciAgent,
  });
};

// Client dùng service role để lấy dữ liệu bỏ qua RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
  },
});

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
  },
});
