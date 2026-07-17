"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/shared/utils/cn";
import useUserStore from "@/store/userStore";

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.pdf,.pptx,.ppt,.docx,.doc";
const MAX_MB = 50;

const FILE_META = {
  pdf:  { icon: "picture_as_pdf", color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  ppt:  { icon: "slideshow",      color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  pptx: { icon: "slideshow",      color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  doc:  { icon: "description",    color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
  docx: { icon: "description",    color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
};
const IMG_META  = { icon: "image",            color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" };
const DEF_META  = { icon: "insert_drive_file", color: "text-text-muted", bg: "bg-surface-2",    border: "border-border" };

function ext(name)      { return (name || "").split(".").pop().toLowerCase(); }
function fmeta(name)    { return /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(name || "") ? IMG_META : FILE_META[ext(name)] || DEF_META; }
function fmtSize(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`; }
function isImg(name)    { return /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(name || ""); }
function baseName(name) { return (name || "").replace(/\.[^.]+$/, ""); }

// ─── Inline markdown renderer (FIX: handles **bold** everywhere) ──────────────
function renderInline(text) {
  if (!text) return null;
  // Split on **...** patterns
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    }
    return p || null;
  });
}

// ─── Markdown block renderer ──────────────────────────────────────────────────
function MarkdownView({ content }) {
  if (!content) return null;
  const lines = content.split("\n");
  const nodes = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { nodes.push(<div key={i} className="h-2" />); continue; }

    // Table: skip separator rows, render data rows
    if (trimmed.startsWith("|")) {
      if (/^\|[\s|:=-]+\|$/.test(trimmed)) continue;
      const cells = trimmed.split("|").slice(1, -1);
      nodes.push(
        <div key={i} className="flex border-b border-border">
          {cells.map((c, ci) => (
            <div key={ci} className="flex-1 px-2 py-1 border-r border-border last:border-0 text-xs text-text-main">
              {renderInline(c.trim())}
            </div>
          ))}
        </div>
      );
      continue;
    }

    // Headings
    const hm = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const lvl = hm[1].length;
      const cls =
        lvl === 1 ? "text-lg font-bold text-text-main mt-3 mb-1 pb-1.5 border-b border-border" :
        lvl === 2 ? "text-base font-bold text-text-main mt-2.5 mb-0.5" :
                    "text-sm font-semibold text-text-main mt-2";
      nodes.push(<p key={i} className={cls}>{renderInline(hm[2])}</p>);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) { nodes.push(<hr key={i} className="my-3 border-border" />); continue; }

    // Unordered list — FIX: apply renderInline to item text
    const ul = trimmed.match(/^[-*•]\s+(.+)/);
    if (ul) {
      nodes.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-primary mt-0.5 shrink-0 font-bold">•</span>
          <span className="text-text-main">{renderInline(ul[1])}</span>
        </div>
      );
      continue;
    }

    // Ordered list — FIX: apply renderInline to item text
    const ol = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (ol) {
      nodes.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-primary shrink-0 font-semibold min-w-[1.5rem] text-right">{ol[1]}.</span>
          <span className="text-text-main">{renderInline(ol[2])}</span>
        </div>
      );
      continue;
    }

    // Normal paragraph with inline bold
    nodes.push(
      <p key={i} className="text-sm text-text-main leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  }

  return <div className="p-5 space-y-1.5">{nodes}</div>;
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function getOcrModel(isImage) {
  let model = null;
  try {
    const data = await fetch("/api/v1/models/default", { cache: "no-store" }).then(r => r.json());
    model = data?.model?.id || null;
  } catch { /* ignore */ }
  if (!model) throw new Error("Không tìm thấy model khả dụng. Hãy kết nối AI provider.");
  return model;
}

async function runImageOcr(dataUrl, pageName, model, signal) {
  const prompt = `Trích xuất TOÀN BỘ nội dung từ ảnh trang tài liệu "${pageName}" này:\n- Tất cả văn bản (không bỏ sót dòng nào)\n- Dùng Markdown: ## tiêu đề, - danh sách, **chữ đậm**, | bảng\n- Giữ nguyên cấu trúc và thứ tự gốc\n- Không thêm nhận xét hay giải thích thêm`;

  const messages = [{
    role: "user",
    content: [
      { type: "image_url", image_url: { url: dataUrl } },
      { type: "text", text: prompt }
    ],
  }];

  const res = await fetch("/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, max_tokens: 4096 }),
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Lỗi ${res.status}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Model không trả về nội dung.");
  return text;
}

async function runOcr(file, signal) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const imgFile = isImg(file.name);
  const prompt = imgFile
    ? `Trích xuất TOÀN BỘ nội dung từ ảnh này:\n- Tất cả văn bản (không bỏ sót dòng nào)\n- Dùng Markdown: ## tiêu đề, - danh sách, **chữ đậm**, | bảng\n- Giữ nguyên cấu trúc và thứ tự gốc\n- Không thêm nhận xét hay giải thích thêm`
    : `Trích xuất nội dung tài liệu "${file.name}" sang Markdown. Giữ nguyên cấu trúc gốc.`;

  const model = await getOcrModel(imgFile);

  const messages = [{
    role: "user",
    content: imgFile
      ? [{ type: "image_url", image_url: { url: dataUrl } }, { type: "text", text: prompt }]
      : [{ type: "text", text: prompt }],
  }];

  const res = await fetch("/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, max_tokens: 4096 }),
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Lỗi ${res.status}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Model không trả về nội dung.");
  return text;
}

// ─── Per-page OCR cleaner: strips repeated page headers/footers ──────────────
/**
 * Removes per-page artefacts injected by the AI when OCR-ing exam papers:
 * - University name headers  (TRƯỜNG ĐẠI HỌC …)
 * - Exam code headers        (Mã đề: XXXX)
 * - Footer tables            (| code | … | Trang N/M |)
 * - Horizontal rules         (---)
 */
function cleanPageOcr(text) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t   = raw.trim();

    // Skip school/university heading lines
    if (/(?:TRƯỜNG\s+(?:ĐẠI HỌC|ĐH)|ĐẠI HỌC\s+MỞ|ĐẠI HỌC\s+XÂY)/i.test(t)) { i++; continue; }

    // Skip exam code lines (may be bold-wrapped: **Mã đề: 440**)
    if (/^#{0,3}\s*\*{0,2}\s*Mã\s+đề\s*:/i.test(t)) { i++; continue; }

    // Skip horizontal rules
    if (/^-{3,}$/.test(t)) { i++; continue; }

    // Detect & skip footer / header tables
    if (t.startsWith("|")) {
      // Collect the whole table block
      const block = [];
      let j = i;
      while (j < lines.length && (lines[j].trim().startsWith("|") || /^[|\s:-]+$/.test(lines[j].trim()))) {
        block.push(lines[j]);
        j++;
      }
      const flat = block.join(" ");
      // Footer table? (contains Trang N/M or alphanumeric exam codes)
      const isFooter =
        /Trang\s*\d+\/\d+/i.test(flat) ||
        /\b[A-Z]{2,6}\d{4,}\b/.test(flat) ||
        /E[GX]\d{2}/.test(flat) ||
        /DDT|GDT|EG35|EG36/i.test(flat);
      if (isFooter) { i = j; continue; }  // skip footer table
      // Otherwise keep table
      block.forEach(l => out.push(l));
      i = j;
      continue;
    }

    out.push(raw);
    i++;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Post-merge artifact filter (removes lone asterisks, extra whitespace) ────
function filterArtifacts(text) {
  return text
    .replace(/^\s*\*{1,2}\s*$/gm, "")     // lone * or **
    .replace(/^\s*[-–—]\s*$/gm, "")       // lone dashes
    .replace(/\n{3,}/g, "\n\n")           // max 2 blank lines
    .replace(/\s{2,}(?=\n)/g, "")         // trailing spaces
    .trim();
}

// ─── Download helpers ─────────────────────────────────────────────────────────
function dlBlob(content, filename, type) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([content], { type })),
    download: filename,
  });
  a.click(); URL.revokeObjectURL(a.href);
}
function dlTxt(content, name) { dlBlob(content, name, "text/plain;charset=utf-8"); }

// Load JSZip from CDN (once)
async function loadJSZip() {
  if (typeof window !== "undefined" && window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error("Cannot load JSZip"));
    document.head.appendChild(s);
  });
}

// Load PDF.js from CDN (once)
async function loadPdfJs() {
  const CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  if (typeof window !== "undefined" && window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CDN;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Render PDF to array of data-URL page images
async function renderPdfPreview(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    pages.push(canvas.toDataURL("image/jpeg", 0.85));
  }
  return { type: "pdf", pages, total };
}

// Extract text content from PPTX (slide by slide)
async function extractPptxContent(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  // Find slide files sorted by number
  const slideNames = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)[1]);
      const nb = parseInt(b.match(/(\d+)/)[1]);
      return na - nb;
    });
  const slides = [];
  for (const name of slideNames) {
    const xml = await zip.file(name).async("string");
    // Extract all <a:t> text runs
    const texts = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = m[1].trim();
      if (t) texts.push(t);
    }
    slides.push(texts.join(" ").trim());
  }
  return { type: "pptx", slides };
}

