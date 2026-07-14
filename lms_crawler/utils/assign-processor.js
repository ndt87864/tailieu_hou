const cheerio = require("cheerio");
const axios = require("axios");

/**
 * Xử lý bài kiểm tra tự luận (assignment)
 * Quy trình:
 * 1. Tải trang chi tiết bài tự luận để tìm liên kết đến trang chấm điểm (action=grading)
 * 2. Tải trang chấm điểm và tìm tất cả bài nộp của sinh viên trong bảng
 * 3. Kiểm tra điểm số ở cột 5 (cell c4 / index 4), nếu điểm >= 80 thì lấy link file ở cột 6 (cell c5 / index 5)
 * 4. Tải file bài làm và upload lên Supabase Storage, lưu thông tin vào crawler_resources
 */
async function processAssignment({
  assignUrl,
  activityName,
  dbCourse,
  sectionName,
  getHtmlWithSso,
  getCookieHeader,
  uploadFileToStorage,
  supabaseAdmin
}) {
  try {
    console.log(`   📝 Phát hiện bài tự luận: ${assignUrl}`);
    const assignRes = await getHtmlWithSso(assignUrl);
    const $assignPage = cheerio.load(assignRes.data);

    // Tìm link dẫn đến trang xem/cho điểm các bài nộp
    let gradingUrl = $assignPage("a[href*='action=grading']").first().attr("href");
    if (!gradingUrl) {
      // Thử tìm trong toàn bộ các thẻ a
      $assignPage("a").each((i, el) => {
        const href = $assignPage(el).attr("href");
        if (href && href.includes("action=grading") && href.includes("mod/assign/view.php")) {
          gradingUrl = href;
          return false; // break
        }
      });
    }

    if (!gradingUrl) {
      console.log(`   ⚠️ Không tìm thấy link trang xem điểm bài tự luận (có thể không có quyền giáo viên). Bỏ qua.`);
      return;
    }

    console.log(`   🔍 Đang truy cập trang danh sách chấm bài: ${gradingUrl}`);
    const gradingRes = await getHtmlWithSso(gradingUrl);
    const $gradingPage = cheerio.load(gradingRes.data);

    const rows = $gradingPage("table.generaltable tbody tr, tr[id^='mod_assign_grading_r']");
    if (rows.length === 0) {
      console.log(`   ℹ️ Không tìm thấy danh sách bài nộp nào.`);
      return;
    }

    console.log(`   📊 Tìm thấy ${rows.length} hàng bài nộp. Đang lọc bài làm điểm >= 80...`);

    let processedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Cell 4 (index 4) chứa điểm số
      let cellGrade = $gradingPage(row).find("td.c4").first();
      if (cellGrade.length === 0) {
        cellGrade = $gradingPage(row).find("td").eq(4);
      }

      // Cell 5 (index 5) chứa file nộp
      let cellFile = $gradingPage(row).find("td.c5").first();
      if (cellFile.length === 0) {
        cellFile = $gradingPage(row).find("td").eq(5);
      }

      if (cellGrade.length === 0) continue;

      const gradeText = cellGrade.text().trim();
      if (!gradeText || gradeText === "-") continue;

      // Parse điểm số, ví dụ "80,00 / 100,00" hoặc "8.50"
      const parts = gradeText.split("/");
      const rawVal = parts[0].trim().replace(",", ".");
      const gradeVal = parseFloat(rawVal);

      if (isNaN(gradeVal)) continue;

      // Chuẩn hóa điểm về thang 100
      const normalizedGrade = gradeVal <= 10 ? gradeVal * 10 : gradeVal;

      if (normalizedGrade >= 80) {
        // Tìm các link tải file trong ô cellFile
        let fileLinks = [];
        cellFile.find("a").each((j, a) => {
          const href = $gradingPage(a).attr("href");
          if (href && (href.includes("pluginfile.php") || href.includes("forcedownload=1"))) {
            fileLinks.push({
              href,
              text: $gradingPage(a).text().trim()
            });
          }
        });

        // Nếu cellFile không chứa link tải file nộp, ta quét toàn bộ dòng để tìm link file nộp (dạng assign/submission hoặc pluginfile)
        if (fileLinks.length === 0) {
          $gradingPage(row).find("a").each((j, a) => {
            const href = $gradingPage(a).attr("href");
            if (href && href.includes("pluginfile.php") && (href.includes("submission") || href.includes("assign"))) {
              fileLinks.push({
                href,
                text: $gradingPage(a).text().trim()
              });
            }
          });
        }

        if (fileLinks.length === 0) {
          continue;
        }

        for (const fileLink of fileLinks) {
          try {
            console.log(`      📥 Phát hiện bài làm đạt điểm ${gradeText}. Tiến hành tải file: "${fileLink.text || "file"}"...`);
            const filePublicUrl = await uploadFileToStorage(fileLink.href, "essays", getCookieHeader);

            // Xác định loại tự luận cụ thể
            const essayType = getEssayType(activityName, fileLink.text);
            const prefix = getEssayPrefix(essayType);

            let essayTitle = fileLink.text || `file_${Date.now()}`;
            // Đảm bảo tiêu đề rõ ràng và có tiền tố tương ứng
            const displayTitle = `${prefix} ${essayTitle} (${gradeText.replace(/\s+/g, "")})`;

            // Kiểm tra xem tài nguyên này đã được lưu trước đó chưa
            const { data: existing } = await supabaseAdmin
              .from("crawler_resources")
              .select("id")
              .eq("course_id", dbCourse.id)
              .eq("content_url", filePublicUrl)
              .limit(1);

            if (existing && existing.length > 0) {
              console.log(`      ⏭️ File tự luận này đã tồn tại trong DB. Bỏ qua.`);
              continue;
            }

            // Lưu vào crawler_resources với loại tự luận tương ứng
            await supabaseAdmin.from("crawler_resources").insert({
              course_id: dbCourse.id,
              type: essayType,
              title: displayTitle,
              content_url: filePublicUrl,
              week_name: sectionName
            });

            console.log(`      ✅ Đã tải & lưu thành công file tự luận: "${displayTitle}"`);
            processedCount++;
          } catch (uploadErr) {
            console.log(`      ⚠️ Lỗi tải/upload file tự luận: ${uploadErr.message}`);
          }
        }
      }
    }

    console.log(`   ✅ Hoàn thành xử lý bài tự luận. Đã tải thành công ${processedCount} file.`);
    return processedCount;
  } catch (err) {
    console.log(`   ⚠️ Lỗi xử lý bài tự luận: ${err.message}`);
    return 0;
  }
}

