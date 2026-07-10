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
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=\s*UTF-8''([^";\n]+)/i);
    if (utf8Match) {
      try {
        filename = decodeURIComponent(utf8Match[1]);
      } catch (e) {
        // ignore
      }
    } else {
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      if (match) {
        try {
          // Node.js parses headers as latin1/binary. If the server sent UTF-8, convert to UTF-8.
          const rawFilename = match[1];
          filename = Buffer.from(rawFilename, 'binary').toString('utf8');
        } catch (e) {
          filename = match[1];
        }
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
  
  // Remove Moodle prefixes that may be concatenated without spaces
  // Handle patterns like: "Câu hỏi 5Câu trả lời đúngĐiểm 11,00 ngoài khoảng 11,00Complete the dialogue..."
  // Use lookahead to find the first actual question verb and extract from there
  const questionVerbs = [
    'Complete', 'Put', 'Read', 'Choose', 'Select', 'Listen', 'Write', 'Fill', 'Circle', 'Match', 'Use',
    'What', 'Which', 'Who', 'When', 'Where', 'Why', 'How', 'Is', 'Are', 'Do', 'Does', 'Did', 'Can', 'Could',
    'Decide', 'Look', 'Underline', 'Give', 'Đọc', 'Chọn', 'Viết', 'Nghe', 'Điền', 'Khoanh', 'Sử dụng',
    'Quyết định', 'Xem', 'Gạch chân', 'Cho'
  ];
  
  // Try to find the first question verb in the text
  let firstVerbIndex = -1;
  
  for (const verb of questionVerbs) {
    const regex = new RegExp(`\\b${verb}\\b`, 'i');
    const match = questionText.match(regex);
    if (match && match.index > 0) {
      if (firstVerbIndex === -1 || match.index < firstVerbIndex) {
        firstVerbIndex = match.index;
      }
    }
  }
  
  // If we found a question verb not at the start, extract from there
  if (firstVerbIndex > 0) {
    questionText = questionText.substring(firstVerbIndex).trim();
  } else {
    // Fallback: remove known Moodle prefixes with simple patterns
    questionText = questionText
      .replace(/^(Câu hỏi|Question)\s*\d+/gi, "")
      .replace(/^(Câu trả lời đúng|Correct answer|Right answer)/gi, "")
      .replace(/^(Đúng một phần|Partially correct)/gi, "")
      .replace(/Điểm\s*[\d\.,]+\s*ngoài khoảng\s*[\d\.,]+/gi, "")
      .replace(/^mô tả câu hỏi/i, "")
      .replace(/^\d+\s*[\.\)]\s*/, "")
      .trim();
  }
    
  // Enhanced instruction markers from hou_quiz
  const markers = [
    'Choose the best answer',
    'Choose the correct answer',
    'Select the best answer',
    'Select the correct answer',
    'Chọn câu trả lời đúng nhất',
    'Chọn đáp án đúng nhất',
    'Chọn một câu trả lời',
    'Chọn câu trả lời',
    'Choose one answer',
    'Trả lời câu hỏi',
    'Answer the question',
    'Are these following sentences true \\(T\\) or false \\(F\\)',
    'Are these following sentences true or false',
    'Are the following sentences true or false',
    'True or False',
    'True \\(T\\) or false \\(F\\)',
    'Read the text and do the activities that follow',
    'Choose A, B, C or D to complete the following sentence:',
    'Choose A, B, C or D to complete the sentence:',
    'Choose A, B, C, or D to complete the following sentence:',
    'Choose the lettered word or phrase',
    'Chọn câu trả lời đúng cho mỗi câu hoặc câu hỏi dưới đây',
    'Chọn câu trả lời đúng cho các câu dưới đây',
    'Chọn câu trả lời đúng cho các câu hỏi dưới đây',
    'Chọn câu trả lời đúng',
    'Chọn đáp án đúng',
    'chọn một câu trả lời',
    'chọn một',
    'chọn câu trả lời',
    'chọn đáp án',
    'trả lời câu hỏi'
  ];

  // Sort markers by length (longest first) to match more specific patterns first
  markers.sort((a, b) => b.length - a.length);

  const textLower = questionText.toLowerCase();
  
  for (const marker of markers) {
    const regex = new RegExp(marker, "gi");
    const matches = [...questionText.matchAll(regex)];

    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const lastIndex = lastMatch.index || 0;
      const contentAfter = questionText.substring(lastIndex + lastMatch[0].length).trim();
      const contentBefore = questionText.substring(0, lastIndex).trim();

      const looksLikeAnswerList = /(^|\n)\s*([A-Da-d]|\d+)[\.\)]\s+/m.test(contentAfter) ||
        /(^|\n)\s*a\.\s+/im.test(contentAfter) ||
        /\b(chọn|choose|select|circle|tick|đáp án)\b/i.test(contentAfter);

      if ((contentAfter.length === 0 || looksLikeAnswerList) && contentBefore.length > 5) {
        const segments = contentBefore.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/);
        const lastSegment = segments[segments.length - 1].trim();
        questionText = lastSegment.length > 5 ? lastSegment : contentBefore;
        break;
      }

      if (contentAfter.length > 5 && /[a-zA-Z0-9]/.test(contentAfter)) {
        questionText = contentAfter;
        break;
      }
    }
  }

  // Handle long reading passages - extract only the actual question
  const textWithoutUrls = questionText.replace(/https?:\/\/\S+/gi, "").replace(/"__IMAGE_URL_\d+__"/g, "");
  const isParagraphPrompt = textWithoutUrls.length > 300 || 
    /đọc (đoạn văn|đoạn hội thoại|bài khóa|bài đọc|đoạn thông tin|cuộc hội thoại|bài)/i.test(textWithoutUrls) ||
    /read the (text|passage|following|conversation|article)/i.test(textWithoutUrls);

  if (isParagraphPrompt) {
    const blankRegex = /([_.‥…\u2026]{2,}|_{2,}|(\.\s*){3,}|\[\s*\]|\(\s*\))/;
    const boldEls = cloned.find("strong, b");
    if (boldEls.length > 0) {
      const lastBold = boldEls[boldEls.length - 1];
      const boldTextRaw = $(lastBold).text().replace(/[\u00A0\s]+/g, " ").trim();
      const pTextRaw = questionText.replace(/[\u00A0\s]+/g, " ").trim();
      if (boldTextRaw.length > 15 && pTextRaw.endsWith(boldTextRaw)) {
        questionText = boldTextRaw;
      }
    }

    const segments = questionText.split(/(?<=[.!?]['""]*)\s+(?=[A-Z])/);
    if (segments.length >= 2) {
      const lastSegment = segments[segments.length - 1].trim();
      if (lastSegment.length > 15 && lastSegment.length < 500 && lastSegment.length < questionText.length * 0.5) {
        const qKeywords = /^(Which|What|Who|When|Where|Why|How|Is|Are|Do|Does|Did|Can|Could|It is probable|According to|In paragraph|The passage|The author|The word|The purpose|From|Based on|It can be|The statement|The phrase)/i;
        if (qKeywords.test(lastSegment) || /[?？]/.test(lastSegment) || blankRegex.test(lastSegment)) {
          questionText = lastSegment;
        }
      }
    }
  }

  // Clean up option prefixes at the end
  const optIndex = questionText.search(/\b[aA][\.\)]\s+/);
  if (optIndex !== -1 && optIndex > 10) {
    questionText = questionText.substring(0, optIndex).trim();
  }
  
  // Remove trailing punctuation
  questionText = questionText.replace(/[\.\u2026\-–—\s,;!\?\u2713\u2714]+$/g, '').trim();
  
  return questionText;
}

module.exports = {
  supabaseAdmin,
  uploadFileToStorage,
  processHtmlImagesAndUpload,
  cleanQuestionText
};
