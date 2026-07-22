import { mdToOoxml } from "./ooxmlConverter.js";
import { prepareReportContentForDocx } from "./reportFormatter.js";

export async function loadJSZip() {
  if (typeof window !== "undefined" && window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error("Cannot load JSZip"));
    document.head.appendChild(s);
  });
}

export async function dlDocx(content, filename) {
  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const PKGREL = "http://schemas.openxmlformats.org/package/2006/relationships";
    const OFFREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    // [Content_Types].xml
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Default Extension="png"  ContentType="image/png"/>
  <Override PartName="/word/document.xml"  ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`,
    );

    // _rels/.rels
    zip.folder("_rels").file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );

    const word = zip.folder("word");
    const docxContent = prepareReportContentForDocx(content, filename);

    // word/_rels/document.xml.rels
    let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/styles"    Target="styles.xml"/>
  <Relationship Id="rId2" Type="${OFFREL}/numbering" Target="numbering.xml"/>
</Relationships>`;

    word.folder("_rels").file("document.xml.rels", relsXml);

    // word/document.xml
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const WP = "http://schemas.openxmlformats.org/wordprocessingml/2006/wordprocessingDrawing";
    const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
    const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

    word.file(
      "document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}">
  <w:body>
${mdToOoxml(docxContent, filename, false)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1134" w:bottom="1417" w:left="1701"/>
    </w:sectPr>
  </w:body>
</w:document>`,
    );

    // word/styles.xml
    word.file(
      "styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
    <w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="100" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:i/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`,
    );

    // word/numbering.xml (bullet + decimal)
    word.file(
      "numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">
    <w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
    <w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>
  </w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
    <w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
    <w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>
  </w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`,
    );

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: filename,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);

    try {
      const now = new Date();
      const dateKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
      const countKey = `report_download_count_${dateKey}`;
      const currentCount = parseInt(localStorage.getItem(countKey) || "1", 10);
      localStorage.setItem(countKey, String(currentCount + 1));
    } catch (e) {
      console.error("Failed to increment download count:", e);
    }

    return true;
  } catch (err) {
    console.error("docx generation failed:", err);
    return false;
  }
}
