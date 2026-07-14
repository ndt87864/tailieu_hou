const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { supabaseAdmin } = require("./db");

const specialDocs = [
  "kiến tập",
  "đề án môn học",
  "khóa luận tốt nghiệp",
  "thực hành nghề nghiệp",
  "kiểm soát nội bộ"
];

function getDocumentTitle(tenHocPhan, sheetName) {
  const trimmed = tenHocPhan.trim();
  const lower = trimmed.toLowerCase();
  
  const isSpecial = specialDocs.includes(lower) || lower.startsWith("thực hành nghề");
  
  if (isSpecial) {
    return `${trimmed} ${sheetName.trim()}`;
  }
  return trimmed;
}

async function readExcelCourses(excelPath) {
  let buffer;
  if (excelPath.startsWith("http://") || excelPath.startsWith("https://")) {
    console.log(`🌐 Đang tải tệp Excel từ URL: ${excelPath}...`);
    const response = await axios.get(excelPath, { responseType: "arraybuffer" });
    buffer = response.data;
  } else {
    const resolvedPath = path.isAbsolute(excelPath) ? excelPath : path.resolve(__dirname, "..", excelPath);
    console.log(`📁 Đang đọc tệp Excel cục bộ từ: ${resolvedPath}...`);
    buffer = fs.readFileSync(resolvedPath);
  }
  const workbook = xlsx.read(buffer, { type: "buffer" });
  return workbook;
}

async function getSearchKeywordsFromExcel(excelPath) {
  const workbook = await readExcelCourses(excelPath);
  const searchKeywords = [];
  const docCache = {}; // Cache docTitle -> id để giảm số lần truy vấn DB
  const catCache = {}; // Cache sheetName -> categoryId

  // Tải danh sách tiêu đề các tài liệu đại cương từ DB để so khớp nhanh
  const generalDocTitles = new Set();
  const processedGeneralDocTitles = new Set();
  const GENERAL_CATEGORY_ID = "7b08790d-0188-4158-8b9e-56d87d03b670";

  try {
    const { data: generalDocs } = await supabaseAdmin
      .from("documents")
      .select("title")
      .eq("category_id", GENERAL_CATEGORY_ID);
    if (generalDocs) {
      generalDocs.forEach(d => generalDocTitles.add(d.title.trim().toLowerCase()));
    }
  } catch (err) {
    console.error("⚠️ Lỗi khi lấy danh sách Môn Đại Cương từ DB:", err.message);
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`📊 Đang xử lý ngành (sheet) "${sheetName}" (${rows.length} dòng)...`);

    // Tìm categoryId từ bảng categories khớp với tên sheetName
    let categoryId = catCache[sheetName];
    if (categoryId === undefined) {
      try {
        const { data: catData } = await supabaseAdmin
          .from("categories")
          .select("id")
          .eq("title", sheetName.trim())
          .maybeSingle();
        categoryId = catData ? catData.id : null;
        catCache[sheetName] = categoryId;
      } catch (err) {
        console.error(`⚠️ Lỗi khi lấy category cho "${sheetName}":`, err.message);
        categoryId = null;
      }
    }

    for (const row of rows) {
      const tenHocPhan = row["Tên học phần"];
      const maMon = row["Mã môn"];
      if (!tenHocPhan || !maMon) continue;

      const docTitle = getDocumentTitle(tenHocPhan, sheetName);
      const courseSearchTitle = `${tenHocPhan.trim()} - ${maMon.trim()}`;

      // Bỏ qua ngay nếu là học phần đại cương đã được quét ở các sheet trước
      if (processedGeneralDocTitles.has(docTitle.toLowerCase())) {
        continue;
      }

      // Tránh trùng lặp trong danh sách trả về
      if (searchKeywords.some(k => k.title === courseSearchTitle)) {
        continue;
      }

      let isGeneralDoc = generalDocTitles.has(docTitle.toLowerCase());
      let docId = docCache[docTitle];
      let docCategoryId = null;

      if (docId) {
        docCategoryId = docCache[docTitle + "_catId"];
      } else {
        try {
          const { data: existingDoc } = await supabaseAdmin
            .from("documents")
            .select("id, category_id")
            .eq("title", docTitle)
            .maybeSingle();

          if (existingDoc) {
            docId = existingDoc.id;
            docCategoryId = existingDoc.category_id;
            if (docCategoryId === GENERAL_CATEGORY_ID) {
              isGeneralDoc = true;
            }
            if (!existingDoc.category_id && categoryId) {
              console.log(`🔄 Cập nhật category_id cho document hiện có: "${docTitle}"`);
              await supabaseAdmin
                .from("documents")
                .update({ category_id: categoryId })
                .eq("id", docId);
              docCategoryId = categoryId;
            }
          } else {
            console.log(`🆕 Thêm document mới vào DB: "${docTitle}" (category_id: ${categoryId})`);
            const { data: newDoc, error: insErr } = await supabaseAdmin
              .from("documents")
              .insert({ title: docTitle, category_id: categoryId })
              .select("id, category_id")
              .single();

            if (insErr) {
              console.error(`⚠️ Lỗi thêm document mới "${docTitle}":`, insErr.message);
            } else if (newDoc) {
              docId = newDoc.id;
              docCategoryId = newDoc.category_id;
            }
          }
          if (docId) {
            docCache[docTitle] = docId;
            docCache[docTitle + "_catId"] = docCategoryId;
          }
        } catch (err) {
          console.error(`⚠️ Lỗi khi truy vấn/thêm DB cho document "${docTitle}":`, err.message);
        }
      }

      if (isGeneralDoc) {
        processedGeneralDocTitles.add(docTitle.toLowerCase());
      }

      searchKeywords.push({
        id: docId,
        title: courseSearchTitle,
        docTitle: docTitle
      });
    }
  }

  console.log(`✅ Hoàn thành phân tích Excel. Tìm thấy ${searchKeywords.length} môn học.`);
  return searchKeywords;
}

module.exports = {
  getSearchKeywordsFromExcel
};
