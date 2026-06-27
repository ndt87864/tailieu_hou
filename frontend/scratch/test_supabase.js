import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Connecting to Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data, error } = await supabase
      .from('student_infor')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Supabase query error:', error);
    } else {
      console.log('Query successful, records found:', data?.length);
      console.log('Sample record:', data?.[0]);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

test();