// Extract text content from DOCX paragraph by paragraph
async function extractDocxContent(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const docFile = zip.file("word/document.xml");
  if (!docFile) return { type: "docx", paragraphs: [] };
  const xml = await docFile.async("string");
  // Split by paragraph and extract text runs
  const paraRe = /<w:p[ >]([\s\S]*?)<\/w:p>/g;
  const runRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const paragraphs = [];
  let pm;
  while ((pm = paraRe.exec(xml)) !== null) {
    const paraXml = pm[1];
    const texts = [];
    let rm;
    while ((rm = runRe.exec(paraXml)) !== null) {
      if (rm[1].trim()) texts.push(rm[1]);
    }
    const line = texts.join("").trim();
    if (line) paragraphs.push(line);
  }
  return { type: "docx", paragraphs };
}

// Convert inline markdown (**bold**) to OOXML runs
function toRuns(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g);
  return parts.map((p) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
      return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(p.slice(2,-2))}</w:t></w:r>`;
    return p ? `<w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r>` : "";
  }).join("");
}

// Convert markdown text to OOXML paragraph list
function mdToOoxml(content) {
  const lines = content.split("\n");
  const ps = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { ps.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`); continue; }
    // Heading
    const hm = t.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const lvl = Math.min(hm[1].length, 3);
      const style = ["Heading1","Heading2","Heading3"][lvl-1];
      ps.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${toRuns(hm[2])}</w:p>`);
      continue;
    }
    // HR
    if (/^-{3,}$/.test(t)) {
      ps.push(`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`);
      continue;
    }
    // Unordered list
    const ul = t.match(/^[-*•]\s+(.+)/);
    if (ul) {
      ps.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${toRuns(ul[1])}</w:p>`);
      continue;
    }
    // Ordered list
    const ol = t.match(/^(\d+)[.):]\s+(.+)/);
    if (ol) {
      ps.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>${toRuns(ol[2])}</w:p>`);
      continue;
    }
    // Table separator row — skip
    if (t.startsWith("|") && /^[|:\s-]+$/.test(t)) continue;
    // Table data row — render cells joined
    if (t.startsWith("|")) {
      const cells = t.split("|").slice(1,-1).map(c=>c.trim()).join("  |  ");
      ps.push(`<w:p>${toRuns(cells)}</w:p>`);
      continue;
    }
    // Normal paragraph
    ps.push(`<w:p>${toRuns(t)}</w:p>`);
  }
  return ps.join("\n");
}

// Generate and download a real .docx file (Office Open XML)
async function dlDocx(content, filename) {
  try {
    const JSZip = await loadJSZip();
    const zip   = new JSZip();
    const W     = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const PKGREL = "http://schemas.openxmlformats.org/package/2006/relationships";
    const OFFREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    // [Content_Types].xml
    zip.file("[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"  ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`);

    // _rels/.rels
    zip.folder("_rels").file(".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    const word = zip.folder("word");

    // word/_rels/document.xml.rels
    word.folder("_rels").file("document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/styles"    Target="styles.xml"/>
  <Relationship Id="rId2" Type="${OFFREL}/numbering" Target="numbering.xml"/>
</Relationships>`);

    // word/document.xml
    word.file("document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}">
  <w:body>
${mdToOoxml(content)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`);

    // word/styles.xml
    word.file("styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
    <w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="vi-VN"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
</w:styles>`);

    // word/numbering.xml (bullet + decimal)
    word.file("numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">
    <w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
    <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
  </w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
    <w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
    <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
  </w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`);

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: filename.replace(/\.(rtf|txt)$/, ".docx"),
    });
    a.click(); URL.revokeObjectURL(a.href);
  } catch (err) {
    console.error("docx generation failed:", err);
    dlTxt(content, filename.replace(/\.(docx|rtf)$/, ".txt"));
  }
}