module.exports = {
  processAssignment
};

/**
 * Phân loại tự luận dựa trên tên hoạt động lms và tên file bài nộp
 */
function getEssayType(activityName, fileTitle) {
  const name = ((activityName || "") + " " + (fileTitle || "")).toLowerCase();
  
  if (name.includes("nhật ký") || name.includes("nhat ky") || name.includes("nhật kí") || name.includes("nhat ki")) {
    return "essay_journal";
  }
  if (name.includes("báo cáo kiến tập") || name.includes("bao cao kien tap")) {
    return "essay_report_internship";
  }
  if (name.includes("báo cáo thực tập") || name.includes("bao cao thuc tap") || name.includes("báo cáo thực tế") || name.includes("bao cao thuc te")) {
    return "essay_report_practice";
  }
  if (name.includes("khóa luận") || name.includes("khoa luan") || name.includes("chuyên đề tốt nghiệp") || name.includes("chuyen de tot nghiep") || name.includes("khoa luan tot nghiep") || name.includes("khóa luận tốt nghiệp")) {
    return "essay_thesis";
  }
  if (name.includes("kiểm tra") || name.includes("kiem tra") || name.includes("thi ") || name.includes("giữa kỳ") || name.includes("cuối kỳ") || name.includes("giua ky") || name.includes("cuoi ky")) {
    return "essay_exam";
  }
  if (name.includes("bài tập") || name.includes("bai tap") || name.includes("tự luận") || name.includes("tu luan")) {
    return "essay_exercise";
  }
  
  return "essay_other";
}

/**
 * Lấy nhãn hiển thị (tiền tố) tương ứng cho từng loại tự luận
 */
function getEssayPrefix(essayType) {
  switch (essayType) {
    case "essay_journal":
      return "[Nhật ký kiến tập]";
    case "essay_report_internship":
      return "[Báo cáo kiến tập]";
    case "essay_report_practice":
      return "[Báo cáo thực tập]";
    case "essay_thesis":
      return "[Khóa luận tốt nghiệp]";
    case "essay_exam":
      return "[Kiểm tra tự luận]";
    case "essay_exercise":
      return "[Bài tập tự luận]";
    default:
      return "[Tự luận]";
  }
}
