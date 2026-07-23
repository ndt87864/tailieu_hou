import { marked } from "marked";
import katex from "katex";
import { isSignatureTable } from "./ooxmlConverter.js";

export function removeVietnameseTones(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

export function highlightKeyword(text, keyword) {
  if (!text) return "";
  if (!keyword || !keyword.trim()) return text;
  const normalizedKeyword = removeVietnameseTones(keyword).toLowerCase().trim();
  if (!normalizedKeyword) return text;

  // Split content by tags or markdown to avoid corrupting links/styling
  const regex = new RegExp(`(${keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")})`, "gi");
  return String(text).replace(regex, `<mark class="bg-amber-100 text-amber-900 px-0.5 rounded">$1</mark>`);
}

export function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function normalizeMarkdownTables(content) {
  if (!content) return "";
  const lines = String(content).split(/\r?\n/);
  return lines
    .map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      const separatorOnly =
        cells.length > 0 && cells.every((cell) => /^[\s:-]+$/.test(cell));
      if (!separatorOnly) return line;

      const prev = lines[idx - 1]?.trim() || "";
      const prevCellCount =
        prev.startsWith("|") && prev.endsWith("|")
          ? prev.split("|").slice(1, -1).length
          : cells.length;

      return `| ${Array.from({ length: Math.max(prevCellCount, 1) }, () => "---").join(" | ")} |`;
    })
    .join("\n");
}

/**
 * Render Markdown and inline/block LaTeX equations using KaTeX.
 */
export function renderMarkdownAndMath(content) {
  if (!content) return "";
  
  let text = String(content).replace(/[\u2013\u2014–—]/g, "-");
  text = text.replace(/\[LOGO_HOU\]/g, '<div style="display:flex;justify-content:center;align-items:center;width:100%;margin:1.5cm 0;"><img src="/logo-hou.png" style="width:110px;height:auto;" alt="HOU Logo" /></div>');

  // Pre-render <center>...</center> so marked doesn't ignore markdown inside it
  text = text.replace(/<center>([\s\S]*?)<\/center>/gi, (match, p1) => {
    try {
      const innerHtml = marked.parse(p1.trim(), { gfm: true, breaks: true });
      const centeredHtml = innerHtml
        .replace(/<p>/g, '<p style="text-align: center; text-indent: 0;" class="cover-line">')
        .replace(/<p style="/g, '<p class="cover-line" style="text-align: center; text-indent: 0; ');
      return `<div style="text-align: center;" class="cover-line">${centeredHtml}</div>`;
    } catch (err) {
      return `<div style="text-align: center;" class="cover-line"><p style="text-align: center; text-indent: 0;" class="cover-line">${p1}</p></div>`;
    }
  });

  const mathBlocks = [];
  text = normalizeMarkdownTables(text);

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

  processedText = processedText.replace(/^\s*•\s+/gm, "- ");

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
      html = html.replace(
        item.placeholder,
        `<span class="text-red-500 font-mono">${item.math}</span>`,
      );
    }
  }

  // 7. Mark borderless tables (signature tables)
  html = html.replace(/<table>/g, (match, offset) => {
    const tableEnd = html.indexOf("</table>", offset);
    const tableContent = html.slice(offset, tableEnd);
    if (isSignatureTable(tableContent)) {
      return '<table class="borderless">';
    }
    return '<table>';
  });

  // 8. Add indentation to table captions (starting with "Bảng" or "BẢNG")
  html = html.replace(/<p><strong>((?:Bảng|BẢNG)\s+\d+[^<]*)<\/strong><\/p>/gi, '<p style="text-indent: 1cm !important;"><strong>$1</strong></p>');

  return html;
}

/**
 * Paginate report content using a rough estimation based on lines and character count.
 */
export function paginateReportContent(content, linesPerPage = 32, maxCharsPerPage = 1600) {
  if (!content) return [];
  const paragraphs = String(content).split("\n");
  const pages = [];
  let currentPageLines = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    const estimatedLines = Math.max(1, Math.ceil(para.length / 80));
    if (currentPageLines.length + estimatedLines > linesPerPage || currentLength + para.length > maxCharsPerPage) {
      if (currentPageLines.length > 0) {
        pages.push(currentPageLines.join("\n"));
        currentPageLines = [];
        currentLength = 0;
      }
    }
    currentPageLines.push(para);
    currentLength += para.length;
  }

  if (currentPageLines.length > 0) {
    pages.push(currentPageLines.join("\n"));
  }

  return pages;
}
