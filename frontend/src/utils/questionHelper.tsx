import React from "react";

/**
 * Làm sạch text câu hỏi/đáp án/lựa chọn bằng cách loại bỏ các link ảnh thô
 * như pluginfile.php, @@PLUGINFILE@@, hoặc các định dạng rút gọn.
 */
export const cleanQuestionText = (text: string, _hasUrl?: boolean): string => {
  if (!text) return "";
  
  let cleaned = text;

  // 1. Loại bỏ full URLs của pluginfile
  cleaned = cleaned.replace(/https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s"']*)?/gi, "");

  // 2. Loại bỏ đường dẫn @@PLUGINFILE@@ tương đối
  cleaned = cleaned.replace(/@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)/gi, "");

  // 3. Loại bỏ các đường dẫn rút gọn dạng .../image.png hoặc ../image.png
  cleaned = cleaned.replace(/(?:\.){2,}\/[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)/gi, "");

  // 4. Loại bỏ các tên file ảnh được bọc trong dấu nháy kép hoặc dấu nháy escaped
  cleaned = cleaned.replace(/\\?"?[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)\\?"?/gi, "");

  // 5. Dọn dẹp dấu ngoặc trống, dấu gạch nối dư thừa khi xóa URL
  cleaned = cleaned.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "");
  cleaned = cleaned.replace(/-\s*$/, "").replace(/:\s*$/, "");

  return cleaned.trim();
};

/**
 * Làm sạch chuỗi trước khi xuất ra Excel/Word (loại bỏ thẻ HTML và các HTML entities)
 */
export const cleanForExport = (text: string): string => {
  if (!text) return "";
  let cleaned = cleanQuestionText(text);
  
  // Strip HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  
  // Decode some common HTML entities
  cleaned = cleaned.replace(/&nbsp;/g, " ")
                   .replace(/&amp;/g, "&")
                   .replace(/&lt;/g, "<")
                   .replace(/&gt;/g, ">")
                   .replace(/&quot;/g, "\"")
                   .replace(/&#039;/g, "'");
                   
  // Replace multiple spaces with a single space
  return cleaned.replace(/\s+/g, " ").trim();
};

/**
 * Phân tích và render nội dung văn bản chứa link ảnh thành định dạng React Nodes (chứa text và tag img hiển thị ảnh)
 */
export const renderTextWithImages = (text: string, storageUrlsString?: string | null, className?: string) => {
  if (!text) return "";
  
  const storageUrls = storageUrlsString
    ? storageUrlsString.split(",").map(url => url.trim()).filter(Boolean)
    : [];
  
  // Regex hỗ trợ:
  // - \"https://.../pluginfile.php...\" (escaped quotes)
  // - "filename.png" (quoted filename)
  // - pluginfile.php URL thông thường
  // - @@PLUGINFILE@@ và relative paths
  const urlRegex = /(\\?"https?:\/\/[^\s"\\]+\/pluginfile\.php\/[^\s"\\]+\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s"\\]*)?\\?"|"[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)"|https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s"']*)?|@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|(?:\.){2,}\/[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)|[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
  
  const parts = text.split(urlRegex);
  if (parts.length === 1) {
    return text;
  }

  // Dọn dẹp các ký tự thừa cho text sau khi tách ảnh
  const cleanPartText = (txt: string) => {
    let clean = txt;
    clean = clean.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "");
    // Dọn dẹp các ký tự dấu nháy trôi nổi nếu regex split để lại
    clean = clean.replace(/^(\\?"|['"])+|(\\?"|['"])+$/g, "").trim();
    return clean;
  };

  const imageUrlPattern = /(\\?"https?:\/\/[^\s"\\]+\/pluginfile\.php\/[^\s"\\]+\.(?:png|jpe?g|gif|svg|webp|bmp)|"[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)"|https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|(?:\.){2,}\/[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)|[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/i;

  return parts.map((part, index) => {
    if (part && imageUrlPattern.test(part)) {
      let src = part;
      // Dọn sạch dấu nháy kép/nháy escaped
      src = src.replace(/^(\\?"|['"])+|(\\?"|['"])+$/g, "");

      // Trích xuất tên file từ URL LMS hoặc tên file trực tiếp
      let filename = "";
      if (src.includes("/") || src.includes("\\")) {
        const pathParts = src.split(/[/\\]/);
        filename = pathParts[pathParts.length - 1].split("?")[0].toLowerCase();
      } else {
        filename = src.split("?")[0].toLowerCase();
      }

      // Tìm kiếm link Supabase tương ứng có chứa tên file này
      let matchedSupabaseUrl = "";
      if (filename && storageUrls.length > 0) {
        const found = storageUrls.find(url => {
          try {
            const decodedUrl = decodeURIComponent(url).toLowerCase();
            return decodedUrl.includes(filename) || decodedUrl.endsWith(filename);
          } catch (e) {
            return url.toLowerCase().includes(filename);
          }
        });
        if (found) {
          matchedSupabaseUrl = found;
        }
      }

      // Chỉ hiển thị ảnh nếu đã có link đã upload từ Supabase, tránh load link LMS gốc gây lỗi auth redirect
      if (matchedSupabaseUrl) {
        return (
          <img
              key={index}
              src={matchedSupabaseUrl}
              alt="LMS Image"
              className={className || "max-h-24 object-contain inline-block my-1 align-middle rounded border p-0.5 bg-white"}
          />
        );
      }
      return null;
    }

    const cleaned = cleanPartText(part);
    return cleaned ? <React.Fragment key={index}>{cleaned}</React.Fragment> : null;
  }).filter(Boolean);
};

