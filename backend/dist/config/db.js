import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("WARN: Supabase credentials missing from Env!");
}
// Client dùng service role để lấy dữ liệu bỏ qua RLS của Auth API
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole || supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
    global: {
        fetch: (url, init) => {
            const headers = new Headers(init?.headers);
            headers.set("Connection", "close");
            return fetch(url, {
                ...init,
                keepalive: false,
                headers,
            });
        },
    },
});
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: (url, init) => {
            const headers = new Headers(init?.headers);
            headers.set("Connection", "close");
            return fetch(url, {
                ...init,
                keepalive: false,
                headers,
            });
        },
    },
});
