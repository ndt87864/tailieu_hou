import { createSupabaseAdapter } from "./adapters/supabaseAdapter.js";

// Use global to survive Next.js dev hot-reload (module state resets on reload)
if (!global._dbAdapter) global._dbAdapter = { instance: null, initPromise: null, logged: false };
const state = global._dbAdapter;

async function initAdapter() {
  const username = process.env.DB_USERNAME || process.env.SUPABASE_USERNAME || "admin";
  if (!state.logged) {
    console.log(`[DB] Driver: supabase | username: ${username}`);
    state.logged = true;
  }
  return createSupabaseAdapter(username);
}

export async function getAdapter() {
  if (state.instance) return state.instance;
  if (!state.initPromise) state.initPromise = initAdapter().then((a) => { state.instance = a; return a; });
  return state.initPromise;
}

export function getAdapterSync() {
  if (!state.instance) {
    const username = process.env.DB_USERNAME || process.env.SUPABASE_USERNAME || "admin";
    state.instance = createSupabaseAdapter(username);
  }
  return state.instance;
}

