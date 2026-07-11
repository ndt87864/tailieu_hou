const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load env từ thư mục cha lms_crawler
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error("❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env!");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

const TARGET_DOMAIN = "https://supabase-hou.duckdns.org";
const LOCAL_DOMAINS = [
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

function replaceLocalUrls(text) {
  if (!text) return text;
  let newText = text;
  for (const localDomain of LOCAL_DOMAINS) {
    const escaped = localDomain.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    newText = newText.replace(regex, TARGET_DOMAIN);
  }
  return newText;
}

async function fixQuestions() {
  console.log("🔄 Đang quét và sửa bảng `crawler_questions`...");
  const { data: questions, error } = await supabaseAdmin
    .from("crawler_questions")
    .select("id, question, choices, answer, url_question, url_choices, url_answer");

  if (error) {
    console.error("❌ Lỗi lấy câu hỏi:", error.message);
    return;
  }

  console.log(`Found ${questions.length} questions in database.`);
  let updateCount = 0;

  for (const q of questions) {
    const originalQuestion = q.question;
    const originalUrlQ = q.url_question;
    const originalUrlC = q.url_choices;
    const originalUrlA = q.url_answer;

    let newChoices = q.choices;
    if (Array.isArray(q.choices)) {
      newChoices = q.choices.map(c => replaceLocalUrls(c));
    }

    const newQuestion = replaceLocalUrls(q.question);
    const newUrlQ = replaceLocalUrls(q.url_question);
    const newUrlC = replaceLocalUrls(q.url_choices);
    const newUrlA = replaceLocalUrls(q.url_answer);

    const hasChange = newQuestion !== originalQuestion ||
      newUrlQ !== originalUrlQ ||
      newUrlC !== originalUrlC ||
      newUrlA !== originalUrlA ||
      JSON.stringify(newChoices) !== JSON.stringify(q.choices);

    if (hasChange) {
      const { error: updateErr } = await supabaseAdmin
        .from("crawler_questions")
        .update({
          question: newQuestion,
          choices: newChoices,
          url_question: newUrlQ,
          url_choices: newUrlC,
          url_answer: newUrlA
        })
        .eq("id", q.id);

      if (updateErr) {
        console.error(`❌ Lỗi cập nhật câu hỏi ID ${q.id}:`, updateErr.message);
      } else {
        updateCount++;
      }
    }
  }
  console.log(`✅ Hoàn thành sửa bảng crawler_questions. Đã cập nhật ${updateCount} dòng.`);
}

async function fixResources() {
  console.log("🔄 Đang quét và sửa bảng `crawler_resources`...");
  const { data: resources, error } = await supabaseAdmin
    .from("crawler_resources")
    .select("id, content_url, raw_content");

  if (error) {
    console.error("❌ Lỗi lấy tài nguyên:", error.message);
    return;
  }

  console.log(`Found ${resources.length} resources in database.`);
  let updateCount = 0;

  for (const r of resources) {
    const originalUrl = r.content_url;
    const originalContent = r.raw_content;

    const newUrl = replaceLocalUrls(r.content_url);
    const newContent = replaceLocalUrls(r.raw_content);

    if (newUrl !== originalUrl || newContent !== originalContent) {
      const { error: updateErr } = await supabaseAdmin
        .from("crawler_resources")
        .update({
          content_url: newUrl,
          raw_content: newContent
        })
        .eq("id", r.id);

      if (updateErr) {
        console.error(`❌ Lỗi cập nhật tài nguyên ID ${r.id}:`, updateErr.message);
      } else {
        updateCount++;
      }
    }
  }
  console.log(`✅ Hoàn thành sửa bảng crawler_resources. Đã cập nhật ${updateCount} dòng.`);
}

async function run() {
  await fixQuestions();
  await fixResources();
  console.log("🎉 Hoàn tất sửa đổi toàn bộ database!");
}

run();
