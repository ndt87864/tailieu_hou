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
    timeout: 60000
  });

  let filename = `file_${Date.now()}`;
  const disposition = downloadRes.headers["content-disposition"];
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match) {
      try {
        filename = decodeURIComponent(match[1]);
      } catch (e) {
        filename = match[1];
      }
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

  // Chuẩn hóa tên file an toàn cho Supabase Storage: loại bỏ dấu tiếng Việt và thay các ký tự lạ bằng '_'
  filename = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

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
    if (src) {
      if (src.includes("grade_") || src.includes("/theme/image.php") || src.includes("coursemos/core")) {
        $(img).remove();
        continue;
      }
      if (src.startsWith("http")) {
        try {
          const publicUrl = await uploadFileToStorage(src, "images", getCookieHeader);
          $(img).attr("data-original-src", src);
          $(img).attr("src", publicUrl);
          uploadedUrls.push(publicUrl);
        } catch (err) {
          console.log(`   ⚠️ Không tải được ảnh: ${src}. Lỗi: ${err.message}`);
        }
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
  
  cloned.find("img").each((i, img) => {
    const originalSrc = $(img).attr("data-original-src") || $(img).attr("src");
    if (originalSrc) {
      // Với URL ảnh ehou: chỉ hiển thị "tên-file.png" thay vì cả URL dài
      const isEhouUrl = /https?:\/\/learning\.ehou\.edu\.vn\/pluginfile\.php/i.test(originalSrc);
      let replacement;
      if (isEhouUrl) {
        const fileName = originalSrc.split("/").pop() || originalSrc;
        replacement = ` "${fileName}" `;
      } else {
        replacement = ` ${originalSrc} `;
      }
      $(img).replaceWith(replacement);
    } else {
      $(img).remove();
    }
  });
  
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
