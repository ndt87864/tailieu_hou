/**
 * Lazy load JSZip library from CDN.
 */
async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    const script = document.createElement("script");
    script.src = JSZIP_CDN;
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("Không thể tải JSZip"));
    document.head.appendChild(script);
  });
}

/**
 * Parse Word Document (.docx) to plain text.
 * Returns: { text: string, pageCount: number }
 */
export async function parseDocxText(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const doc = zip.file("word/document.xml");
  if (!doc) return { text: "", pageCount: 1 };
  const xml = await doc.async("text");
  const parser = new DOMParser();
  const parsed = parser.parseFromString(xml, "application/xml");
  const paragraphs = Array.from(parsed.getElementsByTagName("w:p"))
    .map((p) =>
      Array.from(p.getElementsByTagName("w:t"))
        .map((t) => t.textContent || "")
        .join("")
        .trim(),
    )
    .filter(Boolean);
  return { text: paragraphs.join("\n"), pageCount: 1 };
}
