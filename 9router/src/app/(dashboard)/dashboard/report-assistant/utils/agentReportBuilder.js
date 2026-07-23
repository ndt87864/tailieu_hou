import { prepareReportContent } from "./reportFormatter";

function isB49InternshipOpeningSection(section) {
  const normTitle = String(section?.title || "").toLowerCase();
  return normTitle.includes("ba49") || normTitle.includes("b49") || normTitle.includes("kiến tập");
}

function stripB49OpeningPreamble(text) {
  if (!text) return "";
  return text.replace(/^#+\s*(?:LỜI MỞ ĐẦU|MỞ ĐẦU|NHẬN XÉT KIẾN TẬP|XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN)[\s\S]*?(\n|$)/i, "").trim();
}

function normalizeDisplayLineForDedup(line) {
  if (!line) return "";
  return String(line)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldExcludeReferences(title) {
  const normTitle = String(title || "").toLowerCase();
  return normTitle.includes("ba49") || normTitle.includes("b49") || normTitle.includes("kiến tập");
}

export function buildAgentReportContent(state) {
  const sections = state?.sections_progress || [];
  if (!sections.length) return "";

  const hasInternshipReport = sections.some((s) => s?.reportContext?.internshipReport);
  const hasCareerReport = sections.some((s) => s?.reportContext?.careerOrientationReport);
  
  const reportBody = sections
    .filter((section) => String(section?.content || "").trim() || isB49InternshipOpeningSection(section) || section?.status === "stream_drafting" || section?.status === "drafting")
    .map((section) => {
      let rawContent = String(section.content || "").trim();
      if ((section?.status === "stream_drafting" || section?.status === "drafting") && rawContent) {
        rawContent = `${rawContent} ▌`;
      }
      const content = isB49InternshipOpeningSection(section) ? stripB49OpeningPreamble(rawContent) : rawContent;
      const firstLine = content.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
      const fNorm = normalizeDisplayLineForDedup(firstLine);
      const sNorm = normalizeDisplayLineForDedup(section.title);
      const cleanContentForMatch = String(content)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      const hasMotto = cleanContentForMatch.includes("cong hoa xa hoi") || 
                       cleanContentForMatch.includes("doc lap - tu do - hanh phuc") ||
                       cleanContentForMatch.includes("doc lap tu do hanh phuc");
      if (hasMotto || sNorm === "nhan xet kien tap" || sNorm === "nhan xet kien tap cua co quan" || sNorm === "xac nhan cua can bo huong dan" || sNorm === "nhan xet cua can bo huong dan" || sNorm === "xac nhan cua don vi tiep nhan kien tap") {
        return content;
      }
      let sameTitle = false;
      if (fNorm) {
        if (fNorm === sNorm || (fNorm.length >= 4 && (sNorm.includes(fNorm) || fNorm.includes(sNorm)))) {
          sameTitle = true;
        } else if (sNorm.includes("ket luan") && fNorm.includes("ket luan")) {
          sameTitle = true;
        } else if (sNorm.includes("tai lieu tham khao") && fNorm.includes("tai lieu tham khao")) {
          sameTitle = true;
        } else if (sNorm.includes("mo dau") && fNorm.includes("mo dau")) {
          sameTitle = true;
        }
      }
      if (sameTitle) {
        const lines = content.split(/\r?\n/);
        const firstIdx = lines.findIndex((l) => l.trim());
        if (firstIdx >= 0 && !lines[firstIdx].trim().startsWith("#")) {
          lines[firstIdx] = `# ${lines[firstIdx].trim()}`;
          return lines.join("\n");
        }
        return content;
      }
      return `# ${section.title}\n\n${content}`;
    })
    .join("\n\n[PAGE_BREAK]\n\n");

  const webSources = [];
  const seen = new Set();
  for (const section of sections) {
    for (const source of section?.web_sources || []) {
      const url = String(source?.url || "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      webSources.push({ title: String(source?.title || url).trim(), url });
    }
  }

  let finalBody = reportBody;
  if (hasInternshipReport && !/^\s*#\s*l[oơ]i m[oơ] d[aâ]u\b/i.test(reportBody)) {
    finalBody = `# LỜI MỞ ĐẦU\n\n[PAGE_BREAK]\n\n${reportBody}`;
  } else if (hasCareerReport && !/^\s*#\s*(?:i\b|i\.\s*ph[aâ]n m[oơ] d[aâ]u)/i.test(reportBody)) {
    finalBody = `# I. PHẦN MỞ ĐẦU\n\n[PAGE_BREAK]\n\n${reportBody}`;
  }

  const reportTitle = sections[0]?.reportContext?.reportTitle || state?.title || "";
  const isNoRefReport = hasCareerReport || hasInternshipReport || shouldExcludeReferences(reportTitle);
  const rawResult = isNoRefReport || !webSources.length
    ? prepareReportContent(finalBody, reportTitle)
    : prepareReportContent(finalBody ? `${finalBody}\n\n${references}` : references, reportTitle);

  return (rawResult || "").replace(/[\u2013\u2014–—]/g, "-");
}
