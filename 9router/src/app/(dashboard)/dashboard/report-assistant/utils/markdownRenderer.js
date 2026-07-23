import { marked } from "marked";
import katex from "katex";

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

  // 1. Process block math: $$equation$$ -> temporary placeholder
  const blockMathPlaceholder = [];
  let processed = text.replace(/\$\$(.+?)\$\$/gs, (match, equation) => {
    try {
      const rendered = katex.renderToString(equation.trim(), { displayMode: true, throwOnError: false });
      blockMathPlaceholder.push(rendered);
      return `__BLOCK_MATH_PLACEHOLDER_${blockMathPlaceholder.length - 1}__`;
    } catch {
      return match;
    }
  });

  // 2. Process inline math: $equation$ -> temporary placeholder
  const inlineMathPlaceholder = [];
  processed = processed.replace(/\$(.+?)\$/g, (match, equation) => {
    try {
      const rendered = katex.renderToString(equation.trim(), { displayMode: false, throwOnError: false });
      inlineMathPlaceholder.push(rendered);
      return `__INLINE_MATH_PLACEHOLDER_${inlineMathPlaceholder.length - 1}__`;
    } catch {
      return match;
    }
  });

  // 3. Render markdown
  let html = "";
  try {
    html = marked.parse(processed);
  } catch {
    html = processed;
  }

  // 4. Restore block math placeholders
  blockMathPlaceholder.forEach((rendered, idx) => {
    html = html.replace(new RegExp(`__BLOCK_MATH_PLACEHOLDER_${idx}__`, "g"), rendered);
  });

  // 5. Restore inline math placeholders
  inlineMathPlaceholder.forEach((rendered, idx) => {
    html = html.replace(new RegExp(`__INLINE_MATH_PLACEHOLDER_${idx}__`, "g"), rendered);
  });

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