/** Chuẩn hóa chuỗi để so sánh: bỏ tiền tố a./b)/..., HTML, ký tự đặc biệt */
const normalizeForMatch = (s: string): string => {
  let str = s.toLowerCase().trim();
  str = str.replace(/<[^>]*>/g, "");
  str = str.replace(/^[a-e1-5][\.\)\-\:]\s*/i, "");
  str = str.replace(/\\?['"]/g, "");
  return str.replace(/\s+/g, " ").trim();
};

/** Levenshtein distance giữa 2 chuỗi */
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

/**
 * Tìm index của lựa chọn khớp nhất với đáp án (tỷ lệ lệch thấp nhất).
 * Trả về -1 nếu không có đáp án.
 */
export const findBestAnswerIndex = (choices: string[], answer: string): number => {
  if (!answer || !choices.length) return -1;
  const nAnswer = normalizeForMatch(answer);
  if (!nAnswer) return -1;

  let bestIdx = -1;
  let bestScore = Infinity;

  choices.forEach((choice, idx) => {
    const nChoice = normalizeForMatch(choice);
    const maxLen = Math.max(nChoice.length, nAnswer.length) || 1;
    const dist = levenshtein(nChoice, nAnswer);
    const ratio = dist / maxLen; // 0 = khớp hoàn hảo, 1 = hoàn toàn khác
    if (ratio < bestScore) {
      bestScore = ratio;
      bestIdx = idx;
    }
  });

  // Chỉ chấp nhận nếu tỷ lệ lệch < 60%
  return bestScore < 0.6 ? bestIdx : -1;
};

/**
 * @deprecated Dùng findBestAnswerIndex thay thế để tránh highlight nhiều đáp án.
 * Giữ lại để tương thích với code cũ.
 */
export const isAnswerMatching = (choice: string, answer: string): boolean => {
  if (!choice || !answer) return false;
  const nChoice = normalizeForMatch(choice);
  const nAnswer = normalizeForMatch(answer);
  if (nChoice === nAnswer) return true;
  if (nChoice.length > 3 && nAnswer.length > 3) {
    if (nChoice.includes(nAnswer) || nAnswer.includes(nChoice)) return true;
  }
  return false;
};
