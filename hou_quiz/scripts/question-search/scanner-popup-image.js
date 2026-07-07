(function () {
  "use strict";

  // Logic download ảnh song song từ LMS và chuyển đổi sang Base64
  async function downloadAndPrepareImages(activeQuestions) {
    const imageRequests = [];
    const seenUrls = new Set();

    for (const q of activeQuestions) {
      if (q.rawQuestionImageUrl && !q.url_question) {
        const urls = q.rawQuestionImageUrl.split(",").map(u => u.trim()).filter(Boolean);
        urls.forEach(url => {
          const reqKey = `question_url:${url}`;
          if (!seenUrls.has(reqKey)) {
            seenUrls.add(reqKey);
            imageRequests.push({ rawUrl: url, folder: "question_url" });
          }
        });
      }
      if (q.rawAnswerImageUrl && !q.url_answer) {
        const urls = q.rawAnswerImageUrl.split(",").map(u => u.trim()).filter(Boolean);
        urls.forEach(url => {
          const reqKey = `answer_url:${url}`;
          if (!seenUrls.has(reqKey)) {
            seenUrls.add(reqKey);
            imageRequests.push({ rawUrl: url, folder: "answer_url" });
          }
        });
      }
      if (q.rawChoicesImageUrl && !q.url_choices) {
        const urls = q.rawChoicesImageUrl.split(",").map(u => u.trim()).filter(Boolean);
        urls.forEach(url => {
          const reqKey = `choice_url:${url}`;
          if (!seenUrls.has(reqKey)) {
            seenUrls.add(reqKey);
            imageRequests.push({ rawUrl: url, folder: "choice_url" });
          }
        });
      }
    }

    if (imageRequests.length === 0) return [];

    const downloadPromises = imageRequests.map(async (req) => {
      const { rawUrl, folder } = req;
      
      if (folder === "question_url" && !/\/pluginfile\.php\/.*\/question\//i.test(rawUrl)) {
        return null;
      }
      if (folder === "answer_url" && !/\/pluginfile\.php\/.*\/question\//i.test(rawUrl)) {
        return null;
      }
      if (folder === "choice_url" && !/\/pluginfile\.php\/.*\/question\//i.test(rawUrl)) {
        return null;
      }

      try {
        const response = await fetch(rawUrl);
        const blob = await response.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const urlPath = new URL(rawUrl).pathname;
        const fileName = urlPath.split('/').pop() || null;
        
        return { base64, folder, fileName, originalUrl: rawUrl };
      } catch (err) {
        console.error(`[HouQuiz Scanner] Lỗi khi tải ảnh (${rawUrl}):`, err);
        return null;
      }
    });

    return (await Promise.all(downloadPromises)).filter(Boolean);
  }

  window.houQuizScannerImage = {
    downloadAndPrepareImages
  };
})();
