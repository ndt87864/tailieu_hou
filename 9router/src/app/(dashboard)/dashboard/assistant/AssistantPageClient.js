"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button, Badge } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { supabase } from "@/lib/supabaseClient";
import useUserStore from "@/store/userStore";
import { marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse PDF file to text using pdf.js (loaded from CDN dynamically).
 * Returns: { text: string, pageCount: number }
 * The text includes page markers like: "[Trang 1]\n..."
 */
async function parsePdfText(file) {
  return new Promise((resolve, reject) => {
    const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const doExtract = async (pdfjsLib) => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        let fullText = "";
        let lineNumber = 1;

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageLines = [];
          let lastY = null;
          let currentLine = "";

          for (const item of textContent.items) {
            if (item.str === undefined) continue;
            const y = item.transform ? item.transform[5] : null;
            if (lastY !== null && Math.abs(y - lastY) > 2) {
              if (currentLine.trim()) pageLines.push(currentLine.trim());
              currentLine = item.str;
            } else {
              currentLine += (currentLine && !currentLine.endsWith(" ") ? " " : "") + item.str;
            }
            lastY = y;
          }
          if (currentLine.trim()) pageLines.push(currentLine.trim());

          fullText += `[Trang ${pageNum}]\n`;
          for (const line of pageLines) {
            if (line) {
              fullText += `Dòng ${lineNumber}: ${line}\n`;
              lineNumber++;
            }
          }
          fullText += "\n";
        }

        resolve({ text: fullText.trim(), pageCount });
      } catch (err) {
        reject(err);
      }
    };

    if (window.pdfjsLib) {
      doExtract(window.pdfjsLib);
    } else {
      const script = document.createElement("script");
      script.src = PDFJS_CDN;
      script.onload = () => doExtract(window.pdfjsLib);
      script.onerror = () => reject(new Error("Không thể tải pdf.js"));
      document.head.appendChild(script);
    }
  });
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function textValue(v) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(textValue).filter(Boolean).join(" ");
  if (typeof v === "object") {
    if (typeof v.message === "string") return v.message;
    if (typeof v.error === "string") return v.error;
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function makeTitle(text = "") {
  const t = textValue(text).replace(/\s+/g, " ").trim();
  return t ? (t.length > 48 ? t.slice(0, 48) + "…" : t) : "New Chat";
}

function relTime(iso) {
  if (!iso) return "now";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function readTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}


// ─── Storage keys ─────────────────────────────────────────────────────────────

const getSK = (username) => {
  const prefix = `assistant.${username || "admin"}`;
  return {
    sessions: `${prefix}.sessions`,
    activeSession: `${prefix}.activeSession`,
    activeModel: `${prefix}.activeModel`,
    enabledModels: `${prefix}.enabledModels`,
    knownModels: `${prefix}.knownModels`,
    systemPrompt: `${prefix}.systemPrompt`,
    temperature: `${prefix}.temperature`,
  };
};

const DEFAULT_SYSTEM_PROMPT = `Bạn là một trợ lí học tập thông minh, nhiệt tình và dễ hiểu. Hãy luôn giao tiếp bằng tiếng Việt, trừ các trường hợp sau:
- Khi giảng dạy các môn học ngoại ngữ (tiếng Anh, tiếng Pháp, tiếng Trung, tiếng Nhật, v.v.) thì dùng ngôn ngữ đó kèm giải thích tiếng Việt.
- Khi sử dụng các thuật ngữ chuyên ngành khoa học, kỹ thuật, y học... mà không có từ tiếng Việt tương đương thì có thể giữ nguyên thuật ngữ gốc và giải thích nghĩa bằng tiếng Việt.

Phong cách trả lời: rõ ràng, có cấu trúc, dùng ví dụ thực tế gần gũi với học sinh/sinh viên Việt Nam. Nếu người dùng hỏi bài tập hay bài toán, hãy giải thích từng bước một cách chi tiết thay vì chỉ đưa ra đáp án.
- Khi trả lời các câu hỏi tự luận, hệ thống cần hành văn và sử dụng vốn từ giống phong cách hành văn và từ vựng của tài liệu kiến thức bổ trợ được cung cấp (nếu có). Trong trường hợp không có tài liệu kiến thức đi kèm, hãy hành văn và sử dụng vốn từ mặc định thông thường.`;
const DEFAULT_TEMPERATURE = 0.7;

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdownAndMath(text) {
  if (typeof text !== "string") return "";

  const mathBlocks = [];

  // 1. Extract block math: \[ ... \]
  let processedText = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, math) => {
    const placeholder = `MATHBLOCKPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: true, placeholder });
    return placeholder;
  });

  // 2. Extract block math: $$ ... $$
  processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
    const placeholder = `MATHBLOCKPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: true, placeholder });
    return placeholder;
  });

  // 3. Extract inline math: \( ... \) (double-escaped and single-escaped)
  processedText = processedText.replace(/\\\\\(([\s\S]+?)\\\\\)/g, (match, math) => {
    const placeholder = `MATHINLINEPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: false, placeholder });
    return placeholder;
  });
  processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (match, math) => {
    const placeholder = `MATHINLINEPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: false, placeholder });
    return placeholder;
  });

  // 4. Extract inline math: $ ... $
  processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    if (!math.trim()) return match;
    const placeholder = `MATHINLINEPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: false, placeholder });
    return placeholder;
  });

  // 5. Render Markdown using marked
  let html = "";
  try {
    html = marked.parse(processedText, {
      gfm: true,
      breaks: true,
    });
  } catch (err) {
    console.error("Marked parsing error:", err);
    html = processedText;
  }

  // 6. Restore math blocks and render them with KaTeX
  for (const item of mathBlocks) {
    try {
      const mathHtml = katex.renderToString(item.math, {
        displayMode: item.isBlock,
        throwOnError: false,
      });
      html = html.replace(item.placeholder, mathHtml);
    } catch (e) {
      console.error("KaTeX rendering error:", e);
      html = html.replace(item.placeholder, `<span class="text-red-500 font-mono">${item.math}</span>`);
    }
  }

  return html;
}

function removeVietnameseTones(str) {
  if (typeof str !== "string") return "";
  let s = str;
  s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  s = s.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  s = s.replace(/đ/g, "d");
  s = s.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  s = s.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  s = s.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  s = s.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  s = s.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  s = s.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  s = s.replace(/Đ/g, "D");
  s = s.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  s = s.replace(/\u02C6|\u0306|\u031B/g, "");
  return s;
}

function sanitizeStoragePathSegment(str) {
  if (typeof str !== "string") return "";
  let ascii = removeVietnameseTones(str);
  ascii = ascii.replace(/[^a-zA-Z0-9\s\-\_\.]/g, "");
  ascii = ascii.replace(/\s+/g, " ").trim();
  return ascii;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, className }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-[6px] font-medium transition-all",
        "border border-border text-text-muted hover:text-text-main hover:border-brand-500/40 hover:bg-bg",
        copied && "text-green-600 border-green-500/30 bg-green-50 dark:bg-green-950/30",
        className
      )}
    >
      <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 size-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-[var(--shadow-warm)]">
      <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex-shrink-0 size-7 rounded-full bg-surface-2 border border-border flex items-center justify-center">
      <span className="material-symbols-outlined text-text-muted text-[14px]">person</span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-text-muted"
          style={{ animation: `asstDot 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}

