const DOCX_CENTER = "\u0002CENTER\u0002";

export function escXml(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function toRuns(text) {
  if (!text) return "";
  const parts = text.split(
    /(\*\*\*(?:[^*]|\*(?!\*\*))+\*\*\*|\*\*(?:[^*]|\*(?!\*))+\*\*|\*(?:[^*\n]+)\*)/g,
  );
  return parts
    .map((p) => {
      if (!p) return "";
      if (p.startsWith("***") && p.endsWith("***") && p.length > 6)
        return `<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t xml:space="preserve">${escXml(p.slice(3, -3))}</w:t></w:r>`;
      if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
        return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(p.slice(2, -2))}</w:t></w:r>`;
      if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
        return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escXml(p.slice(1, -1))}</w:t></w:r>`;
      return `<w:r><w:t xml:space="preserve">${escXml(p)}</w:t></w:r>`;
    })
    .join("");
}

export function isSignatureTable(tableTextContent) {
  const raw = String(tableTextContent || "").toLowerCase();
  const norm = raw
    .replace(/[\u00e0\u00e1\u1ea1\u1ea3\u00e3\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5]/g, "a")
    .replace(/[\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5]/g, "e")
    .replace(/[\u00ec\u00ed\u1ecb\u1ec9\u0129]/g, "i")
    .replace(/[\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1]/g, "o")
    .replace(/[\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef]/g, "u")
    .replace(/[\u1ef3\u00fd\u1ef5\u1ef7\u1ef9]/g, "y")
    .replace(/\u0111/g, "d");
  const hasSignAction = /(?:ky|ki)\s+ten|dong\s+dau|chu\s+(?:ky|ki)|ki\s+va\s+ghi\s+ro|ky\s+va\s+ghi\s+ro/.test(norm);
  const hasAuthRole = /xac\s+nhan|can\s+bo\s+huong\s+dan|nguoi\s+huong\s+dan|don\s+vi\s+kien\s+tap|cbhd|nguoi\s+xac\s+nhan|co\s+quan|giang\s+vien|can\s+bo|chuc\s+vu|co\s+quan\s+thuc\s+tap/.test(norm);
  return hasSignAction && hasAuthRole;
}

