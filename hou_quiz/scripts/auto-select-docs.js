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
      // Query danh sách tài liệu từ Backend Hono
      const response = await fetch(`${window.houQuizConfig.API_URL}/documents`);
      if (!response.ok) throw new Error("Không thể kết nối đến backend");
      
      const payload = await response.json();
      const docList = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.documents) ? payload.documents : []);
      
      const cleanWebTitle = window.houQuizUtils.normalizeTextForMatching(info.title);
      let matchedDoc = null;

      if (docList.length > 0) {
        matchedDoc = docList.find(doc => {
          const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
          // 1. So khớp chính xác sau khi chuẩn hóa
          if (cleanDocTitle === cleanWebTitle) return true;
          // 2. Khớp một phần
          return cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
        });
      }

      // Lưu tên môn học tìm kiếm
      chrome.storage.local.set({ 
        hou_current_course: info.title,
        hou_current_doc: matchedDoc ? matchedDoc.title : "Không tìm thấy tài liệu phù hợp"
      });

      if (matchedDoc) {
        console.log("[HouQuiz] Đã tìm thấy tài liệu phù hợp từ Backend:", matchedDoc.title, "ID:", matchedDoc.id);
        return matchedDoc;
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
