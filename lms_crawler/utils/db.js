const axios = require("axios");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function uploadFileToStorage(url, prefix, getCookieHeader) {
  const headers = {};
  if (getCookieHeader) {
    headers["Cookie"] = getCookieHeader();
  }
  const downloadRes = await axios.get(url, {
    headers,
    responseType: "arraybuffer",
    timeout: 15000
  });

  let filename = `file_${Date.now()}`;
  const disposition = downloadRes.headers["content-disposition"];
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match) {
      filename = decodeURIComponent(match[1]).replace(/[/\\?%*:|"<>\s]/g, "_");
    }
  } else {
    const contentType = downloadRes.headers["content-type"] || "";
    if (contentType.includes("pdf")) filename += ".pdf";
    else if (contentType.includes("word") || contentType.includes("officedocument")) filename += ".docx";
    else if (contentType.includes("image")) {
      const ext = contentType.split("/")[1] || "png";
      filename += `.${ext}`;
    }
  }

  const storagePath = `${prefix}/${Date.now()}_${filename}`;
  const { error } = await supabaseAdmin.storage
    .from("lms-crawler-assets")
    .upload(storagePath, downloadRes.data, {
      contentType: downloadRes.headers["content-type"] || "application/octet-stream"
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("lms-crawler-assets")
    .getPublicUrl(storagePath);

  return publicUrl;
}

async function processHtmlImagesAndUpload(html, getCookieHeader) {
  if (!html) return { cleanHtml: "", uploadedUrls: [] };
  const $ = cheerio.load(html);
  const uploadedUrls = [];
  const imgs = $("img");

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const src = $(img).attr("src");
    if (src && src.startsWith("http")) {
      try {
        const publicUrl = await uploadFileToStorage(src, "images", getCookieHeader);
        $(img).attr("src", publicUrl);
        uploadedUrls.push(publicUrl);
      } catch (err) {
        console.log(`   ⚠️ Không tải được ảnh: ${src}. Lỗi: ${err.message}`);
      }
    }
  }
  return {
    cleanHtml: $("body").html() || html,
    uploadedUrls
  };
}

function cleanQuestionText($, qtextEl) {
  const cloned = $(qtextEl).clone();
  cloned.find("script, style, .answer, label, .prompt, .accesshide, .feedback, .generalfeedback").remove();
  cloned.find("img").remove();
  
  let questionText = cloned.text().replace(/\s+/g, " ").trim();
  
  questionText = questionText
    .replace(/^mô tả câu hỏi/i, "")
    .replace(/^câu hỏi \d+\s*chưa trả lời/i, "")
    .replace(/^câu hỏi \d+\s*đạt điểm\s*[\d\.,]+/i, "")
    .trim();
    
  const instructions = [
    /chọn một câu trả lời:?/i,
    /chọn một:?/i,
    /chọn câu trả lời:?/i,
    /chọn đáp án:?/i,
    /trả lời câu hỏi:?/i,
    /\b[a-fA-F][\.\)]\s*$/i
  ];
  instructions.forEach(regex => {
    questionText = questionText.replace(regex, "").trim();
  });
  
  const optIndex = questionText.search(/\b[aA][\.\)]\s+/);
  if (optIndex !== -1 && optIndex > 10) {
    questionText = questionText.substring(0, optIndex).trim();
  }
  
  return questionText;
}

module.exports = {
  supabaseAdmin,
  uploadFileToStorage,
  processHtmlImagesAndUpload,
  cleanQuestionText
};
