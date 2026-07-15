import { supabaseAdmin } from "../src/config/db.js";

async function test() {
  const { data, error } = await supabaseAdmin
    .from("spreadsheet_formulas")
    .select("*")
    .limit(1);
  console.log("DATA:", data);
  console.log("ERROR:", error);
}

test();