export function tableRowsToOoxml(rows) {
  if (!rows.length) return "";
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(9071 / colCount);
  const isBorderless = isSignatureTable(rows.flat().join(" "));

  const bdrVal = isBorderless ? "nil" : "single";
  const bdrColor = isBorderless ? "auto" : "000000";
  const bdrSz = isBorderless ? "0" : "4";
  const bdr = `w:val="${bdrVal}" w:sz="${bdrSz}" w:space="0" w:color="${bdrColor}"`;

  let xml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9071" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top ${bdr}/><w:left ${bdr}/><w:bottom ${bdr}/>
        <w:right ${bdr}/><w:insideH ${bdr}/><w:insideV ${bdr}/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>
        <w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>`;
  for (let c = 0; c < colCount; c++) {
    xml += `<w:gridCol w:w="${colWidth}"/>`;
  }
  xml += `</w:tblGrid>`;

  rows.forEach((row) => {
    xml += `<w:tr>`;
    for (let c = 0; c < colCount; c++) {
      const cellText = (row[c] || "").replace(/DOCXCELLBREAKTOKEN/g, "\n");
      xml += `<w:tc>
        <w:tcPr>
          <w:tcW w:w="${colWidth}" w:type="dxa"/>
          ${isBorderless ? '<w:vAlign w:val="top"/>' : '<w:vAlign w:val="center"/>'}
        </w:tcPr>`;
      const lines = cellText.split("\n");
      lines.forEach((lineText) => {
        const jcVal = isBorderless ? "left" : "center";
        xml += `<w:p><w:pPr>
          <w:jc w:val="${jcVal}"/>
          <w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>
        </w:pPr>${toRuns(lineText.trim())}</w:p>`;
      });
      xml += `</w:tc>`;
    }
    xml += `</w:tr>`;
  });
  xml += `</w:tbl>`;
  return xml;
}

export function generateCoverPageOoxmlFromLines(coverPart, logoActuallyExists = false) {
  let text = coverPart;
  text = text.replace(/\[LOGO_HOU\]/gi, "LOGOTOKENHOU");
  text = text.replace(/<img[^>]*logo-hou\.png[^>]*>/gi, "LOGOTOKENHOU");
  text = text.replace(/logo-hou\.png/gi, "LOGOTOKENHOU");
  text = text.replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "");
  text = text.replace(/[*#_`~]/g, "");

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let xml = "";
  const topLines = [];
  let hasLogo = false;
  const titleLines = [];
  const detailLines = [];
  const bottomLines = [];
  let state = "top";

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.includes("LOGOTOKENHOU")) {
      hasLogo = true;
      state = "title";
      continue;
    }
    const isDetailKeyword = /^(?:cán\s+bộ\s+hướng\s+dẫn|sinh\s+viên\s+thực\s+hiện|ngày\s+sinh|lớp|ngành\s+đào\s+tạo|thời\s+gian\s+thực\s+tập|mã\s+course\s+học|giảng\s+viên\s+hướng\s+dẫn|chức\s+vụ|mã\s+số\s+sinh\s+viên|mssv|họ\s+tên\s+sinh\s+viên|họ\s+tên\s+cán\s+bộ\s+hướng\s+dẫn)(?:\s|:|$)/i.test(line);
    const hasSeparator = line.includes(":") || line.includes("..");
    const isTitleOrHeader = /^(?:báo\s+cáo|học\s+phần|trường\s+đại\s+học|viện\s+đt|trung\s+tâm\s+đào\s+tạo|tại\s+đơn\s+vị)(?:\s|:|$)/i.test(line);

    if ((isDetailKeyword || hasSeparator) && !isTitleOrHeader) {
      if (state !== "top") {
        state = "details";
      }
    }
    if (idx >= lines.length - 2 && (/hà\s+nội/i.test(line) || /năm\s+202/i.test(line) || /^\d{4}$/.test(line))) {
      state = "bottom";
    }
    if (state === "top") {
      topLines.push(line);
    } else if (state === "title") {
      titleLines.push(line);
    } else if (state === "details") {
      detailLines.push(line);
    } else if (state === "bottom") {
      bottomLines.push(line);
    }
  }

  const isBa49 = text.includes("BÁO CÁO KIẾN TẬP THỰC TẾ") || text.includes("VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI");

  topLines.forEach((line, index) => {
    const sz = index === 0 ? "28" : "26";
    const underlineElement = (isBa49 && index === 1) ? '<w:u w:val="single"/>' : '';
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:rPr><w:b/>${underlineElement}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t>${escXml(line)}</w:t></w:r></w:p>`;
  });

  if (!isBa49) {
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="800"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>___________</w:t></w:r></w:p>`;
  } else {
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="400"/></w:pPr></w:p>`;
  }

  if (logoActuallyExists && hasLogo) {
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="800"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/wordprocessingml/2006/wordprocessingDrawing"><wp:extent cx="1560000" cy="1800000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="99" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1560000" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  } else {
    xml += `<w:p><w:pPr><w:spacing w:before="1200" w:after="1200"/></w:pPr></w:p>`;
  }

  titleLines.forEach((line, index) => {
    const isMainTitle = /báo\s+cáo/i.test(line);
    const sz = isMainTitle ? "36" : "28";
    const before = index === 0 ? "240" : "120";
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="${before}" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t>${escXml(line)}</w:t></w:r></w:p>`;
  });

  xml += `<w:p><w:pPr><w:spacing w:before="600" w:after="0"/></w:pPr></w:p>`;

  if (isBa49 && detailLines.length > 0) {
    const bdr = `w:val="single" w:sz="4" w:space="0" w:color="FFFFFF"`;
    xml += `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="7344" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top ${bdr}/><w:left ${bdr}/><w:bottom ${bdr}/>
          <w:right ${bdr}/><w:insideH ${bdr}/><w:insideV ${bdr}/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>`;

    detailLines.forEach(line => {
      const colonIdx = line.indexOf(":");
      let key = line;
      let val = "";
      if (colonIdx > 0) {
        key = line.slice(0, colonIdx + 1);
        val = line.slice(colonIdx + 1).trim();
      }
      xml += `<w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2570" w:type="dxa"/>
          </w:tcPr>
          <w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(key)}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="4774" w:type="dxa"/>
          </w:tcPr>
          <w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`;
    });
    xml += `</w:tbl>`;
  } else {
    const infoStyle = `<w:pPr><w:ind w:left="1440"/><w:spacing w:before="120" w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>`;
    detailLines.forEach(line => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx + 1);
        const val = line.slice(colonIdx + 1);
        xml += `<w:p>${infoStyle}<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(key)} </w:t></w:r><w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r></w:p>`;
      } else {
        xml += `<w:p>${infoStyle}<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(line)}</w:t></w:r></w:p>`;
      }
    });
  }

  const cleanBottomText = bottomLines.join(", ").replace(/HÀ\s+NỘI,\s*/gi, "").trim();
  let spacingXml = "";
  if (isBa49) {
    for (let p = 0; p < 7; p++) {
      spacingXml += `<w:p><w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr></w:p>`;
    }
  }
  const bottomBeforeSpacing = isBa49 ? "240" : "3800";
  xml += spacingXml;
  xml += `<w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="${bottomBeforeSpacing}" w:after="0"/>
      <w:sectPr>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1417" w:right="1134" w:bottom="1417" w:left="1701"/>
        <w:pgBorders w:offsetFrom="page">
          <w:top w:val="double" w:sz="12" w:space="24" w:color="000000"/>
          <w:left w:val="double" w:sz="12" w:space="24" w:color="000000"/>
          <w:bottom w:val="double" w:sz="12" w:space="24" w:color="000000"/>
          <w:right w:val="double" w:sz="12" w:space="24" w:color="000000"/>
        </w:pgBorders>
      </w:sectPr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:b/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
      </w:rPr>
      <w:t xml:space="preserve">${escXml(cleanBottomText ? cleanBottomText : "NĂM 2026")}</w:t>
    </w:r>
  </w:p>`;

  return xml;
}

