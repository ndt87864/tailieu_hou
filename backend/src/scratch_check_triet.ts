import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function run() {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("id, title, category_id, slug, premium, active");

  const trietDocs = docs?.filter(d => d.title.toLowerCase().includes("triết")) || [];
  console.log("Found triet docs:");
  console.log(JSON.stringify(trietDocs, null, 2));

  // Get categories to print names
  const { data: cats } = await supabaseAdmin.from("categories").select("id, title");
  const catMap = new Map(cats?.map(c => [c.id, c.title]));

  trietDocs.forEach(d => {
    console.log(`Document: ${d.title} (ID: ${d.id}), Category: ${catMap.get(d.category_id)}`);
  });
}

run();
