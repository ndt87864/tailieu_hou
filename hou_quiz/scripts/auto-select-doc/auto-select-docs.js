(function () {
  "use strict";

  function _normalizeDetectedCourseTitle(raw) {
    let title = String(raw || "").trim();
    if (!title) return "";

    // Mẫu NEU: "Mon hoc_08032026"
    if (title.includes("_")) {
      const parts = title.split("_");
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        if (/^\d+$/.test(lastPart)) {
          title = parts.slice(0, -1).join("_").trim();
        }
      }
    }

    // Chỉ lấy phần trước dấu "-" (ví dụ: "Lịch sử nhà nước và pháp luật - SL10.031" -> "Lịch sử nhà nước và pháp luật")
    if (title.includes("-") || title.includes("–") || title.includes("—")) {
      title = title.split(/[-–—]/)[0].trim();
    }

    return title.trim();
  }

  function _detect() {
    try {
      // 1. LMS Hub HOU
      const host = (window.location.hostname || "").toLowerCase();
      if (host === "lmshub.hou.edu.vn") {
        const headerEl =
          document.querySelector(".page-header-headings h1") ||
          document.querySelector("#page-header h1");
        const rawHeader = (headerEl && headerEl.textContent ? headerEl.textContent : "").trim();
        const title = _normalizeDetectedCourseTitle(rawHeader);
        if (title) return { title };
      }

      // 2. EHOU
      let el =
        document.querySelector(".coursename.home-coursename a") ||
        document.querySelector(".coursename a") ||
        document.querySelector('a[itemprop="url"] span[itemprop="title"]') ||
        document.querySelector('span[itemprop="title"]');

      if (el) {
        let raw = (el.textContent || el.getAttribute("title") || "").trim();
        let title = _normalizeDetectedCourseTitle(raw);
        if (title) return { title };
      }
    } catch (e) {
      console.error("[HouQuiz] Error detecting course info", e);
    }
    return null;
  }

  // Lấy tài liệu khớp từ Backend
  async function detectAndFetchDocument() {
    const info = _detect();
    if (!info || !info.title) {
      console.log("[HouQuiz] Không nhận diện được tên môn học trên trang.");
      return null;
    }

    console.log("[HouQuiz] Đã nhận diện tên môn học:", info.title);

    try {
      const dbMode = (await window.houQuizUtils.syncRemoteDbMode()) || "questions";

      if (dbMode === "off") {
        console.log("[HouQuiz] DB Mode is off. Skipping document matching.");
        chrome.storage.local.set({ 
          hou_current_course: info.title,
          hou_current_doc: "Database đã bị tắt (off)"
        });
        return null;
      }

      const payload = await window.houQuizUtils.fetchAPI(`${window.houQuizConfig.API_URL}/documents`);
      const docList = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.documents) ? payload.documents : []);
      
      const titleParts = info.title.split("/").map(t => t.trim()).filter(Boolean);
      const cleanWebTitles = titleParts.map(part => window.houQuizUtils.normalizeTextForMatching(part));
      const matchedDocs = [];

      function isCourseTitleMatch(webTitle, docTitle) {
        const w = String(webTitle || "").toLowerCase().trim();
        const d = String(docTitle || "").toLowerCase().trim();
        if (w === d) return true;

        const cleanW = window.houQuizUtils.stripVietnameseDiacritics(w).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const cleanD = window.houQuizUtils.stripVietnameseDiacritics(d).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        if (cleanW === cleanD) return true;

        const getBaseAndNumbers = (str) => {
          const match = str.match(/^(.*?)\s*(\b\d+(?:[\s+,&/\\]+\d+)*\b)\s*$/);
          if (match) {
            const base = match[1].trim();
            const nums = match[2].match(/\d+/g) || [];
            return { base, nums };
          }
          return { base: str, nums: [] };
        };

        const parsedW = getBaseAndNumbers(cleanW);
        const parsedD = getBaseAndNumbers(cleanD);

        if (parsedW.base && parsedD.base && parsedW.base === parsedD.base) {
          if (parsedW.nums.length > 0 && parsedD.nums.length > 0) {
            const allNumsMatched = parsedW.nums.every(num => parsedD.nums.includes(num));
            if (allNumsMatched) return true;
          }
        }

        return cleanD.includes(cleanW) || cleanW.includes(cleanD);
      }

      if (docList.length > 0) {
        docList.forEach(doc => {
          const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
          const isMatched = cleanWebTitles.some(cleanWebTitle => isCourseTitleMatch(cleanWebTitle, cleanDocTitle));
          if (isMatched) {
            matchedDocs.push(doc);
          }
        });
      }

      // Lưu tên môn học tìm kiếm
      chrome.storage.local.set({ 
        hou_current_course: info.title,
        hou_current_doc: matchedDocs.length > 0 ? matchedDocs.map(d => d.title).join(", ") : "Không tìm thấy tài liệu phù hợp"
      });

      if (matchedDocs.length > 0) {
        console.log("[HouQuiz] Đã tìm thấy các tài liệu phù hợp từ Backend:", matchedDocs.map(d => d.title).join(", "));
        return matchedDocs;
      }
    } catch (e) {
      console.error("[HouQuiz] Lỗi khi tải tài liệu từ backend:", e);
    }

    chrome.storage.local.set({ 
      hou_current_course: info ? info.title : "Chưa xác định",
      hou_current_doc: "Lỗi kết nối hoặc không tìm thấy tài liệu"
    });
    return null;
  }

  window.houQuizAutoSelect = {
    detectAndFetchDocument
  };
})();