export function mdToOoxml(rawContent, title = "", logoActuallyExists = false) {
  const isCoverPage = rawContent.includes("cover-page-container") ||
    (rawContent.includes("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") && rawContent.indexOf("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") < 1000);

  if (isCoverPage) {
    const parts = rawContent.split("[PAGE_BREAK]");
    const coverPart = parts[0];
    const remainingPart = parts.slice(1).join("[PAGE_BREAK]");

    const coverOoxml = generateCoverPageOoxmlFromLines(coverPart, logoActuallyExists);
    const remainingOoxml = mdToOoxml(remainingPart, title, logoActuallyExists);

    return coverOoxml + "\n" + remainingOoxml;
  }

  // Helper inside mdToOoxml
  const normalizeMarkdownTables = (contentStr) => {
    const lines = String(contentStr || "").split(/\r?\n/);
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
  };

  const preprocessForDocx = (contentStr) => {
    let text = normalizeMarkdownTables(contentStr);
    text = text.replace(/<center>([\s\S]*?)<\/center>/gi, (_, inner) =>
      inner
        .split("\n")
        .map((l) => {
          const t = l.trim();
          return t ? `${DOCX_CENTER}${t}` : "";
        })
        .join("\n"),
    );
    text = text.split("\n").map(line => {
      if (line.trim().startsWith("|")) {
        return line.replace(/<br\s*\/?>/gi, "DOCXCELLBREAKTOKEN");
      }
      return line.replace(/<br\s*\/?>/gi, "\n");
    }).join("\n");

    text = text.replace(/<hr\s*\/?>/gi, "\n");
    text = text.replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/\n+(?=\s*\[PAGE_BREAK\])/gi, "\n");
    text = text.replace(/(?<=\[PAGE_BREAK\])\s*\n+/gi, "\n");
    text = text.replace(/(\[PAGE_BREAK\](\s*\n)*\s*)+\[PAGE_BREAK\]/gi, "[PAGE_BREAK]");
    return text;
  };

  const content = preprocessForDocx(rawContent);
  const lines = content.split("\n");
  const ps = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "[LOGO_HOU]") {
      if (logoActuallyExists) {
        ps.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/wordprocessingml/2006/wordprocessingDrawing"><wp:extent cx="1560000" cy="1800000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="99" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1560000" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
        );
      } else {
        ps.push(`<w:p><w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr></w:p>`);
      }
      i++;
      continue;
    }
    if (!t) {
      ps.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);
      i++;
      continue;
    }
    if (t.includes("[PAGE_BREAK]")) {
      ps.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
      i++;
      while (i < lines.length && (
        !lines[i].trim() ||
        lines[i].trim().toUpperCase() === "[PAGE_BREAK]"
      )) i++;
      continue;
    }
    if (t.startsWith(DOCX_CENTER)) {
      const ct = t.slice(DOCX_CENTER.length).trim();
      const hm = ct.match(/^(#{1,6})\s+(.+)/);
      if (hm) {
        const lvl = Math.min(hm[1].length, 3);
        const style = ["Heading1", "Heading2", "Heading3"][lvl - 1];
        ps.push(
          `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:jc w:val="center"/><w:keepNext/></w:pPr>${toRuns(hm[2])}</w:p>`,
        );
      } else {
        ps.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>${toRuns(ct)}</w:p>`,
        );
      }
      i++;
      continue;
    }
    const hm = t.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const lvl = Math.min(hm[1].length, 3);
      const style = ["Heading1", "Heading2", "Heading3"][lvl - 1];
      ps.push(
        `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:keepNext/></w:pPr>${toRuns(hm[2])}</w:p>`,
      );
      i++;
      continue;
    }
    if (/^[-*]{3,}$/.test(t)) {
      i++;
      continue;
    }
    const boldOnly = t.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (boldOnly) {
      const isTableCaption = /^(?:Bảng|BẢNG)\s+\d+/i.test(boldOnly[1]);
      ps.push(
        `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:before="120" w:after="80" w:line="360" w:lineRule="auto"/></w:pPr>${isTableCaption ? "<w:r><w:tab/></w:r>" : ""
        }<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(boldOnly[1])}</w:t></w:r></w:p>`,
      );
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim();
        if (!/^[|:\s\-]+$/.test(row)) {
          tableRows.push(
            row
              .split("|")
              .slice(1, -1)
              .map((c) => c.trim()),
          );
        }
        i++;
      }
      if (tableRows.length) {
        ps.push(tableRowsToOoxml(tableRows));
        ps.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);
      }
      continue;
    }
    const ul = t.match(/^[-*•]\s+(.+)/);
    if (ul) {
      ps.push(
        `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="0"/></w:pPr>${toRuns(ul[1])}</w:p>`,
      );
      i++;
      continue;
    }
    const ol = t.match(/^(\d+)[.):]\s+(.+)/);
    if (ol) {
      ps.push(
        `<w:p><w:pPr><w:ind w:left="360"/><w:spacing w:before="60" w:after="60" w:line="276" w:lineRule="auto"/></w:pPr>${toRuns(ol[1] + ". " + ol[2])}</w:p>`,
      );
      i++;
      continue;
    }
    ps.push(
      `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:before="0" w:after="160" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:tab/></w:r>${toRuns(t)}</w:p>`,
    );
    i++;
  }
  return ps.join("\n");
}
