(function () {
  "use strict";

  // Phục vụ giao tiếp gửi tin nhắn tới Content Script quét câu hỏi
  const btnScan = document.getElementById("btn-scan-questions");
  const scanStatusBox = document.getElementById("scan-status-box");
  const scanStatusText = document.getElementById("scan-status-text");
  const scanStatusDetails = document.getElementById("scan-status-details");

  if (btnScan) {
    btnScan.addEventListener("click", async () => {
      btnScan.disabled = true;
      btnScan.textContent = "Đang quét...";
      scanStatusBox.style.display = "flex";
      scanStatusText.textContent = "Đang kết nối tới trang làm bài...";
      scanStatusDetails.textContent = "";

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("Không tìm thấy tab hoạt động.");

        chrome.tabs.sendMessage(tab.id, { action: "scanQuestions" }, async (response) => {
          if (chrome.runtime.lastError) {
            resetScanBtn();
            scanStatusText.textContent = "Lỗi kết nối trang.";
            scanStatusDetails.textContent = "Hãy chắc chắn bạn đang ở trang xem lại bài (review) và đã tải lại trang.";
            return;
          }

          if (!response || !response.success) {
            resetScanBtn();
            scanStatusText.textContent = "Quét thất bại.";
            scanStatusDetails.textContent = response?.error || "Không thể quét được câu hỏi.";
            return;
          }

          const questions = response.questions || [];
          if (questions.length === 0) {
            resetScanBtn();
            scanStatusText.textContent = "Không tìm thấy câu hỏi.";
            scanStatusDetails.textContent = "Trang này không có câu hỏi nào hoặc không được hỗ trợ quét.";
            return;
          }

          scanStatusText.textContent = `Đã quét được ${questions.length} câu. Đang lấy thông tin tài liệu...`;

          chrome.storage.local.get(["hou_current_course", "hou_current_doc"], async (storeRes) => {
            const courseTitle = storeRes.hou_current_course;
            if (!courseTitle) {
              resetScanBtn();
              scanStatusText.textContent = "Không có tài liệu.";
              scanStatusDetails.textContent = "Không phát hiện được môn học hiện tại. Hãy mở tab làm bài.";
              return;
            }

            try {
              const config = window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" };
              scanStatusText.textContent = `Đang kết nối backend tìm tài liệu cho môn: ${courseTitle}...`;

              const fetchShowNetwork = await new Promise(resolve => {
                chrome.storage.local.get(["hou_show_network_status"], res => {
                  resolve(res.hou_show_network_status === true);
                });
              });

              let docList = [];
              if (fetchShowNetwork) {
                const docRes = await fetch(`${config.API_URL}/documents`);
                if (docRes.ok) {
                  const payload = await docRes.json();
                  docList = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.documents) ? payload.documents : []);
                }
              } else {
                const res = await new Promise((resolve) => {
                  chrome.runtime.sendMessage({ type: "FETCH_API", url: `${config.API_URL}/documents` }, resolve);
                });
                if (res && res.success) {
                  const payload = res.data;
                  docList = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.documents) ? payload.documents : []);
                }
              }

              let matchedDoc = null;
              if (docList.length > 0) {
                const cleanWebTitle = window.houQuizUtils.normalizeTextForMatching(courseTitle);
                matchedDoc = docList.find(doc => {
                  const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
                  return cleanDocTitle === cleanWebTitle || cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
                });
              }

              if (!matchedDoc) {
                scanStatusText.textContent = `Không tìm thấy tài liệu phù hợp. Đang tạo tài liệu mới: "${courseTitle}"...`;
                
                let categories = [];
                const catUrl = `${config.API_URL}/categories`;
                if (fetchShowNetwork) {
                  const catRes = await fetch(catUrl);
                  if (catRes.ok) categories = await catRes.json();
                } else {
                  const res = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: "FETCH_API", url: catUrl }, resolve);
                  });
                  if (res && res.success) categories = res.data;
                }

                let categoryId = categories && categories[0] ? categories[0].id : null;
                if (!categoryId) {
                  const createCatUrl = `${config.API_URL}/categories`;
                  const options = {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "Học phần LMS" })
                  };
                  let newCat = null;
                  if (fetchShowNetwork) {
                    const createCatRes = await fetch(createCatUrl, options);
                    if (createCatRes.ok) newCat = await createCatRes.json();
                  } else {
                    const res = await new Promise((resolve) => {
                      chrome.runtime.sendMessage({ type: "FETCH_API", url: createCatUrl, options }, resolve);
                    });
                    if (res && res.success) newCat = res.data;
                  }
                  categoryId = newCat ? newCat.id : null;
                }

                if (!categoryId) throw new Error("Không thể khởi tạo Category lưu trữ.");

                const createDocUrl = `${config.API_URL}/documents`;
                const createDocOptions = {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: courseTitle, categoryId: categoryId })
                };
                
                if (fetchShowNetwork) {
                  const createDocRes = await fetch(createDocUrl, createDocOptions);
                  if (createDocRes.ok) matchedDoc = await createDocRes.json();
                } else {
                  const res = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: "FETCH_API", url: createDocUrl, options: createDocOptions }, resolve);
                  });
                  if (res && res.success) matchedDoc = res.data;
                }
              }

              if (!matchedDoc || !matchedDoc.id) {
                throw new Error("Không thể nhận diện hoặc tạo tài liệu lưu trữ môn học.");
              }

              scanStatusText.textContent = `Đang lưu ${questions.length} câu vào tài liệu: "${matchedDoc.title}"...`;
              
              const saveQuestionsUrl = `${config.API_URL}/questions/bulk`;
              const saveOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  documentId: matchedDoc.id,
                  questions: questions.map(q => ({
                    question: q.question,
                    answer: q.answer,
                    choices: q.choices,
                    stt: q.stt
                  }))
                })
              };

              let saveResult = null;
              if (fetchShowNetwork) {
                const saveRes = await fetch(saveQuestionsUrl, saveOptions);
                if (saveRes.ok) saveResult = await saveRes.json();
              } else {
                const res = await new Promise((resolve) => {
                  chrome.runtime.sendMessage({ type: "FETCH_API", url: saveQuestionsUrl, options: saveOptions }, resolve);
                });
                if (res && res.success) saveResult = res.data;
              }

              resetScanBtn();
              scanStatusText.textContent = "Thành công!";
              const added = saveResult ? (saveResult.added || saveResult.successCount || questions.length) : questions.length;
              scanStatusDetails.textContent = `Đã đồng bộ ${added} câu hỏi vào CSDL của tài liệu "${matchedDoc.title}".`;
              
            } catch (err) {
              resetScanBtn();
              scanStatusText.textContent = "Lỗi lưu CSDL.";
              scanStatusDetails.textContent = err.message || String(err);
            }
          });
        });
      } catch (err) {
        resetScanBtn();
        scanStatusText.textContent = "Lỗi khởi chạy.";
        scanStatusDetails.textContent = err.message || String(err);
      }
    });
  }

  function resetScanBtn() {
    if (!btnScan) return;
    btnScan.disabled = false;
    btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
  }
})();
