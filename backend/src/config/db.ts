import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import http from "http";
import https from "https";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("WARN: Supabase credentials missing from Env!");
}

// Tạo keepAlive Agent để tái sử dụng kết nối HTTP tới Kong Gateway (tránh bắt tay TCP lại từ đầu)
const keepAliveAgentOpts = {
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
};

const httpAgent = new http.Agent(keepAliveAgentOpts);
const httpsAgent = new https.Agent(keepAliveAgentOpts);

const customFetch = (url: RequestInfo | URL, options?: any) => {
  const agent = url.toString().startsWith("https") ? httpsAgent : httpAgent;
  return fetch(url, {
    ...options,
    agent,
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
