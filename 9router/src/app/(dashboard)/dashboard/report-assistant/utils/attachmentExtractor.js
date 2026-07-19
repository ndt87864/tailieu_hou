import { parsePdfText } from "./pdfParser";
import { parseDocxText } from "./docxParser";

const ATTACHMENT_TEXT_EXT_RE =
  /\.(txt|json|csv|md|js|ts|tsx|jsx|py|html|css|yaml|yml|xml|sh|log|ini|toml|env)$/i;

export function isImageAttachment(file) {
  return String(file?.type || "").startsWith("image/");
}

export function isPdfAttachment(file) {
  return (
    /\.pdf$/i.test(String(file?.name || "")) ||
    String(file?.type || "").toLowerCase() === "application/pdf"
  );
}

export function isDocxAttachment(file) {
  return (
    /\.docx$/i.test(String(file?.name || "")) ||
    String(file?.type || "").toLowerCase() ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function isTextAttachment(file) {
  return (
    String(file?.type || "").startsWith("text/") ||
    ATTACHMENT_TEXT_EXT_RE.test(String(file?.name || ""))
  );
}

export function readTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

export async function fileFromAttachmentMeta(file) {
  if (file?.file instanceof File || file?.file instanceof Blob) {
    return file.file;
  }

  if (!file?.url) return null;
  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error(`Không thể tải nội dung tệp (${response.status})`);
  }

  const blob = await response.blob();
  return new File([blob], file.name || "attachment", {
    type: file.type || blob.type || "",
  });
}

export async function extractAttachmentContent(file) {
  if (!file || isImageAttachment(file)) {
    return { content: "", pageCount: 0 };
  }

  const sourceFile = await fileFromAttachmentMeta(file);
  if (!sourceFile) {
    return { content: "", pageCount: 0 };
  }

  if (isPdfAttachment(file) || String(sourceFile.type || "").includes("pdf")) {
    const result = await parsePdfText(sourceFile);
    return { content: result.text || "", pageCount: result.pageCount || 0 };
  }

  if (isDocxAttachment(file)) {
    const result = await parseDocxText(sourceFile);
    return { content: result.text || "", pageCount: result.pageCount || 0 };
  }

  if (isTextAttachment(file) || String(sourceFile.type || "").startsWith("text/")) {
    if (typeof sourceFile.text === "function") {
      return { content: (await sourceFile.text()) || "", pageCount: 1 };
    }
    const content = await readTextFile(sourceFile);
    return { content: content || "", pageCount: 1 };
  }

  return { content: "", pageCount: 0 };
}

export async function buildSerializedAttachments(files) {
  const list = Array.isArray(files) ? files : [];
  const serialized = await Promise.all(
    list.map(async (file) => {
      const base = {
        name: file.name,
        type: file.type,
        size: file.size,
      };

      if (isImageAttachment(file)) {
        return file.url ? { ...base, url: file.url } : base;
      }

      try {
        const extracted = await extractAttachmentContent(file);
        return {
          ...base,
          content: extracted.content || "",
          pageCount: extracted.pageCount || 0,
        };
      } catch (err) {
        console.error("Error extracting attachment content:", file.name, err);
        return base;
      }
    }),
  );

  return serialized;
}

export async function buildContentWithAttachments(baseText, files) {
  const list = Array.isArray(files) ? files : [];
  const imageFiles = list.filter(isImageAttachment);

  let finalContent = String(baseText || "");

  if (imageFiles.length > 1) {
    const multiImageInstruction = `[HƯỚNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghép lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
    finalContent = `${multiImageInstruction}${finalContent ? `\n${finalContent}` : ""}`;
  }

  return finalContent;
}
