import React from "react";

/**
 * Làm sạch text câu hỏi/đáp án/lựa chọn bằng cách loại bỏ các link ảnh thô
 * như pluginfile.php, @@PLUGINFILE@@, hoặc các định dạng rút gọn.
 */
export const cleanQuestionText = (text: string, _hasUrl?: boolean): string => {
  if (!text) return "";
  
  let cleaned = text;

  // 1. Loại bỏ full URLs của pluginfile (ví dụ: https://learning.ehou.edu.vn/pluginfile.php/1537536/question/questiontext/1852077/1/3277330/cau1.png)
  cleaned = cleaned.replace(/https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s"']*)?/gi, "");

  // 2. Loại bỏ đường dẫn @@PLUGINFILE@@ tương đối
  cleaned = cleaned.replace(/@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)/gi, "");

  // 3. Loại bỏ các đường dẫn rút gọn dạng .../image.png hoặc ../image.png
  cleaned = cleaned.replace(/(?:\.){2,}\/[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)/gi, "");

  // 4. Dọn dẹp dấu ngoặc trống, dấu gạch nối dư thừa khi xóa URL
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
  
  const urlRegex = /(https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s"']*)?|@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|(?:\.){2,}\/[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)|[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
  
  const parts = text.split(urlRegex);
  if (parts.length === 1) {
    return text;
  }

  // Dọn dẹp các ký tự thừa cho text sau khi tách ảnh
  const cleanPartText = (txt: string) => {
    let clean = txt;
    clean = clean.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "");
    // Dọn dẹp dấu ngoặc hoặc nháy kép thừa xung quanh URL
    clean = clean.replace(/^["']|["']$/g, "").trim();
    return clean;
  };

  const imageUrlPattern = /https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s"']*)?|@@PLUGINFILE@@\/[^\s"']+\.(?:png|jpe?g|gif|svg|webp|bmp)|(?:\.){2,}\/[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)|[A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp)/i;

  return parts.map((part, index) => {
    if (imageUrlPattern.test(part)) {
      let src = part;
      if (src.startsWith('"') || src.startsWith("'")) src = src.slice(1);
      if (src.endsWith('"') || src.endsWith("'")) src = src.slice(0, -1);

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

/**
 * So sánh xem đáp án có khớp (hoặc gần khớp) với một trong các lựa chọn hay không.
 * Bỏ qua các tiền tố như "a.", "b)", "C -", "4:" và khoảng trắng thừa.
 */
export const isAnswerMatching = (choice: string, answer: string): boolean => {
  if (!choice || !answer) return false;
  
  const normalize = (s: string) => {
    let str = s.toLowerCase().trim();
    // Bỏ thẻ HTML nếu có
    str = str.replace(/<[^>]*>/g, "");
    // Bỏ các tiền tố đánh dấu như a., B), c -, 4:
    str = str.replace(/^[a-e1-5][\.\)\-\:]\s*/i, "");
    // Bỏ tất cả khoảng trắng
    return str.replace(/\s+/g, "");
  };

  const nChoice = normalize(choice);
  const nAnswer = normalize(answer);
  
  if (nChoice === nAnswer) return true;
  
  // Nếu 1 chuỗi chứa chuỗi kia và đủ dài để tránh bắt nhầm
  if (nChoice.length > 3 && nAnswer.length > 3) {
    if (nChoice.includes(nAnswer) || nAnswer.includes(nChoice)) return true;
  }
  return false;
};