function MessageFilesGrid({ files }) {
  const images = files.filter(f => f.type?.startsWith("image/"));
  const nonImages = files.filter(f => !f.type?.startsWith("image/"));

  return (
    <div className="flex flex-col gap-1.5 max-w-full">
      {/* Images Grid */}
      {images.length > 0 && (
        <div className={cn(
          "grid gap-1.5 max-w-sm sm:max-w-md",
          images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"
        )}>
          {images.map((img, idx) => (
            <a
              key={idx}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative rounded-[8px] overflow-hidden border border-border bg-bg group flex items-center justify-center aspect-square"
            >
              <img
                src={img.url}
                alt={img.name}
                className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
              />
            </a>
          ))}
        </div>
      )}
      
      {/* Document chips */}
      {nonImages.length > 0 && (
        <div className="flex flex-col gap-1 max-w-xs sm:max-w-sm">
          {nonImages.map((file, idx) => {
            const isText = file.type?.startsWith("text/") || 
                           /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(file.name);
            const icon = isText ? "description" : "draft";
            return (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] border border-border bg-surface-2 text-text-main hover:bg-surface-3 transition-colors text-[12px] font-medium"
              >
                <span className="material-symbols-outlined text-[16px] text-text-muted">{icon}</span>
                <span className="truncate flex-1" title={file.name}>{file.name}</span>
                <span className="text-[10px] text-text-subtle flex-shrink-0 font-mono">({formatBytes(file.size)})</span>
                <span className="material-symbols-outlined text-[14px] text-text-subtle">download</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SourceFilePill({ item }) {
  const isLink = !!item.url;
  
  const content = (
    <>
      <span className="material-symbols-outlined text-[13px]">description</span>
      <span className="truncate max-w-[140px] font-medium">{item.name}</span>
      {item.subject && (
        <span className="text-[9px] font-semibold opacity-75 bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1.5 py-0.2 rounded border border-brand-500/15 flex-shrink-0">
          {item.subject}
        </span>
      )}
      {item.details && (
        <span className="text-[9px] font-semibold opacity-85 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20 flex-shrink-0" title={item.details}>
          {item.details}
        </span>
      )}
    </>
  );

  if (isLink) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface hover:text-brand-500 hover:border-brand-500/30 hover:shadow-sm transition-all cursor-pointer select-none max-w-full"
        title={`Môn học: ${item.subject || "Khác"}${item.details ? ` | Chi tiết: ${item.details}` : ""}. Nhấp để xem/tải tài liệu.`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface text-text-subtle select-none max-w-full"
      title={item.details ? `Chi tiết: ${item.details}` : "Tài liệu chưa được liên kết URL"}
    >
      {content}
    </div>
  );
}

function MessageBlock({ msg, isStreaming, filesBySubject, onEditSubmit, onRegenerate }) {
  const isUser = msg.role === "user";
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content || "");

  // Update edit value if message content changes
  useEffect(() => {
    setEditVal(msg.content || "");
  }, [msg.content]);

  // Extract sources list and clean content from msg.content
  const { cleanContent, sources } = useMemo(() => {
    if (isUser || !msg.content) return { cleanContent: msg.content, sources: [] };
    
    const match = msg.content.match(/(.*)(?:\r?\n|^)(?:sources|source|nguồn|nguồn tham khảo)\s*:\s*(.*)$/is);
    if (match) {
      const clean = match[1].trimEnd();
      const sourcesPart = match[2].trim();
      const items = (sourcesPart.match(/[^,(]+(?:\([^)]+\))?/g) || [])
        .map(s => s.trim())
        .filter(Boolean);

      const parsed = items.map(item => {
        const matchItem = item.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (matchItem) {
          return {
            name: matchItem[1].trim(),
            details: matchItem[2] ? matchItem[2].trim() : null
          };
        }
        return { name: item, details: null };
      });
      return { cleanContent: clean, sources: parsed };
    }
    return { cleanContent: msg.content, sources: [] };
  }, [msg.content, isUser]);

  // Match sources to actual files with URLs and subjects
  const sourceItems = useMemo(() => {
    if (isUser || !sources || sources.length === 0) return [];
    
    // Flatten files list
    const allFiles = [];
    for (const [subj, files] of Object.entries(filesBySubject || {})) {
      if (Array.isArray(files)) {
        for (const f of files) {
          allFiles.push({ ...f, subject: subj });
        }
      }
    }

    return sources.map((src) => {
      const matched = allFiles.find(af => af.name.toLowerCase().trim() === src.name.toLowerCase().trim());
      return {
        name: src.name,
        url: matched?.url || null,
        subject: matched?.subject || null,
        matched: !!matched,
        details: src.details
      };
    });
  }, [sources, filesBySubject, isUser]);

  const renderContent = useCallback(() => {
    if (!cleanContent) return isStreaming ? <TypingDots /> : null;

    const parts = cleanContent.split(/(```[\w]*\n?[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (codeMatch) {
        const lang = codeMatch[1] || "code";
        const code = codeMatch[2].trimEnd();
        return (
          <div key={i} className="my-2 rounded-[10px] overflow-hidden border border-border bg-bg">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-2">
              <span className="text-[11px] text-text-muted font-mono">{lang}</span>
              <CopyButton text={code} />
            </div>
            <pre className="p-3 overflow-x-auto text-[12.5px] leading-relaxed text-text-main font-mono">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      const html = renderMarkdownAndMath(part);
      return <div key={i} className="asst-md" dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }, [cleanContent, isStreaming]);

  if (isUser) {
    if (isEditing) {
      return (
        <div className="flex justify-end gap-2 items-start" style={{ animation: "asstSlideUp 0.2s ease both" }}>
          <div className="max-w-[78%] min-w-0 flex flex-col items-end gap-1.5">
            <div className="w-full flex flex-col gap-2 min-w-[280px] bg-surface border border-border p-3 rounded-[16px] shadow-[var(--shadow-warm)]">
              <textarea
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                className="w-full p-2.5 rounded-[12px] border border-border bg-bg text-text-main text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 custom-scrollbar resize-y min-h-[80px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditVal(msg.content || "");
                  }}
                  className="px-2.5 py-1 text-xs rounded-[8px] border border-border text-text-muted hover:text-text-main hover:bg-surface-2 transition-all font-semibold"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (editVal.trim() && editVal.trim() !== msg.content) {
                      onEditSubmit?.(msg.id, editVal);
                    }
                    setIsEditing(false);
                  }}
                  className="px-3 py-1 text-xs rounded-[8px] bg-brand-500 hover:bg-brand-600 text-white transition-all font-semibold shadow-sm"
                >
                  Lưu & Gửi
                </button>
              </div>
            </div>
          </div>
          <UserAvatar />
        </div>
      );
    }

    return (
      <div className="flex justify-end gap-2 items-end group" style={{ animation: "asstSlideUp 0.2s ease both" }}>
        <div className="max-w-[78%] min-w-0 flex flex-col items-end gap-1.5">
          {msg.files && msg.files.length > 0 && (
            <MessageFilesGrid files={msg.files} />
          )}
          {msg.content && (
            <div 
              className="px-4 py-2.5 rounded-[16px] rounded-br-[4px] bg-brand-500 text-white text-sm leading-relaxed shadow-[var(--shadow-warm)] asst-md-user"
              dangerouslySetInnerHTML={{ __html: renderMarkdownAndMath(msg.content) }}
            />
          )}
          
          {/* Action Row for User message */}
          <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
            <CopyButton text={msg.content} className="!border-none !bg-transparent hover:!bg-surface-2 p-1 rounded-full text-text-muted hover:text-text-main text-[11px]" />
            <button
              onClick={() => {
                setEditVal(msg.content || "");
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-all font-medium"
              title="Sửa câu hỏi"
            >
              <span className="material-symbols-outlined text-[13px]">edit</span>
              <span>Sửa</span>
            </button>
          </div>
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-start group" style={{ animation: "asstSlideUp 0.2s ease both" }}>
      <AssistantAvatar />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-main leading-relaxed">
          {msg.files && msg.files.length > 0 && (
            <div className="mb-2">
              <MessageFilesGrid files={msg.files} />
            </div>
          )}
          {isStreaming && !cleanContent
            ? <TypingDots />
            : renderContent()
          }
          {isStreaming && cleanContent && (
            <span
              className="inline-block w-[2px] h-[14px] bg-brand-500 ml-0.5 rounded align-middle"
              style={{ animation: "asstBlink 1s infinite" }}
            />
          )}

          {/* Action Row for Assistant message */}
          {!isStreaming && cleanContent && (
            <div className="flex items-center gap-2 mt-2 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
              <CopyButton text={cleanContent} className="!border-none !bg-transparent hover:!bg-surface-2 px-2 py-0.5 rounded-[6px] text-text-muted hover:text-text-main text-[11px]" />
              <button
                onClick={() => onRegenerate?.(msg.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-all font-medium"
                title="Trả lời lại (tải lại)"
              >
                <span className="material-symbols-outlined text-[13px]">refresh</span>
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {/* Sources Section */}
          {sourceItems.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-subtle flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-text-subtle font-medium">
                <span className="material-symbols-outlined text-[15px] text-brand-500">menu_book</span>
                <span>Kiến thức áp dụng từ tài liệu:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sourceItems.length <= 5 ? (
                  sourceItems.map((item, idx) => (
                    <SourceFilePill key={idx} item={item} />
                  ))
                ) : (
                  <>
                    {sourceItems.slice(0, 4).map((item, idx) => (
                      <SourceFilePill key={idx} item={item} />
                    ))}
                    <button
                      onClick={() => setIsSeeAllOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-brand-500/20 bg-brand-500/10 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 hover:border-brand-500/35 transition-all cursor-pointer select-none"
                    >
                      <span className="material-symbols-outlined text-[13px]">visibility</span>
                      <span>+ {sourceItems.length - 4} Xem tất cả</span>
                    </button>
                  </>
                )}
              </div>

              {isSeeAllOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", animation: "asstFadeIn 0.15s ease" }}
                  onClick={e => e.target === e.currentTarget && setIsSeeAllOpen(false)}
                >
                  <div 
                    className="w-full max-w-md bg-surface border border-border rounded-[16px] shadow-[var(--shadow-elev)] flex flex-col max-h-[70vh] overflow-hidden" 
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-brand-500 text-[20px]">menu_book</span>
                        <div>
                          <h3 className="text-sm font-semibold text-text-main">Tài liệu kiến thức đã dùng</h3>
                          <p className="text-[10.5px] text-text-muted font-medium">Tổng cộng {sourceItems.length} tài liệu được sử dụng</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsSeeAllOpen(false)}
                        className="p-1.5 rounded-[8px] hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                      {sourceItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-3 rounded-[12px] border border-border bg-surface hover:bg-surface-2 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-1.5 rounded-[8px] bg-brand-500/10 text-brand-500">
                              <span className="material-symbols-outlined text-[18px]">description</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-text-main truncate max-w-[200px]" title={item.name}>
                                {item.name}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {item.subject && (
                                  <span className="text-[9px] font-semibold opacity-75 bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1 py-0.2 rounded border border-brand-500/15">
                                    {item.subject}
                                  </span>
                                )}
                                {item.details && (
                                  <span className="text-[9px] font-semibold opacity-85 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20">
                                    {item.details}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-brand-500 text-white hover:bg-brand-600 text-[11px] font-semibold transition-all cursor-pointer shadow-sm select-none"
                            >
                              <span className="material-symbols-outlined text-[14px]">download</span>
                              <span>Tải xuống</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-text-subtle italic bg-surface-2 px-2 py-0.5 rounded-[6px]">Không có link</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {msg.status === "error" && (
          <p className="text-xs text-danger mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            Failed to get response
          </p>
        )}
        {msg.latencyMs && !isStreaming && (
          <p className="text-[11px] text-text-subtle mt-1">{(msg.latencyMs / 1000).toFixed(1)}s</p>
        )}
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({
  isOpen,
  onClose,
  allModels,
  enabledModelIds,
  onToggleModel,
  systemPrompt,
  onSystemPrompt,
  temperature,
  onTemperature,
  subjects,
  filesBySubject,
  loadingKnowledge,
  loadKnowledge,
  isSupabaseConfigured,
  username
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [search, setSearch] = useState("");
  
  // Upload Knowledge Form States
  const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [uploadingFile, setUploadingFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [modalError, setModalError] = useState("");

  const filtered = useMemo(() =>
    allModels.filter(m =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      (m.owned_by || "").toLowerCase().includes(search.toLowerCase())
    ), [allModels, search]);

  useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectForUpload) {
      setSelectedSubjectForUpload(subjects[0]);
    } else if (subjects.length === 0) {
      setSelectedSubjectForUpload("__new__");
    }
  }, [subjects, selectedSubjectForUpload]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadingFile) return;
    const subjName = selectedSubjectForUpload === "__new__" ? newSubjectName.trim() : selectedSubjectForUpload;
    if (!subjName) {
      setModalError("Vui lòng nhập tên môn học.");
      return;
    }

    setIsUploading(true);
    setModalError("");
    try {
      const cleanSubject = sanitizeStoragePathSegment(subjName);
      if (!cleanSubject) {
        setModalError("Tên môn học không hợp lệ sau khi làm sạch ký tự đặc biệt.");
        return;
      }

      const existingFiles = filesBySubject[cleanSubject] || [];
      const existingNames = existingFiles.map(f => f.name);

      let cleanFileName = sanitizeStoragePathSegment(uploadingFile.name) || `file_${Date.now()}`;

      const dotIndex = cleanFileName.lastIndexOf(".");
      let baseName = cleanFileName;
      let ext = "";
      if (dotIndex !== -1) {
        baseName = cleanFileName.substring(0, dotIndex);
        ext = cleanFileName.substring(dotIndex);
      }

      let counter = 1;
      let finalFileName = cleanFileName;
      while (existingNames.includes(finalFileName)) {
        finalFileName = `${baseName}(${counter})${ext}`;
        counter++;
      }
      cleanFileName = finalFileName;

      // Upload to Backend API
      const formData = new FormData();
      formData.append("username", username);
      formData.append("subject", cleanSubject);
      formData.append("filename", cleanFileName);
      formData.append("file", uploadingFile);

      const uploadRes = await fetch("/api/assistant/knowledge", {
        method: "POST",
        body: formData
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(errText || "Tải lên tài liệu lên máy chủ thất bại.");
      }

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.fileUrl || "";

      // ── Parse & lưu nội dung file vào DB để AI có thể đọc ──
      const isPdf = cleanFileName.toLowerCase().endsWith(".pdf");
      const isText = /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(cleanFileName);

      let extractedText = "";
      let pageCount = 0;

      if (isPdf) {
        try {
          const result = await parsePdfText(uploadingFile);
          extractedText = result.text;
          pageCount = result.pageCount;
        } catch (pdfErr) {
          console.warn("Không thể parse PDF:", pdfErr.message);
        }
      } else if (isText && uploadingFile.size < 150 * 1024) {
        try {
          extractedText = await uploadingFile.text();
          pageCount = 1;
        } catch (textErr) {
          console.warn("Không thể đọc file text:", textErr.message);
        }
      }

      if (extractedText) {
        // Lưu nội dung đã trích xuất vào API
        try {
          await fetch("/api/knowledge-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              subject: cleanSubject,
              filename: cleanFileName,
              content_text: extractedText,
              page_count: pageCount,
              file_url: fileUrl,
            }),
          });
        } catch (saveErr) {
          console.warn("Không thể lưu nội dung tài liệu:", saveErr.message);
        }
      }

      setUploadingFile(null);
      setNewSubjectName("");
      await loadKnowledge();
      if (selectedSubjectForUpload === "__new__") {
        setSelectedSubjectForUpload(cleanSubject);
      }
    } catch (err) {
      console.error(err);
      let errorMsg = err.message || "Tải lên tài liệu thất bại.";
      setModalError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (subj, fileName) => {
    if (!confirm(`Bạn có chắc chắn muốn xoá tài liệu "${fileName}" khỏi môn học "${subj}"?`)) return;
    setModalError("");
    try {
      const cleanSubject = sanitizeStoragePathSegment(subj);
      const cleanFileName = sanitizeStoragePathSegment(fileName);

      const delRes = await fetch(
        `/api/assistant/knowledge?username=${encodeURIComponent(username)}&subject=${encodeURIComponent(cleanSubject)}&filename=${encodeURIComponent(cleanFileName)}`,
        { method: "DELETE" }
      );

      if (!delRes.ok) {
        const errText = await delRes.text();
        throw new Error(errText || "Xoá tài liệu trên máy chủ thất bại.");
      }

      // Xoá nội dung đã parse tương ứng
      try {
        await fetch(
          `/api/knowledge-content?username=${encodeURIComponent(username)}&subject=${encodeURIComponent(cleanSubject)}&filename=${encodeURIComponent(cleanFileName)}`,
          { method: "DELETE" }
        );
      } catch (delErr) {
        console.warn("Không thể xoá nội dung tài liệu:", delErr.message);
      }

      await loadKnowledge();
    } catch (err) {
      console.error(err);
      setModalError(err.message || "Xoá tài liệu thất bại.");
    }
  };

  if (!isOpen) return null;

  const totalFiles = subjects.reduce((acc, s) => acc + (filesBySubject[s]?.length || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", animation: "asstFadeIn 0.15s ease" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-surface border border-border rounded-[16px] shadow-[var(--shadow-elev)] flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-[8px] bg-bg text-text-muted">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-main">Assistant Settings & Knowledge</h2>
              <p className="text-xs text-text-muted">Configure AI prompt, models, and custom materials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[8px] hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border-subtle bg-surface-2 px-3">
          <button
            onClick={() => { setActiveTab("general"); setModalError(""); }}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5",
              activeTab === "general" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            Cấu hình chung
          </button>
          <button
            onClick={() => { setActiveTab("knowledge"); setModalError(""); }}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5",
              activeTab === "knowledge" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            Kiến thức bổ trợ ({totalFiles})
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 p-5 custom-scrollbar">
          {modalError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-danger text-xs mb-4">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">error</span>
              <p className="flex-1">{modalError}</p>
            </div>
          )}

          {activeTab === "general" ? (
            <div className="space-y-5">
              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    System Prompt
                  </label>
                  <div className="flex items-center gap-2">
                    {systemPrompt.trim() ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20">
                          <span className="material-symbols-outlined text-[11px]">edit</span>
                          Tuỳ chỉnh
                        </span>
                        <button
                          onClick={() => onSystemPrompt("")}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-text-subtle hover:text-danger border border-border hover:border-danger/40 transition-all"
                          title="Đặt lại về mặc định"
                        >
                          <span className="material-symbols-outlined text-[11px]">restart_alt</span>
                          Reset
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-text-subtle border border-border">
                        <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                        Mặc định
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={systemPrompt}
                    onChange={e => onSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder={DEFAULT_SYSTEM_PROMPT}
                    className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-[10px] placeholder:text-text-subtle resize-y outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all font-sans leading-relaxed"
                    style={{ color: systemPrompt.trim() ? "var(--color-text-main)" : undefined }}
                  />
                </div>
                <p className="text-[11px] text-text-subtle mt-1.5">
                  {systemPrompt.trim()
                    ? "Prompt tuỳ chỉnh đang được sử dụng."
                    : "Đang dùng prompt mặc định (trợ lí học tập tiếng Việt). Nhập để ghi đè."}
                </p>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Temperature
                  </label>
                  <Badge size="sm" variant="default">{temperature.toFixed(1)}</Badge>
                </div>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={temperature}
                  onChange={e => onTemperature(parseFloat(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-text-subtle">Precise (0)</span>
                  <span className="text-[11px] text-text-subtle">Creative (2)</span>
                </div>
              </div>

              {/* Model Management */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Available Models
                  </label>
                  <span className="text-xs text-text-subtle">{enabledModelIds.size}/{allModels.length} enabled</span>
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search models…"
                  className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-[10px] text-text-main placeholder:text-text-subtle outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all mb-3"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {filtered.map(m => {
                    const enabled = enabledModelIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => onToggleModel(m.id)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left transition-all",
                          "border",
                          enabled
                            ? "bg-brand-50 dark:bg-brand-900/20 border-brand-500/30 text-text-main"
                            : "bg-bg border-border text-text-muted hover:bg-surface-2 hover:text-text-main"
                        )}
                      >
                        <div className={cn(
                          "size-4 rounded-[4px] flex-shrink-0 flex items-center justify-center border transition-all",
                          enabled
                            ? "bg-brand-500 border-brand-500"
                            : "border-border bg-surface"
                        )}>
                          {enabled && <span className="material-symbols-outlined text-[10px] text-white">check</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{m.id.split("/").pop()}</p>
                          <p className="text-[11px] text-text-subtle truncate">{m.owned_by || m.id.split("/")[0]}</p>
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="col-span-2 py-6 text-center text-sm text-text-subtle">No models found</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upload Section */}
              <form onSubmit={handleUpload} className="p-4 border border-border bg-surface-2 rounded-[12px] space-y-3">
                <p className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-brand-500">upload_file</span>
                  Thêm tài liệu kiến thức mới
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Subject */}
                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Môn học</label>
                    <select
                      value={selectedSubjectForUpload}
                      onChange={e => {
                        setSelectedSubjectForUpload(e.target.value);
                        setModalError("");
                      }}
                      className="w-full h-9 px-2 text-xs bg-bg border border-border rounded-[8px] outline-none text-text-main focus:border-brand-500/50"
                    >
                      {subjects.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__new__">+ Thêm môn học mới...</option>
                    </select>
                  </div>

                  {/* New Subject Input */}
                  {selectedSubjectForUpload === "__new__" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Tên môn học mới</label>
                      <input
                        type="text"
                        value={newSubjectName}
                        onChange={e => {
                          setNewSubjectName(e.target.value);
                          setModalError("");
                        }}
                        placeholder="Ví dụ: Toán học, Lịch sử..."
                        className="w-full h-9 px-3 text-xs bg-bg border border-border rounded-[8px] outline-none text-text-main focus:border-brand-500/50"
                      />
                    </div>
                  )}
                </div>

                {/* File Drop Area */}
                <div className="flex gap-2.5">
                  <div className="flex-1">
                    <label className="flex flex-col items-center justify-center border border-dashed border-border hover:border-brand-500/50 rounded-[10px] py-4 bg-bg cursor-pointer transition-colors text-xs text-text-muted">
                      <span className="material-symbols-outlined text-[20px] text-brand-500 mb-1">cloud_upload</span>
                      <span className="font-medium text-text-main truncate max-w-[240px] px-2">
                        {uploadingFile ? uploadingFile.name : "Chọn tài liệu học tập..."}
                      </span>
                      {!uploadingFile && <span className="text-[10px] text-text-subtle mt-0.5">Ảnh, PDF, text, code (&lt;150KB)...</span>}
                      <input
                        type="file"
                        onChange={e => {
                          setUploadingFile(e.target.files?.[0] || null);
                          setModalError("");
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isUploading || !uploadingFile || (!selectedSubjectForUpload && !newSubjectName.trim())}
                    className="h-auto flex items-center justify-center px-4 rounded-[10px]"
                  >
                    {isUploading ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">upload</span>
                    )}
                  </Button>
                </div>
              </form>

              {/* Subjects & Files List */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Danh sách môn học ({subjects.length})
                </label>

                {loadingKnowledge ? (
                  <div className="py-8 text-center text-xs text-text-subtle flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Đang tải danh sách kiến thức...
                  </div>
                ) : subjects.length === 0 ? (
                  <div className="py-12 border border-dashed border-border rounded-[12px] bg-surface text-center">
                    <span className="material-symbols-outlined text-[28px] text-text-subtle block mb-1">folder_open</span>
                    <p className="text-xs text-text-subtle">Chưa có môn học hay tài liệu kiến thức nào.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {subjects.map(subj => {
                      const files = filesBySubject[subj] || [];
                      return (
                        <div key={subj} className="border border-border rounded-[10px] overflow-hidden bg-bg">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-brand-500 flex-shrink-0">menu_book</span>
                              <span className="text-xs font-semibold text-text-main truncate" title={subj}>{subj}</span>
                              <span className="text-[10px] text-text-subtle font-mono flex-shrink-0">({files.length} tài liệu)</span>
                            </div>
                          </div>
                          <div className="p-1.5 space-y-1 bg-surface">
                            {files.length === 0 ? (
                              <p className="text-[11px] text-text-subtle p-2">Không có tài liệu nào</p>
                            ) : (
                              files.map(file => (
                                <div key={file.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-[6px] hover:bg-surface-2 transition-colors text-xs">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="material-symbols-outlined text-[15px] text-text-muted flex-shrink-0">
                                      {file.name.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? "image" : "description"}
                                    </span>
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="truncate text-text-main hover:text-brand-500 transition-colors hover:underline"
                                      title={file.name}
                                    >
                                      {file.name}
                                    </a>
                                    <span className="text-[10px] text-text-subtle font-mono flex-shrink-0">({formatBytes(file.metadata?.size || file.size || 0)})</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(subj, file.name)}
                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-text-subtle hover:text-danger transition-all ml-2 flex-shrink-0"
                                    title="Xoá tài liệu"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle flex justify-end bg-surface">
          <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssistantPageClient() {
  const [hydrated, setHydrated] = useState(false);
  const [username, setUsername] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("assistant.activeUsername") || "admin";
    }
    return "admin";
  });
  const [usernameLoaded, setUsernameLoaded] = useState(false);
  const [allModels, setAllModels] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [fullModelsLoaded, setFullModelsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [enabledModelIds, setEnabledModelIds] = useState(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeModelId, setActiveModelId] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingId, setStreamingId] = useState("");

  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const modelDropRef = useRef(null);

  // ── Knowledge Base States ──
  const [subjects, setSubjects] = useState([]);
  const [filesBySubject, setFilesBySubject] = useState({});
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [activeSubjectDraft, setActiveSubjectDraft] = useState("");
  const [subjectDropOpen, setSubjectDropOpen] = useState(false);
  const subjectDropRef = useRef(null);

  const isSupabaseConfigured = useMemo(() => {
    return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  }, []);

  const loadKnowledge = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingKnowledge(true);
    try {
      const res = await fetch(`/api/assistant/knowledge?username=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSubjects(data.subjects || []);
      setFilesBySubject(data.filesBySubject || {});
    } catch (err) {
      console.error("Failed to load knowledge:", err);
    } finally {
      setLoadingKnowledge(false);
    }
  }, [isSupabaseConfigured, username]);

  // Load knowledge once hydrated and supabase configured
  useEffect(() => {
    if (hydrated && isSupabaseConfigured) {
      loadKnowledge();
    }
  }, [hydrated, isSupabaseConfigured, loadKnowledge]);

  // ── Inject CSS ──
  useEffect(() => {
    if (typeof document === "undefined") return;
    let s = document.getElementById("asst-styles");
    if (!s) {
      s = document.createElement("style");
      s.id = "asst-styles";
      document.head.appendChild(s);
    }
    s.textContent = `
      @keyframes asstSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      @keyframes asstFadeIn  { from { opacity:0; } to { opacity:1; } }
      @keyframes asstBlink   { 0%,100% { opacity:1; } 50% { opacity:0; } }
      @keyframes asstDot     { 0%,80%,100% { transform:scale(.6); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
      
      .asst-md p { margin: 0.5em 0 !important; line-height: 1.6 !important; }
      .asst-md h1 { font-size: 1.4em !important; font-weight: 700 !important; margin: 0.8em 0 0.4em !important; display: block !important; }
      .asst-md h2 { font-size: 1.25em !important; font-weight: 700 !important; margin: 0.7em 0 0.3em !important; display: block !important; }
      .asst-md h3 { font-size: 1.1em !important; font-weight: 600 !important; margin: 0.6em 0 0.3em !important; display: block !important; }
      .asst-md ul { list-style-type: disc !important; list-style-position: outside !important; padding-left: 1.5em !important; margin: 0.5em 0 !important; display: block !important; }
      .asst-md ol { list-style-type: decimal !important; list-style-position: outside !important; padding-left: 1.5em !important; margin: 0.5em 0 !important; display: block !important; }
      .asst-md li { display: list-item !important; margin: 0.2em 0 !important; }
      .asst-md blockquote { border-left: 3px solid var(--color-brand-500) !important; padding-left: 0.8em !important; color: var(--color-text-muted) !important; font-style: italic !important; margin: 0.5em 0 !important; display: block !important; }
      .asst-md hr { border: none !important; border-top: 1px solid var(--color-border) !important; margin: 1em 0 !important; display: block !important; }
      .asst-md code { font-family: ui-monospace, monospace !important; background: var(--color-bg-alt) !important; padding: 2px 5px !important; border-radius: 4px !important; font-size: 0.875em !important; color: var(--color-primary) !important; display: inline-block !important; }
      .asst-md table { border-collapse: collapse !important; width: 100% !important; margin: 0.8em 0 !important; font-size: 0.9em !important; display: table !important; }
      .asst-md th, .asst-md td { border: 1px solid var(--color-border) !important; padding: 6px 10px !important; text-align: left !important; }
      .asst-md th { background: var(--color-bg-alt) !important; font-weight: 600 !important; }
      .asst-md a { color: var(--color-brand-500) !important; text-decoration: underline !important; }

      .asst-md-user p { margin: 0.4em 0 !important; line-height: 1.5 !important; }
      .asst-md-user ul { list-style-type: disc !important; list-style-position: outside !important; padding-left: 1.4em !important; margin: 0.4em 0 !important; display: block !important; }
      .asst-md-user ol { list-style-type: decimal !important; list-style-position: outside !important; padding-left: 1.4em !important; margin: 0.4em 0 !important; display: block !important; }
      .asst-md-user li { display: list-item !important; margin: 0.15em 0 !important; }
      .asst-md-user code { font-family: ui-monospace, monospace !important; background: rgba(255, 255, 255, 0.2) !important; padding: 1px 4px !important; border-radius: 4px !important; font-size: 0.875em !important; color: #fff !important; display: inline-block !important; }
      .asst-md-user a { color: #fff !important; text-decoration: underline !important; font-weight: 500 !important; }
      .asst-md-user blockquote { border-left: 3px solid rgba(255, 255, 255, 0.5) !important; padding-left: 0.8em !important; color: rgba(255, 255, 255, 0.8) !important; font-style: italic !important; margin: 0.5em 0 !important; display: block !important; }
    `;
  }, []);

  // ── Hydration ──
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);

      const rawSessions = localStorage.getItem(uSK.sessions) ?? localStorage.getItem("assistant.sessions");
      const s = safeParse(rawSessions, []);
      setSessions(Array.isArray(s) ? s : []);

      const rawActiveSession = localStorage.getItem(uSK.activeSession) ?? localStorage.getItem("assistant.activeSession");
      setActiveSessionId(rawActiveSession || "");

      const rawSystemPrompt = localStorage.getItem(uSK.systemPrompt) ?? localStorage.getItem("assistant.systemPrompt");
      const storedPrompt = rawSystemPrompt || "";
      setSystemPrompt(storedPrompt === DEFAULT_SYSTEM_PROMPT ? "" : storedPrompt);

      const rawTemperature = localStorage.getItem(uSK.temperature) ?? localStorage.getItem("assistant.temperature");
      setTemperature(parseFloat(rawTemperature) || DEFAULT_TEMPERATURE);

    } catch {}
  }, [hydrated, usernameLoaded, username]);

  // ── Persist ──
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);
      localStorage.setItem(uSK.sessions, JSON.stringify(sessions));
      localStorage.setItem(uSK.activeSession, activeSessionId);
      localStorage.setItem(uSK.activeModel, activeModelId);
      localStorage.setItem(uSK.systemPrompt, systemPrompt);
      localStorage.setItem(uSK.temperature, String(temperature));
      if (fullModelsLoaded) {
        localStorage.setItem(uSK.enabledModels, JSON.stringify([...enabledModelIds]));
      }
    } catch {}
  }, [hydrated, usernameLoaded, username, sessions, activeSessionId, activeModelId, systemPrompt, temperature, enabledModelIds, fullModelsLoaded]);

  const { fetchUser } = useUserStore();

  const applyFullModelList = useCallback((models, uName) => {
    if (!Array.isArray(models) || models.length === 0 || typeof window === "undefined") return;

    const getModelProvider = (m) => m.owned_by || m.id.split("/")[0];
    const uSK = getSK(uName);
    const rawEnabledModels = localStorage.getItem(uSK.enabledModels) ?? localStorage.getItem("assistant.enabledModels");
    const rawKnownModels = localStorage.getItem(uSK.knownModels);

    let enabledList = safeParse(rawEnabledModels, null);
    let knownList = safeParse(rawKnownModels, null);

    if (enabledList === null && knownList === null) {
      enabledList = models.map(m => m.id);
      knownList = models.map(m => m.id);
    } else if (knownList !== null) {
      const knownSet = new Set(knownList);
      const newModels = models.filter(m => !knownSet.has(m.id));
      if (newModels.length > 0) {
        const enabledSet = new Set(enabledList || []);
        newModels.forEach(m => {
          enabledSet.add(m.id);
          knownList.push(m.id);
        });
        enabledList = [...enabledSet];
      }
      const finalKnownSet = new Set(knownList);
      models.forEach(m => finalKnownSet.add(m.id));
      knownList = [...finalKnownSet];
    } else {
      const enabledSet = new Set(enabledList || []);
      const enabledProviders = new Set(
        models.filter(m => enabledSet.has(m.id)).map(getModelProvider)
      );
      models.forEach(m => {
        const prov = getModelProvider(m);
        if (!enabledProviders.has(prov)) enabledSet.add(m.id);
      });
      enabledList = [...enabledSet];
      knownList = models.map(m => m.id);
    }

    localStorage.setItem(uSK.enabledModels, JSON.stringify(enabledList));
    localStorage.setItem(uSK.knownModels, JSON.stringify(knownList));
    setAllModels(models);
    setEnabledModelIds(new Set(enabledList));
    setActiveModelId(prev => (prev && models.some(m => m.id === prev)) ? prev : (models[0]?.id || prev));
  }, []);

  const loadFullModels = useCallback(async () => {
    if (fullModelsLoaded) return;
    setLoadingModels(true);
    setLoadError("");
    try {
      const res = await fetch("/api/v1/models", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const models = Array.isArray(data?.data) ? data.data : [];
      applyFullModelList(models, username);
      setFullModelsLoaded(true);
    } catch (err) {
      setLoadError(textValue(err?.message) || "Failed to load models.");
    } finally {
      setLoadingModels(false);
    }
  }, [applyFullModelList, fullModelsLoaded, username]);

  const handleModelDropdownToggle = useCallback(async () => {
    if (!modelDropOpen) await loadFullModels();
    setModelDropOpen(v => !v);
  }, [loadFullModels, modelDropOpen]);

  const handleOpenSettings = useCallback(async () => {
    await loadFullModels();
    setSettingsOpen(true);
  }, [loadFullModels]);

  // ── Load models & API key ──
  useEffect(() => {
    async function load() {
      setLoadingModels(true);
      setLoadError("");
      try {
        const [modelsRes, keysRes, authData] = await Promise.all([
          fetch("/api/v1/models/default", { cache: "no-store" }),
          fetch("/api/keys", { cache: "no-store" }),
          fetchUser(),
        ]);
        const modelsData = await modelsRes.json().catch(() => ({}));
        const keysData = await keysRes.json().catch(() => ({}));
        const defaultModel = modelsData?.model || null;
        const models = defaultModel?.id ? [defaultModel] : [];
        const key = Array.isArray(keysData?.keys)
          ? (keysData.keys.find(k => k.isActive !== false)?.key || "")
          : "";
        const uName = authData?.username || "admin";
        setUsername(uName);
        if (typeof window !== "undefined") {
          localStorage.setItem("assistant.activeUsername", uName);
        }
        setAllModels(models);
        setApiKey(key);

        setEnabledModelIds(new Set(models.map(m => m.id)));
        if (models.length > 0) setActiveModelId(models[0].id);
      } catch (err) {
        setLoadError(textValue(err?.message) || "Failed to load models.");
      } finally {
        setLoadingModels(false);
        setUsernameLoaded(true);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Click outside dropdowns ──
  useEffect(() => {
    const fn = (e) => {
      if (modelDropRef.current && !modelDropRef.current.contains(e.target)) setModelDropOpen(false);
      if (subjectDropRef.current && !subjectDropRef.current.contains(e.target)) setSubjectDropOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, streamingId]);

  // ── Derived ──
  const enabledModels = useMemo(
    () => allModels.filter(m => enabledModelIds.has(m.id)),
    [allModels, enabledModelIds]
  );

  const currentSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [sessions]
  );

  const activeModel = useMemo(
    () => enabledModels.find(m => m.id === activeModelId) || enabledModels[0] || null,
    [enabledModels, activeModelId]
  );

  const activeSubject = useMemo(() => {
    if (currentSession) return currentSession.activeSubject || "";
    return activeSubjectDraft;
  }, [currentSession, activeSubjectDraft]);

  const handleSelectSubject = useCallback((subj) => {
    if (currentSession) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? {
        ...s,
        activeSubject: subj,
        updatedAt: new Date().toISOString()
      } : s));
    } else {
      setActiveSubjectDraft(subj);
    }
  }, [currentSession, activeSessionId]);

  const canSend = !isSending && !!activeModel &&
    (draft.trim().length > 0 || attachedFiles.some(f => f.status === "success")) &&
    !attachedFiles.some(f => f.status === "uploading");
  const messages = currentSession?.messages || [];

  // ── Session helpers ──
  const createSession = useCallback((model) => ({
    id: createId(), title: "New Chat",
    modelId: model?.id || "",
    activeSubject: activeSubjectDraft || "",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [activeSubjectDraft]);

  const handleNewChat = useCallback(() => {
    if (!activeModel) return;
    const s = createSession(activeModel);
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
    setDraft("");
  }, [activeModel, createSession]);

  const handleDeleteSession = useCallback((id, e) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeSessionId === id) setActiveSessionId(next[0]?.id || "");
      return next;
    });
  }, [activeSessionId]);

  const handleToggleModel = useCallback((modelId) => {
    setEnabledModelIds(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        if (next.size <= 1) return prev;
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }, []);

  // ── File upload helpers ──
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = useCallback(async (item) => {
    if (!isSupabaseConfigured) {
      setAttachedFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        status: "error",
        errorMsg: "Chưa cấu hình Supabase URL/Key"
      } : f));
      return;
    }

    try {
      const fileExt = item.name.split(".").pop();
      const fileName = `${createId()}.${fileExt}`;
      const filePath = `uploads/${username}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("ai_assistant")
        .upload(filePath, item.file, {
          cacheControl: "3600",
          upsert: false
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("ai_assistant")
        .getPublicUrl(filePath);

      setAttachedFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        status: "success",
        url: urlData.publicUrl
      } : f));
    } catch (err) {
      console.error("Upload error:", err);
      let errorMsg = err.message || "Tải lên thất bại";
      if (errorMsg.toLowerCase().includes("row-level security") || errorMsg.toLowerCase().includes("permission denied") || errorMsg.toLowerCase().includes("policy")) {
        errorMsg = "Lỗi RLS Policy (Vui lòng thiết lập INSERT cho bucket)";
      }
      setAttachedFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        status: "error",
        errorMsg
      } : f));
    }
  }, [isSupabaseConfigured, username]);

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = files.map(file => ({
      id: createId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading",
      url: "",
      errorMsg: ""
    }));

    setAttachedFiles(prev => [...prev, ...newFiles]);

    for (const item of newFiles) {
      uploadFile(item);
    }

    if (e.target) e.target.value = "";
  }, [uploadFile]);

  const removeAttachedFile = useCallback((id) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const model = activeModel;
    const activeAttached = attachedFiles.filter(f => f.status === "success");
    if (!model || (!draft.trim() && activeAttached.length === 0)) return;

    let sessionId = activeSessionId;
    let session = sessions.find(s => s.id === sessionId);
    if (!session) {
      session = createSession(model);
      sessionId = session.id;
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(sessionId);
    }

    const userMsg = {
      id: createId(),
      role: "user",
      content: draft.trim(),
      files: activeAttached.map(f => ({ name: f.name, url: f.url, type: f.type, size: f.size })),
      createdAt: new Date().toISOString()
    };
    const asstId = createId();
    const asstMsg = { id: asstId, role: "assistant", content: "", status: "streaming", createdAt: new Date().toISOString() };
    const prevMsgs = session.messages || [];
    const nextMsgs = [...prevMsgs, userMsg, asstMsg];

    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s, messages: nextMsgs,
      title: s.title === "New Chat" ? makeTitle(draft || activeAttached[0]?.name || "Attached File") : s.title,
      modelId: model.id, updatedAt: new Date().toISOString(),
    } : s));
    
    // Clear inputs immediately
    setDraft("");
    setAttachedFiles([]);
    
    setIsSending(true);
    setStreamingId(asstId);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const reqMsgs = [];
    const knowledgeTextList = [];
    const allFiles = [];
    for (const [subj, files] of Object.entries(filesBySubject || {})) {
      if (Array.isArray(files)) {
        for (const f of files) {
          allFiles.push({ ...f, subject: subj });
        }
      }
    }

    if (allFiles.length > 0) {
      // ưu tiên 1: lấy từ DB nếu đã parse sẵn
      let dbContentMap = {};
      try {
        const dbRes = await fetch(`/api/knowledge-content?username=${encodeURIComponent(username)}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          for (const row of (dbData.data || [])) {
            const key = `${row.subject}::${row.filename}`;
            dbContentMap[key] = row.content_text;
          }
        }
      } catch (e) {
        // DB chưa tồn tại hoặc chưa có dữ liệu – sẽ parse trực tiếp
      }

      await Promise.all(
        allFiles.map(async (f) => {
          const isPdf = /\.pdf$/i.test(f.name);
          const isText = /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(f.name);
          const dbKey = `${f.subject}::${f.name}`;

          if (dbContentMap[dbKey]) {
            // ưu tiên 1: dung nội dung từ DB (có số dòng + số trang)
            knowledgeTextList.push({ name: f.name, content: dbContentMap[dbKey], subject: f.subject });
          } else if (f.url && isPdf) {
            // ưu tiên 2: fetch PDF từ URL và parse ngay tại client
            try {
              const pdfRes = await fetch(f.url);
              if (pdfRes.ok) {
                const arrayBuf = await pdfRes.arrayBuffer();
                // Tạo File object giả lập từ ArrayBuffer
                const pdfBlob = new Blob([arrayBuf], { type: "application/pdf" });
                const pdfFile = new File([pdfBlob], f.name, { type: "application/pdf" });
                const result = await parsePdfText(pdfFile);
                if (result.text) {
                  knowledgeTextList.push({ name: f.name, content: result.text, subject: f.subject });
                  // Lưu vào DB cho lần sau (bất đồng bộ, không block)
                  fetch("/api/knowledge-content", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username,
                      subject: f.subject,
                      filename: f.name,
                      content_text: result.text,
                      page_count: result.pageCount,
                      file_url: f.url,
                    }),
                  }).catch(() => {}); // bỏ qua lỗi nếu bảng chưa tồn tại
                }
              }
            } catch (e) {
              console.error("Error parsing PDF:", f.name, e);
              // Fallback: chỉ gửi URL
              knowledgeTextList.push({ name: f.name, url: f.url, subject: f.subject });
            }
          } else if (f.url && isText && (!f.metadata || f.metadata.size < 150 * 1024)) {
            // ưu tiên 3: text file – fetch trực tiếp
            try {
              const res = await fetch(f.url);
              if (res.ok) {
                const content = await res.text();
                if (content) {
                  knowledgeTextList.push({ name: f.name, content, subject: f.subject });
                }
              }
            } catch (e) {
              console.error("Error fetching knowledge file:", f.name, e);
            }
          } else if (f.url) {
            // Fallback: chỉ có URL (image, etc.)
            knowledgeTextList.push({ name: f.name, url: f.url, subject: f.subject });
          }
        })
      );
    }

    // Empty = use default prompt; custom = use as-is
    let effectivePrompt = systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
    if (knowledgeTextList.length > 0) {
      effectivePrompt += `\n\n--- HỘP KIẾN THỨC BỔ TRỢ (TOÀN BỘ MÔN HỌC) ---`;
      effectivePrompt += `\nBạn được cung cấp các tài liệu học tập sau đây từ các môn học/chủ đề khác nhau. Hãy dựa vào câu hỏi và ngữ cảnh trò chuyện để tự xác định môn học/chủ đề tương ứng, và sử dụng thông tin từ tài liệu phù hợp nhất để trả lời người dùng một cách chính xác nhất:`;
      for (const k of knowledgeTextList) {
        if (k.content) {
          effectivePrompt += `\n\n[Môn học: ${k.subject} | Tên tài liệu: ${k.name}]\n\`\`\`\n${k.content}\n\`\`\``;
        } else if (k.url) {
          effectivePrompt += `\n- [Môn học: ${k.subject} | Tài liệu: ${k.name}](${k.url})`;
        }
      }
      effectivePrompt += `\n--------------------------------------------`;
      effectivePrompt += `\n\n============================================`;
      effectivePrompt += `\nQUY ĐỊNH BẮT BUỘC VỀ TÍNH CÔ LẬP KIẾN THỨC (STRICT KNOWLEDGE ISOLATION):`;
      effectivePrompt += `\n1. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên thông tin CÓ TRONG các tài liệu đã được cung cấp ở phần Hộp Kiến Thức Bổ Trợ ở trên.`;
      effectivePrompt += `\n2. TUYỆT ĐỐI KHÔNG tự bổ sung, suy diễn hoặc kết hợp với bất kỳ kiến thức ngoài nguồn nào (ngoại trừ các kiến thức cơ bản về ngôn ngữ, công thức toán lý hóa căn bản dùng để tính toán/diễn đạt).`;
      effectivePrompt += `\n3. Nếu tài liệu không chứa đủ dữ kiện để trả lời câu hỏi của người dùng, hoặc câu hỏi nằm ngoài phạm vi tài liệu, bạn BẮT BUỘC phải trả lời rõ ràng: "Tài liệu học tập được cung cấp không chứa thông tin này." thay vì tự suy đoán hoặc bịa ra câu trả lời (hallucinate).`;
      effectivePrompt += `\n4. Mọi câu trả lời của bạn phải hoàn toàn chính xác và trung thực so với nội dung tài liệu. Không tạo ra bất kỳ thông tin ảo nào.`;
      effectivePrompt += `\n`;
      effectivePrompt += `\nQUY ĐỊNH BẮT BUỘC VỀ VIỆN DẪN TÀI LIỆU (SOURCES CITATION):`;
      effectivePrompt += `\n1. Khi trả lời các câu hỏi (kể cả khi trả lời 1 câu hay nhiều câu cùng một lúc), dưới mỗi câu hỏi hoặc dưới mỗi phần giải thích tương ứng, nếu bạn sử dụng thông tin từ các tài liệu trong Hộp Kiến Thức Bổ Trợ để trả lời/giải thích, bạn BẮT BUỘC phải chèn thêm cụm từ trích dẫn nguồn theo đúng định dạng sau vào ngay dưới cùng của câu hỏi/phần giải thích đó:`;
      effectivePrompt += `\n   Tham khảo: [dòng_số] + [trang_số] + [tên_tài_liệu] + [tên_môn_học]`;
      effectivePrompt += `\n   (Ví dụ cụ thể: "Tham khảo: dòng 15-20 + trang 8 + phuong-phap-trai-phang.pdf + Toán học")`;
      effectivePrompt += `\n   Lưu ý: Không dùng dấu ngoặc vuông vuông [] trong câu trả lời thực tế, hãy điền trực tiếp thông tin (ví dụ: dòng 15-20 + trang 8 + ten_file.pdf + Kinh tế vĩ mô). Bạn bắt buộc phải chỉ ra cụ thể số dòng và số trang chính xác nhất dựa trên tài liệu.`;
      effectivePrompt += `\n2. Nếu câu hỏi hoàn toàn không sử dụng kiến thức nào trong Hộp Kiến Thức Bổ Trợ, bạn TUYỆT ĐỐI KHÔNG ghi cụm từ trích dẫn trên.`;
      effectivePrompt += `\n3. Để hỗ trợ hiển thị các nguồn bổ trợ đẹp mắt dưới dạng nhãn ở chân trang, ở dòng cuối cùng của toàn bộ câu trả lời, hãy thêm một dòng Sources tổng quát định dạng: "Sources: ten_file_1 (vị_trí_trích_dẫn), ten_file_2 (vị_trí_trích_dẫn)" (nếu có sử dụng tài liệu để trả lời).`;
      effectivePrompt += `\n============================================`;
    }

    reqMsgs.push({ role: "system", content: effectivePrompt });
    
    // 1. Format previous messages for request
    for (const m of prevMsgs) {
      if (m.role === "user" || (m.role === "assistant" && m.content)) {
        if (m.role === "user" && m.files && m.files.length > 0) {
          const imageFiles = m.files.filter(f => f.type?.startsWith("image/"));
          const nonImageFiles = m.files.filter(f => !f.type?.startsWith("image/"));

          let finalContent = m.content || "";
          if (nonImageFiles.length > 0) {
            finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
            for (const df of nonImageFiles) {
              finalContent += `\n- [${df.name}](${df.url})`;
            }
            finalContent += "\n------------------------";
          }

          if (imageFiles.length > 0) {
            const parts = [{ type: "text", text: finalContent }];
            for (const img of imageFiles) {
              parts.push({ type: "image_url", image_url: { url: img.url } });
            }
            reqMsgs.push({ role: m.role, content: parts });
          } else {
            reqMsgs.push({ role: m.role, content: finalContent });
          }
        } else {
          reqMsgs.push({ role: m.role, content: m.content });
        }
      }
    }

    // 2. Format current message with vision payload or inline text files
    const imageFiles = activeAttached.filter(f => f.type?.startsWith("image/"));
    const textFiles = [];
    const docFiles = [];

    for (const f of activeAttached) {
      if (f.type?.startsWith("image/")) continue;
      const isText = f.type?.startsWith("text/") || 
                     /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(f.name);
      if (f.file && isText && f.size < 150 * 1024) {
        try {
          const content = await readTextFile(f.file);
          if (content) {
            textFiles.push({ name: f.name, content });
            continue;
          }
        } catch (e) {
          console.error("Error reading text file", e);
        }
      }
      docFiles.push(f);
    }

    let currentMsgText = draft.trim();
    if (textFiles.length > 0) {
      currentMsgText += "\n\n--- HỘP THÔNG TIN FILE ĐÍNH KÈM ---";
      for (const tf of textFiles) {
        currentMsgText += `\n\n[File: ${tf.name}]\n\`\`\`\n${tf.content}\n\`\`\``;
      }
      currentMsgText += "\n-----------------------------------";
    }

    if (docFiles.length > 0) {
      currentMsgText += "\n\n--- LINK TÀI LIỆU ĐÍNH KÈM ---";
      for (const df of docFiles) {
        currentMsgText += `\n- [${df.name}](${df.url})`;
      }
      currentMsgText += "\n------------------------------";
    }

    let currentMsgContent;
    if (imageFiles.length > 0) {
      let msgText = currentMsgText;
      if (imageFiles.length > 1) {
        const multiImageInstruction = `[HƯớNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghep lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
        msgText = multiImageInstruction + msgText;
      }
      currentMsgContent = [{ type: "text", text: msgText }];
      for (const img of imageFiles) {
        currentMsgContent.push({ type: "image_url", image_url: { url: img.url } });
      }
    } else {
      currentMsgContent = currentMsgText;
    }

    if (knowledgeTextList.length > 0) {
      const citationReminder = `\n\n[LƯU Ý HỆ THỐNG: Khi trả lời các câu hỏi (kể cả 1 câu hay nhiều câu cùng lúc), dưới mỗi câu hoặc phần giải thích, bạn BẮT BUỘC phải thêm cụm "Tham khảo: dòng số + trang số + tên tài liệu + tên môn học" vào dưới cùng của câu/phần giải thích đó (nếu dùng kiến thức đã tải lên để trả lời). Đồng thời, hãy kết thúc toàn bộ câu trả lời bằng dòng nguồn "Sources: tên_file (chi_tiết)" ở dòng cuối cùng.]`;
      if (typeof currentMsgContent === "string") {
        currentMsgContent += citationReminder;
      } else if (Array.isArray(currentMsgContent)) {
        const textPart = currentMsgContent.find(p => p.type === "text");
        if (textPart) {
          textPart.text += citationReminder;
        }
      }
    }

    reqMsgs.push({ role: "user", content: currentMsgContent });

    const headers = { "Content-Type": "application/json", "Accept": "text/event-stream" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const t0 = Date.now();
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({ model: model.id, messages: reqMsgs, stream: true, temperature }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(textValue(errData?.error?.message || errData?.error || errData?.message || `HTTP ${res.status}`));
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No streaming body");

      const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || "";
            if (delta) {
              full += delta;
              setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                messages: s.messages.map(m => m.id === asstId ? { ...m, content: full, status: "streaming" } : m),
                updatedAt: new Date().toISOString(),
              } : s));
            }
          } catch {}
        }
      }

      const latencyMs = Date.now() - t0;
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === asstId ? { ...m, content: full || m.content, status: "done", latencyMs } : m),
        updatedAt: new Date().toISOString(),
      } : s));
    } catch (err) {
      if (err.name !== "AbortError") {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === asstId ? { ...m, content: m.content || `Error: ${textValue(err)}`, status: "error" } : m),
          updatedAt: new Date().toISOString(),
        } : s));
      }
    } finally {
      setIsSending(false);
      setStreamingId("");
      abortRef.current = null;
    }
  }, [activeModel, draft, activeSessionId, sessions, createSession, systemPrompt, temperature, apiKey, attachedFiles, isSupabaseConfigured, activeSubjectDraft, filesBySubject]);

  const resendMessage = useCallback(async (userMsgId, editedContent) => {
    const model = activeModel;
    if (!model) return;

    let sessionId = activeSessionId;
    let session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const prevMsgs = session.messages || [];
    const targetIdx = prevMsgs.findIndex(m => m.id === userMsgId);
    if (targetIdx === -1) return;

    const targetUserMsg = prevMsgs[targetIdx];
    
    // Update content if edited, else keep original for regeneration
    const updatedUserMsg = {
      ...targetUserMsg,
      content: editedContent !== undefined ? editedContent.trim() : targetUserMsg.content,
      createdAt: new Date().toISOString()
    };

    // Keep all messages up to the user message
    const keptMsgs = prevMsgs.slice(0, targetIdx);

    const asstId = createId();
    const asstMsg = { id: asstId, role: "assistant", content: "", status: "streaming", createdAt: new Date().toISOString() };
    
    const nextMsgs = [...keptMsgs, updatedUserMsg, asstMsg];

    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s, messages: nextMsgs,
      title: s.title === "New Chat" ? makeTitle(updatedUserMsg.content || "Attached File") : s.title,
      modelId: model.id, updatedAt: new Date().toISOString(),
    } : s));

    setIsSending(true);
    setStreamingId(asstId);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // ── Knowledge Base Preparation ──
    const knowledgeTextList = [];
    const allFiles = [];
    for (const [subj, files] of Object.entries(filesBySubject || {})) {
      if (Array.isArray(files)) {
        for (const f of files) {
          allFiles.push({ ...f, subject: subj });
        }
      }
    }

    if (allFiles.length > 0) {
      // ưu tiên lấy nội dung đã parse từ DB (có số dòng + số trang)
      let dbContentMap = {};
      try {
        const dbRes = await fetch(`/api/knowledge-content?username=${encodeURIComponent(username)}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          for (const row of (dbData.data || [])) {
            const key = `${row.subject}::${row.filename}`;
            dbContentMap[key] = row.content_text;
          }
        }
      } catch (e) {
        console.warn("Không thể lấy nội dung tài liệu từ DB:", e);
      }

      await Promise.all(
        allFiles.map(async (f) => {
          const isText = f.name.endsWith(".txt") ||
                         /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(f.name);
          const dbKey = `${f.subject}::${f.name}`;

          if (dbContentMap[dbKey]) {
            // Sử dụng nội dung đã parse (có số dòng + số trang)
            knowledgeTextList.push({ name: f.name, content: dbContentMap[dbKey], subject: f.subject });
          } else if (f.url) {
            if (isText && (!f.metadata || f.metadata.size < 150 * 1024)) {
              try {
                const res = await fetch(f.url);
                if (res.ok) {
                  const content = await res.text();
                  if (content) {
                    knowledgeTextList.push({ name: f.name, content, subject: f.subject });
                  }
                }
              } catch (e) {
                console.error("Error fetching knowledge file:", f.name, e);
              }
            } else {
              knowledgeTextList.push({ name: f.name, url: f.url, subject: f.subject });
            }
          }
        })
      );
    }

    let effectivePrompt = systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
    if (knowledgeTextList.length > 0) {
      effectivePrompt += `\n\n--- HỘP KIẾN THỨC BỔ TRỢ (TOÀN BỘ MÔN HỌC) ---`;
      effectivePrompt += `\nBạn được cung cấp các tài liệu học tập sau đây từ các môn học/chủ đề khác nhau. Hãy dựa vào câu hỏi và ngữ cảnh trò chuyện để tự xác định môn học/chủ đề tương ứng, và sử dụng thông tin từ tài liệu phù hợp nhất để trả lời người dùng một cách chính xác nhất:`;
      for (const k of knowledgeTextList) {
        if (k.content) {
          effectivePrompt += `\n\n[Môn học: ${k.subject} | Tên tài liệu: ${k.name}]\n\`\`\`\n${k.content}\n\`\`\``;
        } else if (k.url) {
          effectivePrompt += `\n- [Môn học: ${k.subject} | Tài liệu: ${k.name}](${k.url})`;
        }
      }
      effectivePrompt += `\n--------------------------------------------`;
      effectivePrompt += `\n\n============================================`;
      effectivePrompt += `\nQUY ĐỊNH BẮT BUỘC VỀ TÍNH CÔ LẬP KIẾN THỨC (STRICT KNOWLEDGE ISOLATION):`;
      effectivePrompt += `\n1. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên thông tin CÓ TRONG các tài liệu đã được cung cấp ở phần Hộp Kiến Thức Bổ Trợ ở trên.`;
      effectivePrompt += `\n2. TUYỆT ĐỐI KHÔNG tự bổ sung, suy diễn hoặc kết hợp với bất kỳ kiến thức ngoài nguồn nào (ngoại trừ các kiến thức cơ bản về ngôn ngữ, công thức toán lý hóa căn bản dùng để tính toán/diễn đạt).`;
      effectivePrompt += `\n3. Nếu tài liệu không chứa đủ dữ kiện để trả lời câu hỏi của người dùng, hoặc câu hỏi nằm ngoài phạm vi tài liệu, bạn BẮT BUỘC phải trả lời rõ ràng: "Tài liệu học tập được cung cấp không chứa thông tin này." thay vì tự suy đoán hoặc bịa ra câu trả lời (hallucinate).`;
      effectivePrompt += `\n4. Mọi câu trả lời của bạn phải hoàn toàn chính xác và trung thực so với nội dung tài liệu. Không tạo ra bất kỳ thông tin ảo nào.`;
      effectivePrompt += `\n`;
      effectivePrompt += `\nQUY ĐỊNH BẮT BUỘC VỀ VIỆN DẪN TÀI LIỆU (SOURCES CITATION):`;
      effectivePrompt += `\n1. Khi trả lời các câu hỏi (kể cả khi trả lời 1 câu hay nhiều câu cùng một lúc), dưới mỗi câu hỏi hoặc dưới mỗi phần giải thích tương ứng, nếu bạn sử dụng thông tin từ các tài liệu trong Hộp Kiến Thức Bổ Trợ để trả lời/giải thích, bạn BẮT BUỘC phải chèn thêm cụm từ trích dẫn nguồn theo đúng định dạng sau vào ngay dưới cùng của câu hỏi/phần giải thích đó:`;
      effectivePrompt += `\n   Tham khảo: [dòng_số] + [trang_số] + [tên_tài_liệu] + [tên_môn_học]`;
      effectivePrompt += `\n   (Ví dụ cụ thể: "Tham khảo: dòng 15-20 + trang 8 + phuong-phap-trai-phang.pdf + Toán học")`;
      effectivePrompt += `\n   Lưu ý: Không dùng dấu ngoặc vuông vuông [] trong câu trả lời thực tế, hãy điền trực tiếp thông tin (ví dụ: dòng 15-20 + trang 8 + ten_file.pdf + Kinh tế vĩ mô). Bạn bắt buộc phải chỉ ra cụ thể số dòng và số trang chính xác nhất dựa trên tài liệu.`;
      effectivePrompt += `\n2. Nếu câu hỏi hoàn toàn không sử dụng kiến thức nào trong Hộp Kiến Thức Bổ Trợ, bạn TUYỆT ĐỐI KHÔNG ghi cụm từ trích dẫn trên.`;
      effectivePrompt += `\n3. Để hỗ trợ hiển thị các nguồn bổ trợ đẹp mắt dưới dạng nhãn ở chân trang, ở dòng cuối cùng của toàn bộ câu trả lời, hãy thêm một dòng Sources tổng quát định dạng: "Sources: ten_file_1 (vị_trí_trích_dẫn), ten_file_2 (vị_trí_trích_dẫn)" (nếu có sử dụng tài liệu để trả lời).`;
      effectivePrompt += `\n============================================`;
    }

    const reqMsgs = [{ role: "system", content: effectivePrompt }];

    // Format historical messages up to the target user message
    for (const m of keptMsgs) {
      if (m.role === "user" || (m.role === "assistant" && m.content)) {
        if (m.role === "user" && m.files && m.files.length > 0) {
          const imageFiles = m.files.filter(f => f.type?.startsWith("image/"));
          const nonImageFiles = m.files.filter(f => !f.type?.startsWith("image/"));

          let finalContent = m.content || "";
          if (nonImageFiles.length > 0) {
            finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
            for (const df of nonImageFiles) {
              finalContent += `\n- [${df.name}](${df.url})`;
            }
            finalContent += "\n------------------------";
          }

          if (imageFiles.length > 0) {
            const parts = [{ type: "text", text: finalContent }];
            for (const img of imageFiles) {
              parts.push({ type: "image_url", image_url: { url: img.url } });
            }
            reqMsgs.push({ role: m.role, content: parts });
          } else {
            reqMsgs.push({ role: m.role, content: finalContent });
          }
        } else {
          reqMsgs.push({ role: m.role, content: m.content });
        }
      }
    }

    // Format target user message
    let finalUserContent;
    if (updatedUserMsg.files && updatedUserMsg.files.length > 0) {
      const imageFiles = updatedUserMsg.files.filter(f => f.type?.startsWith("image/"));
      const nonImageFiles = updatedUserMsg.files.filter(f => !f.type?.startsWith("image/"));

      let finalContent = updatedUserMsg.content || "";
      if (nonImageFiles.length > 0) {
        finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
        for (const df of nonImageFiles) {
          finalContent += `\n- [${df.name}](${df.url})`;
        }
        finalContent += "\n------------------------";
      }

      if (imageFiles.length > 0) {
        let msgText = finalContent;
        if (imageFiles.length > 1) {
          const multiImageInstruction = `[HƯớNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghep lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
          msgText = multiImageInstruction + msgText;
        }
        const parts = [{ type: "text", text: msgText }];
        for (const img of imageFiles) {
          parts.push({ type: "image_url", image_url: { url: img.url } });
        }
        finalUserContent = parts;
      } else {
        finalUserContent = finalContent;
      }
    } else {
      finalUserContent = updatedUserMsg.content;
    }

    if (knowledgeTextList.length > 0) {
      const citationReminder = `\n\n[LƯU Ý HỆ THỐNG: Khi trả lời các câu hỏi (kể cả 1 câu hay nhiều câu cùng lúc), dưới mỗi câu hoặc phần giải thích, bạn BẮT BUỘC phải thêm cụm "Tham khảo: dòng số + trang số + tên tài liệu + tên môn học" vào dưới cùng của câu/phần giải thích đó (nếu dùng kiến thức đã tải lên để trả lời). Đồng thời, hãy kết thúc toàn bộ câu trả lời bằng dòng nguồn "Sources: tên_file (chi_tiết)" ở dòng cuối cùng.]`;
      if (typeof finalUserContent === "string") {
        finalUserContent += citationReminder;
      } else if (Array.isArray(finalUserContent)) {
        const textPart = finalUserContent.find(p => p.type === "text");
        if (textPart) {
          textPart.text += citationReminder;
        }
      }
    }

    reqMsgs.push({ role: "user", content: finalUserContent });

    const headers = { "Content-Type": "application/json", "Accept": "text/event-stream" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const t0 = Date.now();
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({ model: model.id, messages: reqMsgs, stream: true, temperature }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(textValue(errData?.error?.message || errData?.error || errData?.message || `HTTP ${res.status}`));
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No streaming body");

      const dec = new TextDecoder();
      let buf = "", full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || "";
            if (delta) {
              full += delta;
              setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                messages: s.messages.map(m => m.id === asstId ? { ...m, content: full, status: "streaming" } : m),
                updatedAt: new Date().toISOString(),
              } : s));
            }
          } catch {}
        }
      }

      const latencyMs = Date.now() - t0;
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === asstId ? { ...m, content: full || m.content, status: "done", latencyMs } : m),
        updatedAt: new Date().toISOString(),
      } : s));
    } catch (err) {
      if (err.name !== "AbortError") {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === asstId ? { ...m, content: m.content || `Error: ${textValue(err)}`, status: "error" } : m),
          updatedAt: new Date().toISOString(),
        } : s));
      }
    } finally {
      setIsSending(false);
      setStreamingId("");
      abortRef.current = null;
    }
  }, [activeModel, activeSessionId, sessions, systemPrompt, temperature, apiKey, filesBySubject]);

  const handleEditSubmit = useCallback((userMsgId, newContent) => {
    resendMessage(userMsgId, newContent);
  }, [resendMessage]);

  const handleRegenerate = useCallback((asstMsgId) => {
    const sessionId = activeSessionId;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const prevMsgs = session.messages || [];
    const asstIdx = prevMsgs.findIndex(m => m.id === asstMsgId);
    if (asstIdx <= 0) return;
    const userMsg = prevMsgs[asstIdx - 1];
    if (userMsg && userMsg.role === "user") {
      resendMessage(userMsg.id);
    }
  }, [activeSessionId, sessions, resendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) sendMessage(); }
  }, [canSend, sendMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [draft]);

  // ── Render ──
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        allModels={allModels}
        enabledModelIds={enabledModelIds}
        onToggleModel={handleToggleModel}
        systemPrompt={systemPrompt}
        onSystemPrompt={setSystemPrompt}
        temperature={temperature}
        onTemperature={setTemperature}
        subjects={subjects}
        filesBySubject={filesBySubject}
        loadingKnowledge={loadingKnowledge}
        loadKnowledge={loadKnowledge}
        isSupabaseConfigured={isSupabaseConfigured}
        username={username}
      />

      {/* ── Sessions Sidebar ── */}
      <div className="hidden lg:flex flex-col w-60 xl:w-64 border-r border-border-subtle bg-vibrancy flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-main">Chats</h2>
          <button
            onClick={handleNewChat}
            disabled={!activeModel}
            className="p-1 rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors disabled:opacity-40"
            title="New chat"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {sortedSessions.length === 0 ? (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined text-[28px] text-text-subtle block mb-2">forum</span>
              <p className="text-xs text-text-subtle">No conversations yet</p>
            </div>
          ) : sortedSessions.map(s => {
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveSessionId(s.id);
                    if (s.modelId && allModels.find(m => m.id === s.modelId)) setActiveModelId(s.modelId);
                  }
                }}
                onClick={() => { setActiveSessionId(s.id); if (s.modelId && allModels.find(m => m.id === s.modelId)) setActiveModelId(s.modelId); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-[8px] transition-all group cursor-pointer",
                  "flex items-start gap-2 select-none",
                  isActive ? "bg-primary/8 text-primary" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                )}
              >
                <span className={cn("material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5", isActive ? "fill-1" : "")}>
                  {isActive ? "chat" : "chat_bubble_outline"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[12.5px] font-medium truncate", isActive ? "text-primary" : "")}>{s.title}</p>
                  <p className="text-[11px] text-text-subtle">{relTime(s.updatedAt)} · {s.messages?.length || 0} msgs</p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-subtle hover:text-danger transition-all"
                >
                  <span className="material-symbols-outlined text-[13px]">delete_outline</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-2 border-t border-border-subtle">
          <p className="text-[11px] text-text-subtle text-center">
            {enabledModels.length} model{enabledModels.length !== 1 ? "s" : ""} active
          </p>
        </div>
      </div>

      {/* ── Main Chat ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Top Bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle bg-surface flex-shrink-0">
          {/* Model Selector */}
          <div ref={modelDropRef} className="relative">
            <button
              onClick={handleModelDropdownToggle}
              disabled={loadingModels}
              className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-[8px] text-sm transition-all",
                "bg-bg border border-border text-text-main",
                "hover:border-brand-500/40 hover:bg-surface-2",
                "disabled:opacity-50"
              )}
            >
              {loadingModels
                ? <span className="material-symbols-outlined text-[16px] animate-spin text-text-muted">progress_activity</span>
                : <span className="material-symbols-outlined text-[16px] text-brand-500">smart_toy</span>
              }
              <span className="text-[13px] font-medium max-w-[160px] truncate">
                {loadingModels ? "Loading…" : (activeModel ? activeModel.id.split("/").pop() : "Select model")}
              </span>
              {activeModel && (
                <span className="text-[11px] text-text-subtle truncate hidden sm:inline">
                  {activeModel.owned_by || activeModel.id.split("/")[0]}
                </span>
              )}
              <span className="material-symbols-outlined text-[16px] text-text-subtle">expand_more</span>
            </button>

            {/* Model dropdown */}
            {modelDropOpen && enabledModels.length > 0 && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(300px,90vw)] bg-surface border border-border rounded-[12px] shadow-[var(--shadow-elevated)] overflow-hidden slide-in-top">
                <div className="px-3 py-2 border-b border-border-subtle">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Select Model</p>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar p-1.5">
                  {enabledModels.map(m => {
                    const active = m.id === activeModelId;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setActiveModelId(m.id); setModelDropOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-all",
                          active ? "bg-primary/8 text-primary" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                        )}
                      >
                        <span className={cn("material-symbols-outlined text-[16px]", active ? "fill-1 text-primary" : "text-text-subtle")}>
                          psychology
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[13px] font-medium truncate", active ? "text-primary" : "")}>{m.id.split("/").pop()}</p>
                          <p className="text-[11px] text-text-subtle truncate">{m.owned_by || m.id.split("/")[0]}</p>
                        </div>
                        {active && <span className="material-symbols-outlined text-[16px] text-primary fill-1">check_circle</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>



          <div className="flex-1" />

          {/* New Chat (mobile) */}
          <Button
            variant="ghost"
            size="sm"
            icon="add"
            onClick={handleNewChat}
            disabled={!activeModel}
            className="lg:hidden"
          >
            New
          </Button>

          {/* Settings */}
          <Button
            variant="outline"
            size="sm"
            icon="tune"
            onClick={handleOpenSettings}
          >
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-4 min-h-0">
          {loadError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-danger text-sm">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
              {loadError}
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !isSending && !loadingModels && (
            <div className="flex flex-col items-center justify-center py-16 text-center" style={{ animation: "asstFadeIn 0.4s ease" }}>
              <div className="size-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-[var(--shadow-warm)]">
                <span className="material-symbols-outlined text-white text-[28px]">smart_toy</span>
              </div>
              <h3 className="text-base font-semibold text-text-main mb-1">AI Assistant</h3>
              <p className="text-sm text-text-muted max-w-sm mb-6 leading-relaxed">
                {activeModel
                  ? `Powered by ${activeModel.id.split("/").pop()} via 9router. Ask anything to get started.`
                  : "Connect a provider in the Providers page to get started."}
              </p>
              {activeModel && (
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {["Explain quantum computing simply", "Write a Python hello world", "What is the best way to learn programming?", "Summarize the history of AI"].map(q => (
                    <button
                      key={q}
                      onClick={() => { setDraft(q); textareaRef.current?.focus(); }}
                      className="px-3 py-1.5 text-xs rounded-full border border-border text-text-muted hover:text-text-main hover:border-brand-500/40 hover:bg-bg transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map(msg => (
            <MessageBlock
              key={msg.id}
              msg={msg}
              isStreaming={msg.id === streamingId}
              filesBySubject={filesBySubject}
              onEditSubmit={handleEditSubmit}
              onRegenerate={handleRegenerate}
            />
          ))}

          {isSending && !streamingId && (
            <div className="flex gap-2.5 items-start">
              <AssistantAvatar />
              <div className="px-3 py-2 rounded-[12px] bg-surface border border-border-subtle">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-border-subtle bg-surface px-4 py-3">
          <div className={cn(
            "flex flex-col rounded-[12px] border transition-all overflow-hidden bg-bg",
            "border-border focus-within:border-brand-500/50 focus-within:shadow-[var(--shadow-focus)]"
          )}>
            {/* Attached Files Bar */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border-subtle bg-bg/50">
                {attachedFiles.map(file => {
                  const isImg = file.type?.startsWith("image/");
                  const isUploading = file.status === "uploading";
                  const isError = file.status === "error";

                  return (
                    <div
                      key={file.id}
                      className={cn(
                        "relative flex items-center gap-2 pl-2 pr-1 py-1 rounded-[8px] border text-xs font-medium bg-surface min-w-[120px] max-w-[200px]",
                        isError ? "border-danger/30 bg-danger/5 text-danger" : "border-border"
                      )}
                    >
                      {isImg && file.url ? (
                        <img src={file.url} className="size-6 rounded-[4px] object-cover flex-shrink-0" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px] text-text-muted flex-shrink-0">
                          {isImg ? "image" : "description"}
                        </span>
                      )}

                      <div className="flex-1 min-w-0 leading-tight">
                        <p className="truncate text-[11px] text-text-main" title={file.name}>{file.name}</p>
                        {isUploading ? (
                          <p className="text-[9px] text-text-subtle animate-pulse">Uploading...</p>
                        ) : isError ? (
                          <p className="text-[9px] text-danger truncate" title={file.errorMsg}>{file.errorMsg}</p>
                        ) : (
                          <p className="text-[9px] text-text-subtle">{formatBytes(file.size)}</p>
                        )}
                      </div>

                      <button
                        onClick={() => removeAttachedFile(file.id)}
                        className="size-5 rounded-full hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-end gap-2 px-3 py-2">
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={isSending || !activeModel}
                className={cn(
                  "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-2 transition-all active:scale-95 disabled:opacity-40"
                )}
                title="Attach files"
              >
                <span className="material-symbols-outlined text-[18px]">attach_file</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={isSending || !activeModel}
              />

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeModel
                    ? `Message ${activeModel.id.split("/").pop()}… (Enter to send)`
                    : "Select a model to start chatting…"
                }
                disabled={!activeModel || isSending}
                rows={1}
                className="flex-1 resize-none bg-transparent outline-none text-sm text-text-main placeholder:text-text-subtle font-sans leading-relaxed py-0.5 max-h-40 overflow-y-auto disabled:opacity-50"
              />

              {isSending ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-danger border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  title="Stop"
                >
                  <span className="material-symbols-outlined text-[18px]">stop</span>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!canSend}
                  className={cn(
                    "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center transition-all",
                    canSend
                      ? "bg-brand-500 hover:bg-brand-600 text-white shadow-[var(--shadow-warm)] active:scale-95"
                      : "bg-surface-2 text-text-subtle cursor-not-allowed"
                  )}
                  title="Send (Enter)"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-text-subtle text-center mt-1.5">
            9router · {apiKey ? "API key active" : "No API key (open access)"}
          </p>
        </div>
      </div>
    </div>
  );
}
