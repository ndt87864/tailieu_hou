import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-toastify";

// Helper to group items by key function
export const groupBy = (items: any[], keyFn: (item: any) => string) => {
  const groups = new Map<string, any[]>();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });
  return groups;
};

const sanitizeSheetName = (name: string) => {
  if (!name) return "Sheet1";
  let sanitized = name.replace(/[\\/?*[\]:]/g, "").trim();
  if (sanitized.length > 31) sanitized = sanitized.substring(0, 31);
  return sanitized || "Sheet1";
};

const hexToRgb = (hex: string): string => {
  if (!hex || typeof hex !== "string") return "0, 0, 0";
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "0, 0, 0";
};

export const exportToExcel = (
  results: any[],
  studentData: any,
  rentedIds: (string | number)[],
  _subjectPriceMap: Record<string, number>,
  customData: any[] | null = null,
  customFileName: string | null = null,
  shouldGroup = false
) => {
  const exportResults = customData || results.filter((row) => rentedIds.includes(row.id));

  if (!exportResults || exportResults.length === 0) {
    toast.info("Vui lòng Đăng kí giải đề hoặc chọn dữ liệu hợp lệ trước khi xuất dữ liệu.");
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    if (shouldGroup && Array.isArray(exportResults)) {
      const groupedData = groupBy(exportResults, (item) => item.subject || "Chưa xác định");

      const sortedEntries = Array.from(groupedData.entries()).sort((a, b) => {
        const itemA = a[1][0];
        const itemB = b[1][0];

        const dateA = new Date(itemA.examDate || 0).getTime();
        const dateB = new Date(itemB.examDate || 0).getTime();
        if (dateA - dateB !== 0) return dateA - dateB;

        const roomA = (itemA.examRoom || "").toString();
        const roomB = (itemB.examRoom || "").toString();
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: "base" });
      });

      const usedSheetNames = new Set<string>();

      sortedEntries.forEach(([subject, items]) => {
        items.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "vi", { sensitivity: "base" }));

        let sheetName = sanitizeSheetName(subject);
        let counter = 1;
        const originalName = sheetName;
        while (usedSheetNames.has(sheetName)) {
          const suffix = ` (${counter})`;
          sheetName = originalName.substring(0, 31 - suffix.length) + suffix;
          counter++;
        }
        usedSheetNames.add(sheetName);

        const exportData = items.map((row, idx) => ({
          STT: idx + 1,
          "Mã SV": row.studentId || "-",
          "Họ Tên": row.fullName || "-",
          "Mã ngành": Array.isArray(row.majorCode) ? row.majorCode.join(", ") : row.majorCode || "-",
          "Ngày Thi": row.examDate ? new Date(row.examDate).toLocaleDateString("vi-VN") : "-",
          "Ca Thi": row.examSession || "-",
          "Giờ Thi": row.examTime || "-",
          Phòng: row.examRoom || "-",
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
    } else {
      const isAllStudents = !!customData;
      const exportData = exportResults.map((row, idx) => {
        const baseData: any = {
          STT: idx + 1,
        };

        if (isAllStudents) {
          baseData["Mã SV"] = row.studentId || "-";
          baseData["Họ Tên"] = row.fullName || "-";
          baseData["Mã ngành"] = Array.isArray(row.majorCode) ? row.majorCode.join(", ") : row.majorCode || "-";
        }

        return {
          ...baseData,
          "Môn Thi": row.subject || "-",
          "Ngày Thi": row.examDate ? new Date(row.examDate).toLocaleDateString("vi-VN") : "-",
          "Ca Thi": row.examSession || "-",
          "Giờ Thi": row.examTime || "-",
          Phòng: row.examRoom || "-",
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "LichThi");
    }

    const fileName = customFileName || `LichThi_${studentData?.studentId || "SV"}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Đã xuất danh sách Excel thành công!");
  } catch (error) {
    console.error("Excel export error:", error);
    toast.error("Lỗi khi xuất file Excel.");
  }
};

export const exportToPDF = (
  results: any[],
  studentData: any,
  rentedIds: (string | number)[],
  currentTheme: { primary: string; dark: string; light: string },
  customData: any[] | null = null,
  customFileName: string | null = null,
  shouldGroup = false,
  setLoadingState?: (loading: boolean) => void
) => {
  const exportResults = customData || results.filter((row) => rentedIds.includes(row.id));

  if (!exportResults || exportResults.length === 0) {
    toast.info("Vui lòng Đăng kí giải đề hoặc chọn dữ liệu hợp lệ trước khi xuất dữ liệu.");
    return;
  }

  if (setLoadingState) setLoadingState(true);

  try {
    const isAllStudents = !!customData;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const imageCache = new Map<string, { data: string; width: number; height: number }>();
    const renderTextToImage = (text: string, fontSize = 12, isBold = false, color = "#1e293b") => {
      const cacheKey = `${text}_${fontSize}_${isBold}_${color}`;
      if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)!;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const fontStr = `${isBold ? "bold " : ""}${fontSize * 4}px "Times New Roman", Times, serif`;
      ctx.font = fontStr;
      const metrics = ctx.measureText(text);

      canvas.width = metrics.width + 20;
      canvas.height = fontSize * 6;

      ctx.font = fontStr;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(text, 10, canvas.height / 2);

      const result = {
        data: canvas.toDataURL("image/png"),
        width: canvas.width / 4,
        height: canvas.height / 4,
      };
      imageCache.set(cacheKey, result);
      return result;
    };

    const primaryRgb = currentTheme.primary.startsWith("#")
      ? hexToRgb(currentTheme.primary).split(",").map(Number)
      : [17, 141, 5];

    const renderHeader = (_isFirstPage = true) => {
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.rect(0, 0, 297, 50, "F");

      const titleText = isAllStudents ? "DANH SÁCH THÍ SINH CÙNG PHÒNG" : "LỊCH THI SINH VIÊN";
      const titleImg = renderTextToImage(titleText, 32, true, "#FFFFFF");
      doc.addImage(titleImg.data, "PNG", (297 - titleImg.width * 0.3) / 2, 10, titleImg.width * 0.3, titleImg.height * 0.3);

      const subTitleImg = renderTextToImage("Hệ thống tra cứu tài liệu & lịch thi HOU", 18, false, "#FFFFFF");
      doc.addImage(subTitleImg.data, "PNG", (297 - subTitleImg.width * 0.3) / 2, 30, subTitleImg.width * 0.3, subTitleImg.height * 0.3);
    };

    renderHeader(true);

    let currentY = 65;

    if (shouldGroup) {
      const groupedData = groupBy(exportResults, (item) => item.subject || "Chưa xác định");

      const sortedEntries = Array.from(groupedData.entries()).sort((a, b) => {
        const itemA = a[1][0];
        const itemB = b[1][0];

        const dateA = new Date(itemA.examDate || 0).getTime();
        const dateB = new Date(itemB.examDate || 0).getTime();
        if (dateA - dateB !== 0) return dateA - dateB;

        const roomA = (itemA.examRoom || "").toString();
        const roomB = (itemB.examRoom || "").toString();
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: "base" });
      });

      sortedEntries.forEach(([subject, items]) => {
        items.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "vi", { sensitivity: "base" }));

        if (currentY > 160) {
          doc.addPage();
          renderHeader(false);
          currentY = 65;
        }

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(15, currentY, 282, currentY);
        currentY += 5;

        const subjectTitleImg = renderTextToImage(`MÔN: ${subject}`, 20, true, currentTheme.dark);
        doc.addImage(subjectTitleImg.data, "PNG", 15, currentY, subjectTitleImg.width * 0.3, subjectTitleImg.height * 0.3);
        currentY += 12;

        const head = [["STT", "Mã SV", "Họ Tên", "Mã ngành", "Ngày", "Ca", "Phòng"]];
        const body = items.map((row, idx) => [
          idx + 1,
          row.studentId || "-",
          row.fullName || "-",
          Array.isArray(row.majorCode) ? row.majorCode.join(", ") : row.majorCode || "-",
          row.examDate ? new Date(row.examDate).toLocaleDateString("vi-VN") : "-",
          row.examSession || "-",
          row.examRoom || "-",
        ]);

        autoTable(doc, {
          startY: currentY,
          margin: { left: 15, right: 15 },
          head: head,
          body: body,
          theme: "striped",
          headStyles: {
            fillColor: primaryRgb as any,
            fontSize: 11,
            font: "times",
            halign: "center",
            valign: "middle",
            textColor: primaryRgb as any,
            lineWidth: 0.1,
            lineColor: [255, 255, 255] as any,
          },
          styles: {
            fontSize: 10,
            font: "times",
            cellPadding: 4,
            overflow: "linebreak",
            halign: "center",
            valign: "middle",
            lineWidth: 0.1,
            lineColor: [226, 232, 240] as any,
          },
          columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 28 },
            2: { cellWidth: 65 },
            3: { cellWidth: 65 },
            4: { cellWidth: 30 },
            5: { cellWidth: 20 },
            6: { cellWidth: 30 },
          },
          didParseCell: (data) => {
            if (data.cell.styles.fillColor) data.cell.styles.textColor = data.cell.styles.fillColor;
          },
          didDrawCell: (data) => {
            const text = data.cell.raw;
            if (text !== undefined) {
              const isHeader = data.section === "head";
              const img = renderTextToImage(String(text), isHeader ? 11 : 10, isHeader, isHeader ? "#FFFFFF" : "#1e293b");
              const scale = 0.28;
              doc.addImage(
                img.data,
                "PNG",
                data.cell.x + (data.cell.width - img.width * scale) / 2,
                data.cell.y + (data.cell.height - img.height * scale) / 2,
                img.width * scale,
                img.height * scale
              );
            }
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      });
    } else {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, currentY, 282, currentY);

      currentY += 10;
      if (isAllStudents) {
        const firstRow = exportResults[0];
        const subjectLabelImg = renderTextToImage("MÔN THI:", 18, true, "#64748b");
        doc.addImage(subjectLabelImg.data, "PNG", 15, currentY, subjectLabelImg.width * 0.3, subjectLabelImg.height * 0.3);

        const subjectValImg = renderTextToImage(firstRow.subject || "-", 20, true, "#1e293b");
        doc.addImage(subjectValImg.data, "PNG", 15, currentY + 8, subjectValImg.width * 0.3, subjectValImg.height * 0.3);

        const infoLabelImg = renderTextToImage("NGÀY - CA - PHÒNG:", 18, true, "#64748b");
        doc.addImage(infoLabelImg.data, "PNG", 180, currentY, infoLabelImg.width * 0.3, infoLabelImg.height * 0.3);

        const dateStr = firstRow.examDate ? new Date(firstRow.examDate).toLocaleDateString("vi-VN") : "-";
        const infoValImg = renderTextToImage(
          `${dateStr} - ${firstRow.examSession || "-"} - ${firstRow.examRoom || "-"}`,
          20,
          true,
          "#1e293b"
        );
        doc.addImage(infoValImg.data, "PNG", 180, currentY + 8, infoValImg.width * 0.3, infoValImg.height * 0.3);
      } else {
        const nameLabelImg = renderTextToImage("HỌ TÊN:", 18, true, "#64748b");
        doc.addImage(nameLabelImg.data, "PNG", 15, currentY, nameLabelImg.width * 0.3, nameLabelImg.height * 0.3);

        const nameValImg = renderTextToImage(studentData?.fullName || "", 20, true, "#1e293b");
        doc.addImage(nameValImg.data, "PNG", 15, currentY + 8, nameValImg.width * 0.3, nameValImg.height * 0.3);

        const idLabelImg = renderTextToImage("MÃ SINH VIÊN:", 18, true, "#64748b");
        doc.addImage(idLabelImg.data, "PNG", 180, currentY, idLabelImg.width * 0.3, idLabelImg.height * 0.3);

        const idValImg = renderTextToImage(studentData?.studentId || "", 20, true, "#1e293b");
        doc.addImage(idValImg.data, "PNG", 180, currentY + 8, idValImg.width * 0.3, idValImg.height * 0.3);
      }

      currentY += 25;
      doc.line(15, currentY, 282, currentY);

      const head = isAllStudents
        ? [["STT", "Mã SV", "Họ Tên", "Mã ngành", "Ngày", "Ca", "Phòng"]]
        : [["STT", "Môn Thi", "Ngày", "Ca", "Phòng"]];

      const body = exportResults.map((row, idx) => {
        const dateStr = row.examDate ? new Date(row.examDate).toLocaleDateString("vi-VN") : "-";
        return isAllStudents
          ? [
              idx + 1,
              row.studentId || "-",
              row.fullName || "-",
              Array.isArray(row.majorCode) ? row.majorCode.join(", ") : row.majorCode || "-",
              dateStr,
              row.examSession || "-",
              row.examRoom || "-",
            ]
          : [idx + 1, row.subject || "-", dateStr, row.examSession || "-", row.examRoom || "-"];
      });

      autoTable(doc, {
        startY: currentY + 10,
        margin: { left: 15, right: 15 },
        head: head,
        body: body,
        theme: "striped",
        headStyles: {
          fillColor: primaryRgb as any,
          fontSize: isAllStudents ? 12 : 16,
          font: "times",
          halign: "center",
          valign: "middle",
          textColor: primaryRgb as any,
          lineWidth: 0.1,
          lineColor: [255, 255, 255] as any,
        },
        styles: {
          fontSize: isAllStudents ? 11 : 14,
          font: "times",
          cellPadding: 5,
          overflow: "linebreak",
          halign: "center",
          valign: "middle",
          lineWidth: 0.1,
          lineColor: [226, 232, 240] as any,
        },
        columnStyles: isAllStudents
          ? {
              0: { cellWidth: 15 },
              1: { cellWidth: 35 },
              2: { cellWidth: 65 },
              3: { cellWidth: 65 },
              4: { cellWidth: 30 },
              5: { cellWidth: 30 },
              6: { cellWidth: 30 },
            }
          : {
              0: { cellWidth: 20 },
              1: { cellWidth: 120 },
              2: { cellWidth: 40 },
              3: { cellWidth: 30 },
              4: { cellWidth: 50 },
            },
        didParseCell: (data) => {
          if (data.cell.styles.fillColor) data.cell.styles.textColor = data.cell.styles.fillColor;
        },
        didDrawCell: (data) => {
          const text = data.cell.raw;
          if (text !== undefined) {
            const isHeader = data.section === "head";
            const img = renderTextToImage(
              String(text),
              isHeader ? (isAllStudents ? 12 : 16) : (isAllStudents ? 11 : 14),
              isHeader,
              isHeader ? "#FFFFFF" : "#1e293b"
            );
            const scale = 0.28;
            doc.addImage(
              img.data,
              "PNG",
              data.cell.x + (data.cell.width - img.width * scale) / 2,
              data.cell.y + (data.cell.height - img.height * scale) / 2,
              img.width * scale,
              img.height * scale
            );
          }
        },
      });
    }

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : currentY + 20;
    if (finalY < 185) {
      const footerImg = renderTextToImage(`Bản quyền thuộc về Tài liệu HOU`, 18, false, "#94a3b8");
      doc.addImage(footerImg.data, "PNG", (297 - footerImg.width * 0.3) / 2, finalY, footerImg.width * 0.3, footerImg.height * 0.3);
    }

    const fileName = customFileName || `LichThi_${studentData?.studentId || "SV"}_${Date.now()}.pdf`;
    doc.save(fileName);
    toast.success("Tải file PDF thành công!");
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error("Lỗi khi tạo file PDF.");
  } finally {
    if (setLoadingState) setLoadingState(false);
  }
};
