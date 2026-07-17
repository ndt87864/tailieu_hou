import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

let client = null;

export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!client) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
      }
      client = createClient(supabaseUrl, supabaseAnonKey);
    }
    return client[prop];
  }
});
