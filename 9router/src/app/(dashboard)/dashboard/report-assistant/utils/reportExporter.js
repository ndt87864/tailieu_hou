import {
  prepareReportContent,
  injectSectionPageBreaks,
  isMajorSectionHeadingLine,
  isHeadingOnlyReportBlock,
  isReferenceHeadingLine
} from "./reportFormatter.js";
import { renderMarkdownAndMath } from "./markdownRenderer.js";
import { isSignatureTable } from "./ooxmlConverter.js";

const A4_PAGE_WIDTH = "8.27in";
const A4_PAGE_HEIGHT = "11.69in";
const A4_MARGIN_TOP = "2.5cm";
const A4_MARGIN_RIGHT = "2cm";
const A4_MARGIN_BOTTOM = "2.5cm";
const A4_MARGIN_LEFT = "3cm";

function textValue(val) {
  if (typeof val === "string") return val;
  return String(val || "");
}

// Copy report content as rich HTML (for paste into Word/Google Docs with formatting)
export async function copyReportRichText(rawContent, title = "") {
  const preparedContent = prepareReportContent(rawContent, title);
  // Strip HTML tags for clean plain text version
  const plainText = preparedContent
    .replace(/\[PAGE_BREAK\]/g, "\n\n")
    .replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();

  const formattedHtml = renderMarkdownAndMath(preparedContent).replace(
    /\[PAGE_BREAK\]/g,
    '<div style="page-break-after: always; break-after: page;"></div>',
  );

  // Build HTML version
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{size:${A4_PAGE_WIDTH} ${A4_PAGE_HEIGHT};margin:${A4_MARGIN_TOP} ${A4_MARGIN_RIGHT} ${A4_MARGIN_BOTTOM} ${A4_MARGIN_LEFT};}
    html,body{margin:0;padding:0;}
    body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.5;color:#000;}
    h1{font-size:1.75em;font-weight:bold;text-align:center;text-transform:uppercase;margin:1.2em 0 0.6em;}
    h2{font-size:1.4em;font-weight:bold;margin:1em 0 0.5em;}
    h3{font-size:1.2em;font-weight:bold;margin:0.9em 0 0.4em;}
    body > p{text-align:justify;text-indent:1cm;margin:0.6em 0;}
    body > p:has(> strong:only-child){text-indent:0;}
    li p{text-indent:0;margin:0;}
    table:not(.borderless){border-collapse:collapse;width:100%;margin:1em 0;}
    table:not(.borderless) th, table:not(.borderless) td{border:1px solid #000;padding:6px 10px;font-size:14px;}
    table.borderless{border-collapse:collapse;width:100%;margin:1em 0;border:none;}
    table.borderless th, table.borderless td{border:none;padding:6px 10px;font-size:14px;background:transparent !important;background-color:transparent !important;}
    table.borderless th{background:transparent !important;background-color:transparent !important;}
    th{background:#f2f2f2;font-weight:bold;text-align:center;}
    hr{border:none;border-top:1px solid #000;margin:1em 0;}
    ul{padding-left:2em;margin:0.5em 0;}ol{padding-left:2em;margin:0.5em 0;}
    em{font-style:italic;}strong{font-weight:bold;}
  </style></head><body>${formattedHtml.replace(/<table>/g, (match, offset) => {
    const tableEnd = formattedHtml.indexOf("</table>", offset);
    const tableContent = formattedHtml.slice(offset, tableEnd);
    if (isSignatureTable(tableContent)) {
      return '<table class="borderless">';
    }
    return '<table>';
  })}</body></html>`;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([htmlContent], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    // Fallback: copy clean plain text
    await navigator.clipboard.writeText(plainText);
    return false;
  }
}

export function printReportDoc(title, htmlContent) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(
    "<html>" +
    "<head>" +
    "<title>" +
    title +
    "</title>" +
    "<style>" +
    `@page { size: ${A4_PAGE_WIDTH} ${A4_PAGE_HEIGHT}; margin: ${A4_MARGIN_TOP} ${A4_MARGIN_RIGHT} ${A4_MARGIN_BOTTOM} ${A4_MARGIN_LEFT}; }` +
    "html, body { margin: 0; padding: 0; }" +
    "body {" +
    "font-family: 'Times New Roman', Times, serif;" +
    "font-size: 13pt;" +
    "line-height: 1.5;" +
    "color: #000;" +
    "}" +
    "h1 { text-align: left; text-transform: uppercase; font-size: 1.5em; margin-bottom: 1.2em; }" +
    "h2, h3, h4 { font-size: 13pt; line-height: 1.5; margin-top: 1.2em; margin-bottom: 0.6em; }" +
    "h2, h4 { font-weight: bold; }" +
    "h3 { font-weight: normal; font-style: italic; }" +
    ".report-view > p { text-align: justify; text-indent: 1cm; margin: 0.8em 0; }" +
    ".report-view > p:has(> strong:only-child) { text-indent: 0; }" +
    "li p { text-indent: 0; margin: 0; }" +
    "table:not(.borderless) { width: 100%; border-collapse: collapse; margin: 1.2em 0; }" +
    "table:not(.borderless) th, table:not(.borderless) td { border: 1px solid #000; padding: 8px 12px; }" +
    "table.borderless { width: 100%; border-collapse: collapse; margin: 1.2em 0; border: none; }" +
    "table.borderless th, table.borderless td { border: none; padding: 8px 12px; background: transparent !important; background-color: transparent !important; }" +
    "table.borderless th { background: transparent !important; background-color: transparent !important; }" +
    "th { font-weight: bold; background-color: #f2f2f2; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="report-view">' +
    htmlContent.replace(/<table>/g, (match, offset) => {
      const tableEnd = htmlContent.indexOf("</table>", offset);
      const tableContent = htmlContent.slice(offset, tableEnd);
      if (isSignatureTable(tableContent)) {
        return '<table class="borderless">';
      }
      return '<table>';
    }) +
    "</div>" +
    "</body>" +
    "</html>",
  );
  printWindow.document.close();
  printWindow.print();
}

export function handlePrintReport(title, content) {
  const htmlContent = renderMarkdownAndMath(prepareReportContent(content, title));
  printReportDoc(title, htmlContent);
}

export function paginateReportContent(content, charsPerPage = 5000) {
  const prepared = injectSectionPageBreaks(content);
  const manualSections = prepared.includes("[PAGE_BREAK]")
    ? prepared
      .split("[PAGE_BREAK]")
      .map((p) => p.trim())
      .filter(Boolean)
    : [prepared.trim()].filter(Boolean);

  const pages = [];
  for (const section of manualSections) {
    const rawBlocks = section
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const blocks = [];
    for (let idx = 0; idx < rawBlocks.length; idx += 1) {
      const block = rawBlocks[idx];
      const firstLine =
        block
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean) || "";
      if (isReferenceHeadingLine(firstLine) && rawBlocks[idx + 1]) {
        blocks.push(`${block}\n${rawBlocks[idx + 1]}`);
        idx += 1;
      } else {
        blocks.push(block);
      }
    }
    let page = "";

    for (const block of blocks) {
      const chapterStart = isMajorSectionHeadingLine(
        textValue(block)
          .split(/\r?\n/)
          .find((line) => line.trim()) || "",
      );
      if (page && chapterStart) {
        pages.push(page.trim());
        page = block;
        continue;
      }

      const next = page ? `${page}\n\n${block}` : block;
      if (page && next.length > charsPerPage) {
        if (isHeadingOnlyReportBlock(page)) {
          page = next;
        } else {
          pages.push(page.trim());
          page = block;
        }
      } else {
        page = next;
      }
    }

    if (page.trim()) pages.push(page.trim());
  }

  return pages.length > 0 ? pages : [""];
}