// ─── Toolbar with download buttons ───────────────────────────────────────────
function ResultToolbar({ isEditing, onToggleEdit, onTxt, onDocx }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onToggleEdit}
        className={cn("flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors",
          isEditing
            ? "bg-primary/10 text-primary border-primary/20"
            : "bg-surface border-border text-text-muted hover:text-text-main"
        )}>
        <span className="material-symbols-outlined text-[12px]">{isEditing ? "visibility" : "edit"}</span>
        <span className="hidden sm:inline">{isEditing ? "Xem" : "Sửa"}</span>
      </button>
      <button onClick={onTxt}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-border bg-surface text-text-muted hover:text-success hover:border-success/30 transition-colors">
        <span className="material-symbols-outlined text-[12px]">download</span>.txt
      </button>
      <button onClick={onDocx}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-border bg-surface text-text-muted hover:text-info hover:border-info/30 transition-colors">
        <span className="material-symbols-outlined text-[12px]">download</span>
        <span className="hidden sm:inline">.docx</span>
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocScannerClient() {
  // File state
  const [files, setFiles]             = useState([]);
  const [activeIdx, setActiveIdx]     = useState(0);
  const [previewUrls, setPreviewUrls] = useState({});
  const [dragging, setDragging]       = useState(false);
  // Scan state
  const [results, setResults]   = useState({});
  const [scanning, setScanning] = useState({});
  const [progress, setProgress] = useState({});
  const [progressMsg, setProgressMsg] = useState({});
  const [errors, setErrors]     = useState({});
  // Batch mode
  const [viewMode, setViewMode]       = useState("single");  // "single" | "batch"
  const [mergedResult, setMergedResult] = useState("");
  const [batchScanning, setBatchScanning] = useState(false);
  const [filterMode, setFilterMode]   = useState(false);
  // Edit state (shared for single+batch)
  const [isEditing, setIsEditing]     = useState(false);
  const [editVal, setEditVal]         = useState("");
  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // File preview data (PDF pages / PPTX slides / DOCX paragraphs)
  const [previewData, setPreviewData] = useState({}); // { name: { type, pages/slides/paragraphs, total?, loading, error } }

  // Available models & selected model
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [fullModelsLoaded, setFullModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  // Scan history
  const [history, setHistory] = useState([]);
    const [historyOpen, setHistoryOpen] = useState(false);

  // Username and Supabase Storage upload helper
  const [username, setUsername] = useState("admin");
  const [downloadError, setDownloadError] = useState({});

  const { fetchUser } = useUserStore();

  useEffect(() => {
    // Lấy thông tin user hiện tại để xác định thư mục lưu trữ trên Supabase
    fetchUser()
      .then(data => {
        if (data?.username) {
          setUsername(data.username.toLowerCase());
        }
      })
      .catch(() => {});
  }, [fetchUser]);

  // Clear download errors when username changes to allow retrying with the new username
  useEffect(() => {
    setDownloadError({});
  }, [username]);

  const uploadToSupabaseStorage = async (file) => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const filePath = `ocr/${username}/${file.name}`;
      const { error } = await supabase.storage
        .from("ai_assistant")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true
        });
      if (error) {
        console.error(`[Supabase Storage] Lỗi upload file ${file.name}:`, error.message);
      } else {
        console.log(`[Supabase Storage] Upload thành công file ${file.name} lên: ai_assistant/${filePath}`);
      }
    } catch (err) {
      console.error(`[Supabase Storage] Lỗi không thể upload file ${file.name}:`, err);
    }
  };

  const downloadFromSupabaseStorage = async (filename) => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const filePath = `ocr/${username}/${filename}`;
      const { data, error } = await supabase.storage
        .from("ai_assistant")
        .download(filePath);
      if (error) {
        throw error;
      }
      return new File([data], filename, { type: data.type });
    } catch (err) {
      console.error(`[Supabase Storage] Lỗi tải file ${filename}:`, err);
      throw err;
    }
  };

  const fetchDefaultModel = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/models/default", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const model = json?.model;
      if (!model?.id) return;
      setAvailableModels([model]);
      setSelectedModel(model.id);
    } catch (err) {
      console.error("Loi khi lay model mac dinh:", err);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    if (fullModelsLoaded) return;
    setLoadingModels(true);
    try {
      const res = await fetch("/api/v1/models", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];
      setAvailableModels(list);
      
      setSelectedModel(prev => list.some(m => m.id === prev) ? prev : (list[0]?.id || prev));
      setFullModelsLoaded(true);
    } catch (err) {
      console.error("Lỗi khi lấy danh sách model:", err);
    } finally {
      setLoadingModels(false);
    }
  }, [fullModelsLoaded]);

  const handleModelDropdownToggle = useCallback(async () => {
    if (!modelDropOpen) await fetchModels();
    setModelDropOpen(v => !v);
  }, [fetchModels, modelDropOpen]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner/history");
      if (!res.ok) return;
      const json = await res.json();
      setHistory(json.history || []);
    } catch (err) {
      console.error("Lỗi khi lấy lịch sử quét:", err);
    }
  }, []);

  useEffect(() => {
    fetchDefaultModel();
    fetchHistory();
  }, [fetchDefaultModel, fetchHistory]);

  const deleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa mục lịch sử này?")) return;
    try {
      const res = await fetch(`/api/scanner/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error("Lỗi khi xóa lịch sử:", err);
    }
  };

  const clearAllHistory = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử quét? Hành động này không thể hoàn tác.")) return;
    try {
      const res = await fetch("/api/scanner/history", { method: "DELETE" });
      if (res.ok) {
        setHistory([]);
      }
    } catch (err) {
      console.error("Lỗi khi xóa sạch lịch sử:", err);
    }
  };

  const restoreHistoryItem = (item) => {
    // Clean up old preview URLs to prevent memory leaks
    Object.values(previewUrls).forEach(u => u && URL.revokeObjectURL(u));

    if (item.fileType === "batch") {
      const names = (item.filename || "").split(", ").filter(Boolean);
      const mockFiles = names.map(name => ({
        name,
        size: 0,
        type: ext(name) || "file",
        isMock: true,
      }));

      setFiles(mockFiles);
      setActiveIdx(0);
      setPreviewUrls({});
      setResults({});
      setErrors({});
      setPreviewData({});
      setMergedResult(item.results);
      setScanning({});
      setProgress({});
      setProgressMsg({});
      setIsEditing(false);
      
      setSelectedModel(item.model);
      setViewMode("batch");
      setHistoryOpen(false);
      return;
    }

    const mockFile = {
      name: item.filename,
      size: 0,
      type: item.fileType,
      isMock: true,
    };
    
    setFiles([mockFile]);
    setActiveIdx(0);
    setPreviewUrls({});
    setResults({ [item.filename]: item.results });
    setErrors({});
    setPreviewData({});
    setMergedResult("");
    setScanning({});
    setProgress({});
    setProgressMsg({});
    setIsEditing(false);
    
    setSelectedModel(item.model);
    setViewMode("single");
    setHistoryOpen(false);
  };

  const fileRef    = useRef(null);
  const aborts     = useRef({});
  const textaRef   = useRef(null);
  const modelDropRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelDropRef.current && !modelDropRef.current.contains(e.target)) {
        setModelDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derived: active file
  const active     = files[activeIdx];
  const activeKey  = active?.name;
  const rawActiveResult  = results[activeKey] || "";
  const activeResult  = filterMode ? filterArtifacts(cleanPageOcr(rawActiveResult)) : rawActiveResult;
  const isScanning    = scanning[activeKey] || false;
  const activeError   = errors[activeKey] || null;
  const activeProg    = progress[activeKey] || 0;
  const previewUrl    = previewUrls[activeKey];
  const activeModel = availableModels.find(m => m.id === selectedModel) ||
    (selectedModel ? { id: selectedModel, owned_by: selectedModel.split("/")[0] } : null);

  // Check if there are already scanned results in the current session
  const hasResults = Object.values(results).some(Boolean);

  // Derived mode for file upload and type enforcement
  // If there are results, we allow a fresh start with any file type!
  const fileMode = hasResults ? "none" : (files.length === 0 ? "none" : isImg(files[0].name) ? "image" : "doc");
  const inputAccept = fileMode === "image"
    ? ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff"
    : fileMode === "doc"
      ? ".pdf,.pptx,.ppt,.docx,.doc"
      : ACCEPT;
  const inputMultiple = fileMode !== "doc";

  // Current displayed content
  const isBatchView  = viewMode === "batch" && files.length > 1;
  const displayResult = isBatchView ? mergedResult : activeResult;
  const displayContent = isEditing ? editVal : displayResult;

  // Cleanup preview URLs
  useEffect(() => {
    return () => Object.values(previewUrls).forEach(u => u && URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textaRef.current) {
      textaRef.current.style.height = "auto";
      textaRef.current.style.height = textaRef.current.scrollHeight + "px";
    }
  }, [editVal, isEditing]);

  // Reset edit when switching modes or active file
  useEffect(() => { setIsEditing(false); }, [viewMode, activeIdx]);

  // Auto-generate rich preview when active file changes (PDF/PPTX/DOCX)
  useEffect(() => {
    if (!active || active.isMock) return;
    const name = active.name;
    const e = ext(name);
    // Skip images (handled via previewUrls) and already-generated previews
    if (isImg(name)) return;
    if (previewData[name]) return; // already done
    if (!["pdf","pptx","ppt","docx","doc"].includes(e)) return;

    setPreviewData(p => ({ ...p, [name]: { loading: true } }));
    const run = async () => {
      try {
        let data;
        if (e === "pdf") data = await renderPdfPreview(active);
        else if (e === "pptx" || e === "ppt") data = await extractPptxContent(active);
        else data = await extractDocxContent(active);
        setPreviewData(p => ({ ...p, [name]: { ...data, loading: false } }));
      } catch (err) {
        setPreviewData(p => ({ ...p, [name]: { loading: false, error: err.message } }));
      }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, files]);

  // Resolve mock files by downloading them from Supabase Storage in the background
  useEffect(() => {
    if (!active || !active.isMock) return;
    const name = active.name;
    if (downloadError[name]) return; // Let user manually retry

    let aborted = false;
    const loadMockFile = async () => {
      try {
        const realFile = await downloadFromSupabaseStorage(name);
        if (aborted) return;

        setFiles(prev => prev.map(f => f.name === name ? realFile : f));
        if (isImg(name)) {
          const url = URL.createObjectURL(realFile);
          setPreviewUrls(prev => ({ ...prev, [name]: url }));
        }
      } catch (err) {
        if (aborted) return;
        setDownloadError(prev => ({ ...prev, [name]: err.message }));
      }
    };

    loadMockFile();
    return () => {
      aborted = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, files, username]);

  // ─── File management ────────────────────────────────────────────────────────
  const addFiles = useCallback((incoming) => {
    const all = Array.from(incoming).filter(f => {
      const e = ext(f.name);
      return f.size <= MAX_MB * 1024 * 1024 &&
        ["jpg","jpeg","png","webp","gif","bmp","tiff","pdf","pptx","ppt","docx","doc"].includes(e);
    });
    if (!all.length) return;

    // Check if there are already scanned results in the current session
    const hasResults = Object.values(results).some(Boolean);

    if (hasResults) {
      // Fresh session: cleanup all old preview URLs to prevent leaks
      Object.values(previewUrls).forEach(u => u && URL.revokeObjectURL(u));

      // Determine mode of the new incoming files
      const newMode = isImg(all[0].name) ? "image" : "doc";

      if (newMode === "doc") {
        const docFile = all.find(f => !isImg(f.name)) || all[0];
        setFiles([docFile]);
        setActiveIdx(0);
        setPreviewUrls({});
        setResults({});
        setErrors({});
        setPreviewData({});
        setMergedResult("");
        setScanning({});
        setProgress({});
        setProgressMsg({});
        setIsEditing(false);
      } else {
        const validImages = all.filter(f => isImg(f.name));
        if (!validImages.length) return;
        const urls = {};
        validImages.forEach(f => {
          urls[f.name] = URL.createObjectURL(f);
        });
        setFiles(validImages);
        setActiveIdx(validImages.length - 1);
        setPreviewUrls(urls);
        setResults({});
        setErrors({});
        setPreviewData({});
        setMergedResult("");
        setScanning({});
        setProgress({});
        setProgressMsg({});
        setIsEditing(false);
      }
      return;
    }

    // Otherwise, normal append/replace behavior:
    // Determine current mode from existing files OR first incoming file
    const currentMode = files.length > 0
      ? (isImg(files[0].name) ? "image" : "doc")
      : (isImg(all[0].name) ? "image" : "doc");

    if (currentMode === "doc") {
      // Document mode: only allow 1 file, new replaces old
      const docFile = all.find(f => !isImg(f.name)) || all[0];
      
      // Cleanup old preview URLs to prevent leaks
      Object.values(previewUrls).forEach(u => u && URL.revokeObjectURL(u));

      setFiles([docFile]);
      setActiveIdx(0);
      setPreviewUrls({});
      setResults({});
      setErrors({});
      setPreviewData({});
      setMergedResult("");
      setScanning({});
      setProgress({});
      setProgressMsg({});
      setIsEditing(false);
    } else {
      // Image mode: only allow images
      const validImages = all.filter(f => isImg(f.name));
      if (!validImages.length) return;

      const urls = {};
      validImages.forEach(f => {
        urls[f.name] = URL.createObjectURL(f);
      });

      setFiles(prev => {
        const names = new Set(prev.map(f => f.name));
        const toAdd = validImages.filter(f => !names.has(f.name));
        if (toAdd.length) {
          setActiveIdx(prev.length + toAdd.length - 1);
        }
        return [...prev, ...toAdd];
      });
      setPreviewUrls(prev => ({ ...prev, ...urls }));
    }
  }, [files, previewUrls, results]);

  const removeFile = (idx) => {
    const f = files[idx];
    if (!f) return;
    if (previewUrls[f.name]) URL.revokeObjectURL(previewUrls[f.name]);
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.max(0, idx <= prev ? prev - 1 : prev));
    setMergedResult("");
  };

  const moveFile = (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= files.length) return;
    setFiles(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
    if (activeIdx === idx) setActiveIdx(next);
    else if (activeIdx === next) setActiveIdx(idx);
    setMergedResult(""); // invalidate merge when order changes
  };

  // ─── Core Sequential Scanning Processor ────────────────────────────────────
  const processFileOcr = async (file, signal) => {
    const k = file.name;
    const e = ext(k);

    // 1. Image Files
    if (isImg(k)) {
      const model = selectedModel || await getOcrModel(true);
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      setProgress(p => ({ ...p, [k]: 0 }));
      setProgressMsg(m => ({ ...m, [k]: "Đang quét..." }));

      let pct = 0;
      const tick = setInterval(() => {
        pct = Math.min(pct + 10, 90);
        setProgress(p => ({ ...p, [k]: Math.round(pct) }));
      }, 300);

      try {
        const text = await runImageOcr(dataUrl, k, model, signal);
        clearInterval(tick);
        setProgress(p => ({ ...p, [k]: 100 }));
        setProgressMsg(m => ({ ...m, [k]: "" }));
        return text;
      } catch (err) {
        clearInterval(tick);
        throw err;
      }
    }

    // 2. PDF Files: Page-by-page sequential vision OCR
    if (e === "pdf") {
      setProgress(p => ({ ...p, [k]: 0 }));
      setProgressMsg(m => ({ ...m, [k]: "Đang chuẩn bị trang..." }));

      let pd = previewData[k];
      if (!pd || pd.loading || !pd.pages) {
        pd = await renderPdfPreview(file);
        setPreviewData(prev => ({ ...prev, [k]: pd }));
      }

      const total = pd.pages.length;
      const pagesText = [];
      const model = selectedModel || await getOcrModel(true);

      for (let i = 0; i < total; i++) {
        if (signal?.aborted) throw new Error("Aborted");
        const pageNum = i + 1;
        const pct = Math.round((i / total) * 100);
        
        setProgress(p => ({ ...p, [k]: pct }));
        setProgressMsg(m => ({ ...m, [k]: `trang ${pageNum}/${total}` }));

        const pageText = await runImageOcr(pd.pages[i], `Trang ${pageNum}`, model, signal);
        pagesText.push(pageText);

        // Progressive stream update so user sees results instantly
        setResults(r => ({ ...r, [k]: pagesText.join("\n\n---\n\n") }));

        const finalPct = Math.round((pageNum / total) * 100);
        setProgress(p => ({ ...p, [k]: finalPct }));
      }

      setProgress(p => ({ ...p, [k]: 100 }));
      setProgressMsg(m => ({ ...m, [k]: "" }));
      return pagesText.join("\n\n---\n\n");
    }

    // 3. PPTX / PPT Files: Slide-by-slide sequential text clean/format
    if (e === "pptx" || e === "ppt") {
      setProgress(p => ({ ...p, [k]: 0 }));
      setProgressMsg(m => ({ ...m, [k]: "Đang đọc slide..." }));

      let pd = previewData[k];
      if (!pd || pd.loading || !pd.slides) {
        pd = await extractPptxContent(file);
        setPreviewData(prev => ({ ...prev, [k]: pd }));
      }

      const total = pd.slides.length;
      const slidesText = [];
      const model = selectedModel || await getOcrModel(false);

      for (let i = 0; i < total; i++) {
        if (signal?.aborted) throw new Error("Aborted");
        const slideNum = i + 1;
        const pct = Math.round((i / total) * 100);
        
        setProgress(p => ({ ...p, [k]: pct }));
        setProgressMsg(m => ({ ...m, [k]: `slide ${slideNum}/${total}` }));

        const slideRawText = pd.slides[i] || "";
        let slideText = "";
        if (slideRawText.trim()) {
          const prompt = `Định dạng và làm sạch nội dung văn bản của slide "Slide ${slideNum}" này sang Markdown. Giữ nguyên cấu trúc, tiêu đề và danh sách nếu có, không thêm lời dẫn hay giải thích:\n\n${slideRawText}`;
          const messages = [{ role: "user", content: [{ type: "text", text: prompt }] }];
          const res = await fetch("/api/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, stream: false, max_tokens: 2048 }),
            signal,
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e?.error?.message || `Lỗi ${res.status}`);
          }
          const json = await res.json();
          slideText = json.choices?.[0]?.message?.content || "";
        } else {
          slideText = `*Slide ${slideNum} không có văn bản*`;
        }

        slidesText.push(slideText);
        setResults(r => ({ ...r, [k]: slidesText.join("\n\n---\n\n") }));

        const finalPct = Math.round((slideNum / total) * 100);
        setProgress(p => ({ ...p, [k]: finalPct }));
      }

      setProgress(p => ({ ...p, [k]: 100 }));
      setProgressMsg(m => ({ ...m, [k]: "" }));
      return slidesText.join("\n\n---\n\n");
    }

    // 4. DOCX / DOC Files: Unified paragraph parsing
    if (e === "docx" || e === "doc") {
      setProgress(p => ({ ...p, [k]: 0 }));
      setProgressMsg(m => ({ ...m, [k]: "Đang đọc tài liệu..." }));

      let pd = previewData[k];
      if (!pd || pd.loading || !pd.paragraphs) {
        pd = await extractDocxContent(file);
        setPreviewData(prev => ({ ...prev, [k]: pd }));
      }

      const rawText = pd.paragraphs.join("\n");
      if (!rawText.trim()) {
        setProgress(p => ({ ...p, [k]: 100 }));
        setProgressMsg(m => ({ ...m, [k]: "" }));
        return "*Tài liệu không có văn bản*";
      }

      setProgress(p => ({ ...p, [k]: 50 }));
      setProgressMsg(m => ({ ...m, [k]: "Đang phân tích..." }));

      const model = selectedModel || await getOcrModel(false);
      const prompt = `Định dạng và trích xuất nội dung tài liệu này sang Markdown. Giữ nguyên cấu trúc, tiêu đề và danh sách nếu có:\n\n${rawText}`;
      const messages = [{ role: "user", content: [{ type: "text", text: prompt }] }];
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false, max_tokens: 4096 }),
        signal,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `Lỗi ${res.status}`);
      }
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || "";

      setProgress(p => ({ ...p, [k]: 100 }));
      setProgressMsg(m => ({ ...m, [k]: "" }));
      return text;
    }

    // Fallback: standard runOcr
    return runOcr(file, signal);
  };

  // ─── Single file scan ───────────────────────────────────────────────────────
  const scanSingle = async (file) => {
    if (file.isMock) {
      alert("Tài liệu này được khôi phục từ lịch sử. Hãy chọn/tải file mới để thực hiện quét lại.");
      return;
    }
    const k = file.name;
    if (results[k]) {
      const confirmScan = confirm("Bạn có muốn quét lại không?");
      if (!confirmScan) return;
    }
    if (aborts.current[k]) aborts.current[k].abort();
    const ctrl = new AbortController();
    aborts.current[k] = ctrl;

    setScanning(s => ({ ...s, [k]: true }));
    setErrors(e => ({ ...e, [k]: null }));
    setResults(r => ({ ...r, [k]: "" }));
    setIsEditing(false);

    try {
      const text = await processFileOcr(file, ctrl.signal);
      setResults(r => ({ ...r, [k]: text }));

      // 1. Upload file to Supabase Storage AFTER successful scan
      await uploadToSupabaseStorage(file);

      // 2. Save history entry!
      try {
        const fileModel = selectedModel || await getOcrModel(isImg(file.name));
        await fetch("/api/scanner/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            fileType: file.type || ext(file.name) || "file",
            model: fileModel,
            results: text
          })
        });
        fetchHistory(); // reload history list!
      } catch (saveErr) {
        console.error("Failed to save scan history:", saveErr);
      }
    } catch (err) {
      if (err.name !== "AbortError") setErrors(e => ({ ...e, [k]: err.message }));
    } finally {
      setScanning(s => ({ ...s, [k]: false }));
      setProgress(prev => ({ ...prev, [k]: 0 }));
      setProgressMsg(prev => ({ ...prev, [k]: "" }));
    }
  };

  // ─── Batch scan & merge ─────────────────────────────────────────────────────
  const scanBatch = async () => {
    if (files.some(f => f.isMock)) {
      alert("Có tài liệu được khôi phục từ lịch sử. Hãy chọn/tải file mới để thực hiện quét lại.");
      return;
    }

    const hasAnyResult = files.some(f => results[f.name]) || mergedResult;
    if (hasAnyResult) {
      const confirmScan = confirm("Bạn có muốn quét lại không?");
      if (!confirmScan) return;

      // Xóa kết quả lưu tạm của các file trong loạt để quét mới hoàn toàn
      setResults(prev => {
        const next = { ...prev };
        files.forEach(f => {
          delete next[f.name];
        });
        return next;
      });
    }

    setBatchScanning(true);
    setIsEditing(false);
    setMergedResult("");
    const parts = [];
    const successfulFiles = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const k = f.name;
      // Reuse cached result
      if (results[k]) {
        parts.push({ name: f.name, text: results[k] });
        successfulFiles.push(f);
        await uploadToSupabaseStorage(f);
        continue;
      }

      if (aborts.current[k]) aborts.current[k].abort();
      const ctrl = new AbortController();
      aborts.current[k] = ctrl;
      setScanning(s => ({ ...s, [k]: true }));
      setErrors(e => ({ ...e, [k]: null }));

      try {
        const text = await processFileOcr(f, ctrl.signal);
        setResults(r => ({ ...r, [k]: text }));
        parts.push({ name: f.name, text });
        successfulFiles.push(f);

        // Upload successful file in batch
        await uploadToSupabaseStorage(f);
      } catch (err) {
        if (err.name !== "AbortError") {
          setErrors(e => ({ ...e, [k]: err.message }));
          parts.push({ name: f.name, text: `[Lỗi quét ${k}: ${err.message}]` });
        }
      } finally {
        setScanning(s => ({ ...s, [k]: false }));
        setProgress(prev => ({ ...prev, [k]: 0 }));
        setProgressMsg(prev => ({ ...prev, [k]: "" }));
      }
    }

    // Merge results
    let merged;
    if (filterMode) {
      // FILTER ON: clean each page individually, then join seamlessly (no file-name headers)
      const cleanedParts = parts.map(p => cleanPageOcr(p.text));
      merged = cleanedParts.join("\n\n");
      merged = filterArtifacts(merged);
    } else {
      // FILTER OFF: add ## N. filename separators and --- dividers for reference
      merged = parts
        .map((p, i) => files.length > 1 ? `## ${i + 1}. ${p.name}\n\n${p.text}` : p.text)
        .join("\n\n---\n\n");
    }
    setMergedResult(merged);
    setBatchScanning(false);

    // Save ONE unified history entry for the successfully scanned batch!
    if (successfulFiles.length > 0) {
      try {
        const fileNamesStr = successfulFiles.map(f => f.name).join(", ");
        const firstFile = successfulFiles[0];
        const fileModel = selectedModel || await getOcrModel(isImg(firstFile.name));
        
        await fetch("/api/scanner/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: fileNamesStr,
            fileType: "batch",
            model: fileModel,
            results: merged
          })
        });
      } catch (saveErr) {
        console.error("Failed to save batch scan history:", saveErr);
      }
    }

    // Refresh history list at the end of batch scan
    fetchHistory();
  };

  // ─── Edit helpers ───────────────────────────────────────────────────────────
  const toggleEdit = () => {
    if (!isEditing) setEditVal(displayResult);
    setIsEditing(v => !v);
  };

  const hasFiles = files.length > 0;
  const anyScanning = Object.values(scanning).some(Boolean) || batchScanning;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 relative">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 md:px-5 py-3 border-b border-border bg-surface z-10">

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex items-center justify-center size-8 rounded-lg hover:bg-surface-2 transition-colors shrink-0"
          onClick={() => setSidebarOpen(v => !v)}
        >
          <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 20 }}>
            {sidebarOpen ? "close" : "menu"}
          </span>
        </button>

        {/* Logo + title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="shrink-0 size-8 rounded-[9px] bg-gradient-to-br from-primary to-brand-700 shadow-[var(--shadow-warm)] flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>document_scanner</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-text-main leading-tight">Document Scanner</h1>
            <p className="text-[10px] text-text-muted hidden sm:block">Ảnh · PDF · PPTX · DOCX → Text · Word</p>
          </div>
        </div>

        {/* View mode toggle (only when 2+ files) */}
        {files.length > 1 && (
          <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-border shrink-0">
            {["single", "batch"].map(mode => (
              <button key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  viewMode === mode
                    ? "bg-surface text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                )}
              >
                {mode === "single" ? "Đơn lẻ" : "Gộp"}
              </button>
            ))}
          </div>
        )}

        {/* Model Selection & History */}
        <div className="flex items-center gap-2 shrink-0">
          {availableModels.length > 0 && (
            <div ref={modelDropRef} className="relative shrink-0">
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
                {loadingModels ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin text-text-muted">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[16px] text-brand-500">
                    smart_toy
                  </span>
                )}
                <span className="text-[13px] font-medium max-w-[120px] sm:max-w-[160px] truncate">
                  {loadingModels
                    ? "Loading..."
                    : activeModel
                      ? activeModel.id.split("/").pop()
                      : "Select model"}
                </span>
                {activeModel && (
                  <span className="text-[11px] text-text-subtle truncate hidden sm:inline max-w-[80px]">
                    {activeModel.owned_by || activeModel.id.split("/")[0]}
                  </span>
                )}
                <span className="material-symbols-outlined text-[16px] text-text-subtle">
                  expand_more
                </span>
              </button>

              {modelDropOpen && availableModels.length > 0 && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(300px,90vw)] bg-surface border border-border rounded-[12px] shadow-[var(--shadow-elevated)] overflow-hidden slide-in-top">
                  <div className="px-3 py-2 border-b border-border-subtle">
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Select Model
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto custom-scrollbar p-1.5">
                    {availableModels.map((m) => {
                      const active = m.id === selectedModel;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id);
                            setModelDropOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-all",
                            active
                              ? "bg-primary/8 text-primary"
                              : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                          )}
                        >
                          <span
                            className={cn(
                              "material-symbols-outlined text-[16px]",
                              active ? "fill-1 text-primary" : "text-text-subtle"
                            )}
                          >
                            psychology
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[13px] font-medium truncate", active ? "text-primary" : "")}>
                              {m.id.split("/").pop()}
                            </p>
                            <p className="text-[11px] text-text-subtle truncate">
                              {m.owned_by || m.id.split("/")[0]}
                            </p>
                          </div>
                          {active && (
                            <span className="material-symbols-outlined text-[16px] text-primary fill-1">
                              check_circle
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setHistoryOpen(v => !v);
              fetchHistory();
            }}
            className={cn(
              "flex items-center justify-center size-8 rounded-lg border transition-all shrink-0",
              historyOpen
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-surface-2 border-border text-text-muted hover:text-text-main hover:bg-surface-3"
            )}
            title="Lịch sử quét"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
          </button>
        </div>

        {/* Batch scan button */}
        {isBatchView && (
          <button
            onClick={scanBatch}
            disabled={batchScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-[var(--shadow-warm)] shrink-0"
          >
            {batchScanning
              ? <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
              : <span className="material-symbols-outlined text-[14px]">document_scanner</span>
            }
            <span className="hidden sm:inline">{batchScanning ? "Đang quét…" : "Quét & Gộp"}</span>
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className={cn(
          "flex flex-col border-r border-border bg-surface overflow-y-auto custom-scrollbar transition-transform duration-300 z-30",
          // Desktop: static
          "md:relative md:translate-x-0 md:flex md:w-52",
          // Mobile: overlay drawer
          "fixed inset-y-0 left-0 w-72 shadow-xl md:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>

          {/* Mobile header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border md:hidden">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Tài liệu</span>
            <button onClick={() => setSidebarOpen(false)}>
              <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Upload / drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "mx-2.5 mt-2.5 mb-2 rounded-xl border-2 border-dashed p-3 flex flex-col items-center gap-1 cursor-pointer transition-all",
              dragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/40 hover:bg-surface-2"
            )}
          >
            <input ref={fileRef} type="file" multiple={inputMultiple} accept={inputAccept} className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 24 }}>cloud_upload</span>
            <p className="text-[11px] text-text-muted text-center leading-snug">
              Kéo thả hoặc <span className="text-primary font-medium">chọn file</span>
            </p>
            <p className="text-[9px] text-text-subtle">
              {fileMode === "image"
                ? "Chỉ nhận thêm ảnh · tối đa 50MB"
                : fileMode === "doc"
                  ? "Chọn file mới để thay thế · tối đa 50MB"
                  : `JPG PNG PDF PPTX DOCX · ${MAX_MB}MB`}
            </p>
          </div>

          {/* Batch filter option */}
          {hasFiles && (
            <label className="mx-2.5 mb-2 px-2.5 py-2 rounded-lg bg-surface-2 border border-border flex items-center gap-2 cursor-pointer">
              <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 14 }}>filter_alt</span>
              <input type="checkbox" checked={filterMode} onChange={e => { setFilterMode(e.target.checked); setMergedResult(""); }}
                className="accent-primary w-3 h-3" />
              <span className="text-[11px] text-text-muted flex-1">Lọc ký tự thừa</span>
            </label>
          )}

          {hasFiles && <div className="mx-3 border-t border-border mb-1" />}

          {/* ── File list ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-0.5 px-1.5 pb-3 flex-1">
            {files.map((f, i) => {
              const m = fmeta(f.name);
              const isActive = i === activeIdx && !isBatchView;
              const done = !!results[f.name];
              const sc = scanning[f.name];
              const err = errors[f.name];
              return (
                <div key={f.name + i}
                  onClick={() => { setActiveIdx(i); setViewMode("single"); setSidebarOpen(false); }}
                  className={cn(
                    "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer border transition-all",
                    isActive ? "bg-primary/10 border-primary/20" : "border-transparent hover:bg-surface-2",
                    err && !isActive && "bg-red-500/5"
                  )}
                >
                  {/* Order number */}
                  <span className="text-[10px] font-bold text-text-subtle w-4 text-right shrink-0">{i + 1}</span>

                  {/* File type icon */}
                  <span className={cn("material-symbols-outlined shrink-0", m.color)} style={{ fontSize: 16 }}>
                    {m.icon}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-text-main truncate">{f.name}</p>
                    <p className="text-[10px]">
                      {sc  ? <span className="text-primary font-medium text-[10px]">{progress[f.name] || 0}%{progressMsg[f.name] ? ` · ${progressMsg[f.name]}` : ""}</span>
                           : done ? <span className="text-success flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 10 }}>check_circle</span>OK</span>
                           : err ? <span className="text-danger">Lỗi</span>
                           : <span className="text-text-muted">{fmtSize(f.size)}</span>}
                    </p>
                  </div>

                  {/* Reorder up/down */}
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={e => { e.stopPropagation(); moveFile(i, -1); }} disabled={i === 0}
                      className="text-text-muted hover:text-primary disabled:opacity-20 p-0.5 flex">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>keyboard_arrow_up</span>
                    </button>
                    <button onClick={e => { e.stopPropagation(); moveFile(i, 1); }} disabled={i === files.length - 1}
                      className="text-text-muted hover:text-primary disabled:opacity-20 p-0.5 flex">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>keyboard_arrow_down</span>
                    </button>
                  </div>

                  {/* Remove */}
                  <button onClick={e => { e.stopPropagation(); removeFile(i); }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all flex">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main content area ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">

          {/* Empty state */}
          {!hasFiles && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="size-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
                <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 28 }}>document_scanner</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-main">Chưa có tài liệu nào</h2>
                <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">
                  Tải lên ảnh chụp, PDF, PPTX hoặc scan để trích xuất văn bản bằng AI.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  { icon: "image",           label: "Ảnh / Scan", cls: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
                  { icon: "picture_as_pdf",  label: "PDF",        cls: "text-red-500 bg-red-500/10 border-red-500/20" },
                  { icon: "slideshow",       label: "PPTX",       cls: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
                  { icon: "description",     label: "DOCX",       cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
                ].map(t => (
                  <span key={t.label} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border", t.cls)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{t.icon}</span>
                    {t.label}
                  </span>
                ))}
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-[var(--shadow-warm)]">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
                Chọn tài liệu
              </button>
            </div>
          )}

          {/* ── BATCH VIEW ──────────────────────────────────────────────────── */}
          {hasFiles && isBatchView && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Thumbnail strip */}
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider shrink-0">
                  {files.length} tài liệu
                </span>
                <div className="flex gap-1.5 overflow-x-auto">
                  {files.map((f, i) => {
                    const m = fmeta(f.name);
                    const done = !!results[f.name];
                    const sc = scanning[f.name];
                    return (
                      <div key={f.name + i}
                        onClick={() => { setViewMode("single"); setActiveIdx(i); }}
                        className={cn(
                          "shrink-0 flex flex-col items-center gap-0.5 p-1.5 rounded-lg border cursor-pointer w-14 text-center transition-all",
                          "bg-surface border-border hover:border-primary/30",
                          done && "border-success/40 bg-success/5",
                          sc && "border-primary/40 bg-primary/5"
                        )}>
                        {previewUrls[f.name]
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={previewUrls[f.name]} alt={f.name} className="w-9 h-9 object-cover rounded border border-border" />
                          : <span className={cn("material-symbols-outlined", m.color)} style={{ fontSize: 20 }}>{m.icon}</span>
                        }
                        <span className="text-[9px] text-text-muted truncate w-full text-center">{i+1}. {baseName(f.name)}</span>
                        {done && <span className="material-symbols-outlined text-success" style={{ fontSize: 10 }}>check_circle</span>}
                        {sc   && <span className="text-[9px] text-primary">{progress[f.name] || 0}%</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Merged result panel */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-2">
                  <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 14 }}>
                    {isEditing ? "edit_note" : "merge"}
                  </span>
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex-1">
                    {isEditing ? "Chỉnh sửa" : "Văn bản gộp"}
                    {filterMode && mergedResult && !isEditing &&
                      <span className="ml-2 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Đã lọc</span>}
                  </span>
                  {mergedResult && (
                    <ResultToolbar
                      isEditing={isEditing}
                      onToggleEdit={toggleEdit}
                      onTxt={() => dlTxt(displayContent, `merged_${Date.now()}.txt`)}
                      onDocx={() => dlDocx(displayContent, `merged_${Date.now()}.docx`)}
                    />
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  {mergedResult && isEditing ? (
                    <textarea ref={textaRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                      className="w-full min-h-full p-4 bg-transparent text-sm text-text-main font-mono leading-relaxed resize-none outline-none" spellCheck={false} />
                  ) : mergedResult ? (
                    <MarkdownView content={mergedResult} />
                  ) : batchScanning ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                      <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
                      <div>
                        <p className="text-sm font-semibold text-text-main">Đang quét & gộp…</p>
                        {(() => {
                          const curr = Object.entries(scanning).find(([, v]) => v)?.[0];
                          if (!curr) return <p className="text-xs text-text-muted mt-1">Đang xử lý…</p>;
                          const pct = progress[curr] || 0;
                          const msg = progressMsg[curr];
                          return (
                            <p className="text-xs text-text-muted mt-1 leading-relaxed">
                              Đang quét: <span className="font-semibold text-text-main">{curr}</span>
                              <br />
                              {pct}% {msg ? `· ${msg}` : ""}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                      <span className="material-symbols-outlined text-text-subtle" style={{ fontSize: 36, opacity: 0.3 }}>merge</span>
                      <div>
                        <p className="text-sm font-medium text-text-muted">Chưa có kết quả gộp</p>
                        <p className="text-xs text-text-subtle mt-1">
                          Nhấn <span className="font-semibold text-primary">Quét & Gộp</span> để quét tất cả và ghép thành 1 văn bản
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SINGLE FILE VIEW ─────────────────────────────────────────────── */}
          {hasFiles && !isBatchView && (
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

              {/* Left panel: original file preview */}
              <div className="flex flex-col border-b md:border-b-0 md:border-r border-border md:flex-1 min-w-0 h-44 md:h-auto">
                {/* Header */}
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-2">
                  <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 14 }}>upload_file</span>
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex-1">Tài liệu gốc</span>
                  {active && (
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", fmeta(active.name).color, fmeta(active.name).bg, fmeta(active.name).border)}>
                      {ext(active.name).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Body */}
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar flex flex-col">
                  {(() => {
                    if (!active) return null;
                    const pd = previewData[activeKey];

                    // ── Supabase Mock File Download States ───────────────────
                    if (active.isMock) {
                      if (downloadError[activeKey]) {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <span className="material-symbols-outlined text-danger" style={{ fontSize: 28 }}>cloud_off</span>
                            <p className="text-xs text-text-muted">Không thể tải tài liệu từ Supabase Storage</p>
                            <p className="text-[10px] text-text-subtle max-w-[200px] truncate">{downloadError[activeKey]}</p>
                            <button
                              onClick={() => {
                                setDownloadError(prev => ({ ...prev, [activeKey]: null }));
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[11px] font-semibold text-text-muted hover:text-text-main"
                            >
                              Thử lại
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                          <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 28 }}>cloud_download</span>
                          <p className="text-xs text-text-muted">Đang tải tài liệu từ Supabase Storage…</p>
                        </div>
                      );
                    }

                    // ── Images ──────────────────────────────────────────────
                    if (isImg(active.name) && previewUrl) return (
                      <div className="flex-1 flex items-start justify-center p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt={active.name} className="max-w-full max-h-full rounded-lg border border-border object-contain shadow-[var(--shadow-soft)]" />
                      </div>
                    );

                    // ── Preview loading ──────────────────────────────────────
                    if (pd?.loading) return (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 28 }}>progress_activity</span>
                        <p className="text-xs text-text-muted">Đang tải xem trước…</p>
                      </div>
                    );

                    // ── Preview error ────────────────────────────────────────
                    if (pd?.error) return (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
                        <span className="material-symbols-outlined text-danger" style={{ fontSize: 24 }}>error_outline</span>
                        <p className="text-xs text-text-muted">{pd.error}</p>
                      </div>
                    );

                    // ── PDF: render pages ────────────────────────────────────
                    if (pd?.type === "pdf") return (
                      <div className="flex-1 flex flex-col gap-2 p-3">
                        {pd.total > pd.pages.length && (
                          <p className="text-[10px] text-text-muted text-center shrink-0">
                            Hiển thị {pd.pages.length}/{pd.total} trang
                          </p>
                        )}
                        {pd.pages.map((src, i) => (
                          <div key={i} className="shrink-0">
                            <p className="text-[9px] text-text-subtle mb-1">Trang {i + 1}</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`Trang ${i+1}`} className="w-full rounded border border-border shadow-[var(--shadow-soft)]" />
                          </div>
                        ))}
                      </div>
                    );

                    // ── PPTX: render slides as cards ─────────────────────────
                    if (pd?.type === "pptx") return (
                      <div className="flex-1 flex flex-col gap-2 p-3">
                        <p className="text-[10px] text-text-muted shrink-0">{pd.slides.length} slide</p>
                        {pd.slides.map((text, i) => (
                          <div key={i} className="shrink-0 rounded-lg border border-border bg-surface-2 p-3">
                            <p className="text-[9px] font-bold text-primary mb-1 uppercase tracking-wider">Slide {i + 1}</p>
                            <p className="text-xs text-text-main leading-relaxed">{text || <span className="text-text-subtle italic">Không có văn bản</span>}</p>
                          </div>
                        ))}
                      </div>
                    );

                    // ── DOCX: render paragraphs ───────────────────────────────
                    if (pd?.type === "docx") return (
                      <div className="flex-1 p-4 space-y-1">
                        {pd.paragraphs.map((p, i) => (
                          <p key={i} className="text-xs text-text-main leading-relaxed">{p}</p>
                        ))}
                        {!pd.paragraphs.length && <p className="text-xs text-text-muted italic">Không đọc được nội dung</p>}
                      </div>
                    );

                    // ── Fallback: icon + name ─────────────────────────────────
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className={cn("size-14 rounded-xl border-2 flex items-center justify-center", fmeta(active.name).bg, fmeta(active.name).border)}>
                          <span className={cn("material-symbols-outlined", fmeta(active.name).color)} style={{ fontSize: 32 }}>{fmeta(active.name).icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-text-main break-all">{active.name}</p>
                        <p className="text-xs text-text-muted">{fmtSize(active.size)}</p>
                      </div>
                    );
                  })()}
                  {active && (
                    <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-t border-border bg-surface-2">
                      <span className={cn("material-symbols-outlined", fmeta(active.name).color)} style={{ fontSize: 13 }}>{fmeta(active.name).icon}</span>
                      <span className="flex-1 text-[10px] text-text-muted truncate">{active.name}</span>
                      <span className="text-[10px] text-text-subtle shrink-0">{fmtSize(active.size)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center: scan button */}
              <div className="shrink-0 flex md:flex-col flex-row items-center justify-center gap-2 bg-surface border-b md:border-b-0 md:border-r border-border py-2 md:py-4 px-4 md:px-0 md:w-16">
                <div className="hidden md:block flex-1 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                <button
                  onClick={() => active && scanSingle(active)}
                  disabled={isScanning}
                  className={cn(
                    "flex md:flex-col items-center justify-center gap-1 md:size-14 px-4 md:px-0 py-2 md:py-0 rounded-xl font-bold text-[11px] transition-all shadow-md border",
                    isScanning
                      ? "bg-primary/10 text-primary border-primary/30 cursor-not-allowed"
                      : "bg-primary text-white border-primary hover:bg-primary-hover hover:shadow-[var(--shadow-warm)] active:scale-95"
                  )}>
                  {isScanning
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span><span>{activeProg}%</span></>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>document_scanner</span><span>Quét</span></>
                  }
                </button>
                {isScanning && (
                  <div className="w-8 h-1 rounded-full bg-border overflow-hidden hidden md:block">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${activeProg}%` }} />
                  </div>
                )}
                <div className="hidden md:block flex-1 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
              </div>

              {/* Right panel: result */}
              <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ minHeight: "200px" }}>
                {/* Header */}
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-2">
                  <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 14 }}>
                    {isEditing ? "edit_note" : "text_snippet"}
                  </span>
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex-1">
                    {isEditing ? "Chỉnh sửa" : "Kết quả"}
                  </span>
                  {activeResult && (
                    <ResultToolbar
                      isEditing={isEditing}
                      onToggleEdit={toggleEdit}
                      onTxt={() => dlTxt(displayContent, `${baseName(active?.name)}.txt`)}
                      onDocx={() => dlDocx(displayContent, `${baseName(active?.name)}.docx`)}
                    />
                  )}
                </div>
                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  {activeResult && isEditing ? (
                    <textarea ref={textaRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                      className="w-full min-h-full p-4 bg-transparent text-sm text-text-main font-mono leading-relaxed resize-none outline-none" spellCheck={false} />
                  ) : activeResult ? (
                    <MarkdownView content={activeResult} />
                  ) : activeError ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                      <span className="material-symbols-outlined text-danger" style={{ fontSize: 36 }}>error_outline</span>
                      <div>
                        <p className="text-sm font-semibold text-text-main">Lỗi quét</p>
                        <p className="text-xs text-text-muted mt-1 max-w-xs">{activeError}</p>
                      </div>
                      <button onClick={() => active && scanSingle(active)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/20 text-xs font-semibold hover:bg-danger/20">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>Thử lại
                      </button>
                    </div>
                  ) : isScanning ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                      <div className="relative size-12">
                        <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 24 }}>progress_activity</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-main">
                          {progressMsg[activeKey] ? `Đang quét ${activeProg}% - ${progressMsg[activeKey]}` : `Đang phân tích ${activeProg}%…`}
                        </p>
                      </div>
                      <div className="w-32 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${activeProg}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                      <span className="material-symbols-outlined text-text-subtle" style={{ fontSize: 32, opacity: 0.3 }}>text_snippet</span>
                      <div>
                        <p className="text-sm font-medium text-text-muted">Chưa có nội dung</p>
                        <p className="text-xs text-text-subtle mt-1">Nhấn <span className="font-semibold text-primary">Quét</span> để bắt đầu</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>{/* end main content */}
      </div>{/* end body */}

      {/* ── HISTORY DRAWER ─────────────────────────────────────────────────── */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setHistoryOpen(false)}
          />
          
          {/* Drawer body */}
          <div className="relative w-full max-w-md h-full bg-surface/90 backdrop-blur-md border-l border-border shadow-2xl flex flex-col z-10 transition-transform duration-300 slide-in-right">
            {/* Drawer Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                <h2 className="text-sm font-semibold text-text-main">Lịch sử quét tài liệu</h2>
              </div>
              
              <div className="flex items-center gap-1.5">
                {history.length > 0 && (
                  <button 
                    onClick={clearAllHistory}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-danger hover:bg-danger/10 transition-colors border border-transparent hover:border-danger/10"
                    title="Xóa toàn bộ lịch sử"
                  >
                    <span className="material-symbols-outlined text-[13px]">delete_sweep</span>
                    <span>Xóa tất cả</span>
                  </button>
                )}
                <button 
                  onClick={() => setHistoryOpen(false)}
                  className="flex items-center justify-center size-8 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
            
            {/* Drawer List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2.5 p-6 text-center text-text-muted">
                  <span className="material-symbols-outlined text-[36px] opacity-30">history</span>
                  <div>
                    <p className="text-xs font-medium">Chưa có lịch sử quét</p>
                    <p className="text-[10px] text-text-subtle mt-0.5">Các kết quả quét thành công sẽ được tự động lưu lại ở đây.</p>
                  </div>
                </div>
              ) : (
                history.map((item) => {
                  const isBatch = item.fileType === "batch";
                  const m = isBatch 
                    ? { icon: "layers", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" } 
                    : fmeta(item.filename);
                  const date = new Date(item.createdAt).toLocaleString("vi-VN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div 
                      key={item.id}
                      onClick={() => restoreHistoryItem(item)}
                      className="group relative flex items-start gap-3 p-3 rounded-xl border border-border bg-surface-2 hover:bg-primary/5 hover:border-primary/20 cursor-pointer transition-all shadow-[var(--shadow-soft)]"
                    >
                      {/* File type icon */}
                      <span className={cn("material-symbols-outlined shrink-0 mt-0.5", m.color)} style={{ fontSize: 18 }}>
                        {m.icon}
                      </span>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-semibold text-text-main truncate group-hover:text-primary transition-colors" title={item.filename}>
                          {item.filename}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[9px] text-text-subtle">
                          <span className="bg-surface border border-border rounded px-1 text-text-muted">{item.model}</span>
                          <span>{date}</span>
                        </div>
                        {item.results && (
                          <p className="text-[10px] text-text-muted line-clamp-2 mt-1.5 leading-relaxed bg-surface/50 p-1.5 rounded border border-border/50">
                            {item.results.slice(0, 100)}...
                          </p>
                        )}
                      </div>
                      
                      {/* Delete button */}
                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 flex items-center justify-center size-6 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                        title="Xóa"
                      >
                        <span className="material-symbols-outlined text-[13px]">delete</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
