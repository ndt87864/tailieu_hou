(function () {
  "use strict";

  // Các hàm chuẩn hóa và so khớp chuỗi
  function normalizeTextForMatching(text) {
    if (!text) return '';
    try {
      let s = text.toString();
      const moodleUrlPattern = /https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
      s = s.replace(moodleUrlPattern, '$1');
      const truncatedUrlPattern = /(?:\.){2,}\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
      s = s.replace(truncatedUrlPattern, '$1');
      s = s.replace(/[\u00A0\u2000-\u200B\uFEFF\u202F\xa0]/g, ' ');
      s = s.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, '');
      s = s.replace(/^[A-Za-z][\.\)](\S)/u, '$1');
      s = s.replace(/\n/g, ' ').replace(/[\s\t]+/g, ' ').replace(/[\s\xa0]{2,}/g, ' ').trim();
      s = s.replace(/^[\s\u2022•|]+|[\s\u2022•|]+$/g, '').trim();
      if (!/[._\u2026]{2,}\s*$/.test(s)) {
        s = s.replace(/[\.\u2026\-–—\s,;!\?\u2713\u2714]+$/g, '').trim();
      }
      return s;
    } catch (e) {
      let s = ('' + text).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      s = s.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, '');
      return s.replace(/[\.\u2026\-–—\s]+$/g, '').trim();
    }
  }

  function stripVietnameseDiacritics(str) {
    if (!str) return "";
    let s = String(str);
    try { if (s.normalize) s = s.normalize('NFD').replace(/\p{M}/gu, ''); } catch (e) { s = s.replace(/[\u0300-\u036f]/g, ''); }
    return s;
  }

  function normalizeForCompare(str) {
    let s = String(str || '');
    const moodleUrlPattern = /https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
    s = s.replace(moodleUrlPattern, '$1');
    const truncatedUrlPattern = /(?:\.){2,}\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
    s = s.replace(truncatedUrlPattern, '$1');
    try { if (s.normalize) s = s.normalize('NFKC'); } catch (e) { }
    s = s.toLowerCase();
    s = s.replace(/\s+/g, ' ').trim();
    let key = s;
    try {
      if (key.normalize) key = key.normalize('NFD').replace(/\p{M}/gu, '');
    } catch (e) { key = key.replace(/[\u0300-\u036f]/g, ''); }
    try {
      const unicodeLetterNumber = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
      key = key.replace(unicodeLetterNumber, '');
    } catch (e) {
      key = key.replace(/[^A-Za-z0-9\s]/g, '');
    }
    key = key.replace(/\s+/g, ' ').trim();
    return { raw: s, key };
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const v0 = new Array(bl + 1).fill(0);
    const v1 = new Array(bl + 1).fill(0);
    for (let j = 0; j <= bl; j++) v0[j] = j;
    for (let i = 0; i < al; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < bl; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= bl; j++) v0[j] = v1[j];
    }
    return v1[bl];
  }

  function compareNormalized(s1, s2) {
    if (!s1 || !s2) return false;
    
    const A = normalizeForCompare(s1);
    const B = normalizeForCompare(s2);
    if (!A.key || !B.key) return false;
    if (A.key === B.key) return true;
    if (A.key.replace(/\s+/g, '') === B.key.replace(/\s+/g, '') && A.key.replace(/\s+/g, '').length > 0) return true;
    
    // Nếu hai chuỗi có cấu trúc quá giống nhau nhưng chỉ khác nhau số (như độ tuổi "14", "18", "12", "16")
    // ta không được dùng so khớp mờ. Hãy đếm xem có số nào khác nhau không.
    const numsA = A.key.match(/\d+/g) || [];
    const numsB = B.key.match(/\d+/g) || [];
    if (numsA.join(',') !== numsB.join(',')) {
      return false; // Nếu các con số xuất hiện trong chuỗi không khớp hoàn toàn, loại bỏ ngay lập tức
    }

    // Chỉ cho phép so khớp dạng includes hoặc Levenshtein khi đáp án đủ dài (ví dụ: > 8 ký tự)
    if (A.key.length > 8 && B.key.length > 8) {
      if (A.key.includes(B.key) || B.key.includes(A.key)) return true;
      try {
        const lev = levenshtein(A.key, B.key);
        const maxLen = Math.max(A.key.length, B.key.length) || 1;
        const ratio = lev / maxLen;
        if (ratio <= 0.10 || lev <= 1) return true; // Siết chặt ngưỡng sai số từ 0.15 xuống 0.10 và lev từ 2 xuống 1
      } catch (e) { }
    }

    return false;
  }

  function getSimilarityScore(s1, s2) {
    if (!s1 || !s2) return 0;
    const A = normalizeForCompare(s1);
    const B = normalizeForCompare(s2);
    if (!A.key || !B.key) return 0;
    if (A.key === B.key) return 1.0;
    if (A.key.replace(/\s+/g, '') === B.key.replace(/\s+/g, '')) return 0.99;

    // Nếu một chuỗi chứa chuỗi còn lại, tính theo tỷ lệ độ dài
    if (A.key.includes(B.key) || B.key.includes(A.key)) {
      return 0.8 * (Math.min(A.key.length, B.key.length) / Math.max(A.key.length, B.key.length));
    }

    try {
      const lev = levenshtein(A.key, B.key);
      const maxLen = Math.max(A.key.length, B.key.length) || 1;
      return 1.0 - (lev / maxLen);
    } catch (e) {
      return 0;
    }
  }

  function extractPostAudioQuestionText(element) {
    if (!element || !element.querySelector) return '';

    const audioEl = element.querySelector('.mediaplugin, audio, .mediafallbacklink');
    if (!audioEl) return '';

    let audioNode = audioEl;
    while (audioNode && audioNode.parentElement !== element) {
      audioNode = audioNode.parentElement;
    }
    if (!audioNode) return '';

    const parts = [];
    let next = audioNode.nextSibling;
    while (next) {
      if (next.nodeType === Node.ELEMENT_NODE) {
        const tag = (next.tagName || '').toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
          next = next.nextSibling;
          continue;
        }
        const txt = next.textContent || '';
        if (txt && txt.trim()) parts.push(txt.trim());
      } else if (next.nodeType === Node.TEXT_NODE && next.textContent && next.textContent.trim()) {
        parts.push(next.textContent.trim());
      }
      next = next.nextSibling;
    }

    const afterAudioText = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (!afterAudioText) return '';

    const withoutPrompt = afterAudioText
      .replace(/^(listen( again)?|then listen( again)?|nghe( lại)?|lắng nghe)[\.:,\-\s]*/i, '')
      .trim();

    if (!withoutPrompt || withoutPrompt.length < 5) return '';

    if (
      /[?？]/.test(withoutPrompt) ||
      /_{2,}|___/.test(withoutPrompt) ||
      /\b(is interested in|complete|best completes|main idea|which|who|what|when|where|why|how|choose|circle|select|match|fill in)\b/i.test(withoutPrompt)
    ) {
      return withoutPrompt;
    }

    return '';
  }

  function cleanQuestionContent(text, element = null) {
    if (!text) return '';
    let processedText = text;

    if (element) {
      try {
        const cloned = element.cloneNode(true);
        cloned.querySelectorAll("script, style, .answer, label, .prompt, .accesshide").forEach(el => el.remove());
        cloned.querySelectorAll("img").forEach(img => {
          const src = img.getAttribute("src");
          if (src) {
            // Nếu là ảnh base64/data URI quá dài, loại bỏ nội dung data: để tránh làm nhiễu so khớp văn bản
            if (src.startsWith("data:")) {
              img.replaceWith(document.createTextNode(' "image_data" '));
            } else {
              img.replaceWith(document.createTextNode(` "${src}" `));
            }
          } else {
            img.remove();
          }
        });
        cloned.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6').forEach(el => {
          el.after(document.createTextNode(' '));
        });
        processedText = cloned.textContent.replace(/\s+/g, " ").trim();
      } catch (e) {
        console.error("[HouQuiz Utils] Lỗi khi trích xuất text có khoảng trắng:", e);
      }
    }

    const markers = [
      'Choose the best answer',
      'Choose the correct answer',
      'Select the best answer',
      'Select the correct answer',
      'Chọn câu trả lời đúng nhất',
      'Chọn đáp án đúng nhất',
      'Chọn một câu trả lời',
      'Chọn câu trả lời',
      'Choose one answer',
      'Trả lời câu hỏi',
      'Answer the question',
      'Are these following sentences true \\(T\\) or false \\(F\\)',
      'Are these following sentences true or false',
      'Are the following sentences true or false',
      'True or False',
      'True \\(T\\) or false \\(F\\)',
      'Read the text and do the activities that follow',
      'Choose A, B, C or D to complete the following sentence:',
      'Choose A, B, C or D to complete the sentence:',
      'Choose A, B, C, or D to complete the following sentence:',
      'Choose the lettered word or phrase',
      'Chọn câu trả lời đúng cho mỗi câu hoặc câu hỏi dưới đây',
      'Chọn câu trả lời đúng cho các câu dưới đây',
      'Chọn câu trả lời đúng cho các câu hỏi dưới đây',
      'Chọn câu trả lời đúng',
      'Chọn đáp án đúng'
    ];

    markers.sort((a, b) => b.length - a.length);

    const titleMarkers = [
      "Circle the best title for the reading text",
      "Circle the best title for the text",
      "Choose the best title",
      "Choose the most suitable title",
      "Select the best title",
      "What is the best title",
      "Which of the following is the best title",
      "Which of the following is the most suitable title",
      "Give a title to the passage",
      "Chọn tiêu đề đúng nhất",
      "Chọn tiêu đề phù hợp nhất",
      "Chọn tiêu đề cho đoạn văn",
      "Chọn tên đúng cho đoạn văn",
    ];

    const textLower = processedText.toLowerCase();
    
    // Loại bỏ các tiền tố mô tả câu hỏi từ Moodle
    processedText = processedText
      .replace(/^mô tả câu hỏi\s*/i, "")
      .replace(/^câu hỏi \d+\s*chưa trả lời\s*/i, "")
      .replace(/^câu hỏi \d+\s*đạt điểm\s*[\d\.,]+\s*/i, "")
      .replace(/^câu hỏi \d+\s*đã trả lời\s*/i, "")
      .replace(/^câu hỏi \d+\s*đúng\s*/i, "")
      .replace(/^câu hỏi \d+\s*sai\s*/i, "")
      .trim();

    for (const marker of titleMarkers) {
      if (textLower.includes(marker.toLowerCase())) {
        const markerIdx = textLower.indexOf(marker.toLowerCase());
        const endOfMarker = markerIdx + marker.length;
        const afterMarker = processedText.substring(endOfMarker);
        const firstSentenceMatch = afterMarker.match(/^[.\s:\n\r-]*/);
        const instructionEnd = endOfMarker + (firstSentenceMatch ? firstSentenceMatch[0].length : 0);
        const instruction = processedText.substring(0, instructionEnd).trim();

        let title = "";
        if (element) {
          const bold = element.querySelector("strong, b");
          if (bold) title = bold.textContent.trim();
        }

        if (!title) {
          const remaining = processedText.substring(instructionEnd).trim();
          if (remaining) {
            const parts = remaining.split(/\r?\n|(?<=[.!?])\s+/);
            const firstPart = parts[0].trim();
            if (firstPart.length > 0 && firstPart.length < 150) {
              title = firstPart;
            }
          }
        }

        if (instruction) {
          return (instruction + (title ? " " + title : "")).trim();
        }
      }
    }

    if (processedText.includes("//]]>")) {
      const parts = processedText.split("//]]>");
      if (parts.length > 1) {
        const afterScript = parts[parts.length - 1].trim();
        if (afterScript.length > 5) processedText = afterScript;
      }
    }

    if (element) {
      const postAudioQuestionText = extractPostAudioQuestionText(element);
      if (postAudioQuestionText) processedText = postAudioQuestionText;
    }

    const audioExtensions = [".mp3", ".wav", ".ogg"];
    for (const ext of audioExtensions) {
      const lower = processedText.toLowerCase();
      const idx = lower.lastIndexOf(ext);
      if (idx !== -1) {
        let beforeAudio = processedText.substring(0, idx).trim();
        let afterAudio = processedText.substring(idx + ext.length).trim();

        beforeAudio = beforeAudio
          .replace(/%20/g, " ")
          .replace(/track\s*[\d\.%-]*/gi, "")
          .replace(/\s+$/, "")
          .replace(/\/\/.*$/, "")
          .trim();
        afterAudio = afterAudio.replace(/%20/g, " ").replace(/<\/?[a-z][^>]*>/gi, "").trim();

        const isTrash = (text) => {
          if (!text) return true;
          const cleaned = text.replace(/track\s*[\d\.%-]*/gi, "").replace(/[\s\(\)\[\]\{\}\-\.\,]+/g, "").trim();
          return cleaned.length < 3;
        };

        if (afterAudio.length > 5 && !isTrash(afterAudio)) {
          processedText = afterAudio.replace(/https?:\/\/\S+/gi, "").trim();
          processedText = processedText
            .replace(/track\s*[\d\.%-]*/gi, "")
            .replace(/(?:\/\/|-{2,}).*/g, "")
            .trim();
          break;
        }

        if (beforeAudio.length > 5) {
          const imageUrls = [];
          beforeAudio = beforeAudio.replace(/"(https?:\/\/[^"]+)"/g, (match, url) => {
            const placeholder = `__IMG_${imageUrls.length}__`;
            imageUrls.push(url);
            return `"${placeholder}"`;
          });

          processedText = beforeAudio
            .replace(/https?:\/\/\S+/gi, "")
            .replace(/track\s*[\d\.%-]*/gi, "")
            .replace(/(?:\/\/|-{2,}).*/g, "")
            .trim();

          imageUrls.forEach((url, i) => {
            processedText = processedText.replace(`__IMG_${i}__`, url);
          });
          break;
        }

        const imageUrls = [];
        let combined = (beforeAudio + " " + afterAudio).replace(/"(https?:\/\/[^"]+)"/g, (match, url) => {
          const placeholder = `__IMG_${imageUrls.length}__`;
          imageUrls.push(url);
          return `"${placeholder}"`;
        });

        processedText = combined.replace(/https?:\/\/\S+/gi, "").trim();
        imageUrls.forEach((url, i) => {
          processedText = processedText.replace(`__IMG_${i}__`, url);
        });
      }
    }

    const imageUrlPlaceholders = [];
    const imageUrlPattern = /"((?:https?:\/\/|(?:\.){3,}\/)[^"]+)"/g;
    processedText = processedText.replace(imageUrlPattern, (match, url) => {
      const placeholder = `__IMAGE_URL_${imageUrlPlaceholders.length}__`;
      imageUrlPlaceholders.push(url);
      return `"${placeholder}"`;
    });
    processedText = processedText.replace(/https?:\/\/\S+/gi, "");
    imageUrlPlaceholders.forEach((url, index) => {
      const placeholder = `__IMAGE_URL_${index}__`;
      processedText = processedText.replace(new RegExp(placeholder, "g"), url);
    });

    processedText = processedText.trim();

    for (const marker of markers) {
      const regex = new RegExp(marker, "gi");
      const matches = [...processedText.matchAll(regex)];

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const lastIndex = lastMatch.index || 0;
        const contentAfter = processedText.substring(lastIndex + lastMatch[0].length).trim();
        const contentBefore = processedText.substring(0, lastIndex).trim();

        const looksLikeAnswerList = /(^|\n)\s*([A-Da-d]|\d+)[\.\)]\s+/m.test(contentAfter) ||
          /(^|\n)\s*a\.\s+/im.test(contentAfter) ||
          /\b(chọn|choose|select|circle|tick|đáp án)\b/i.test(contentAfter);

        if ((contentAfter.length === 0 || looksLikeAnswerList) && contentBefore.length > 5) {
          const segments = contentBefore.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/);
          const lastSegment = segments[segments.length - 1].trim();
          processedText = lastSegment.length > 5 ? lastSegment : contentBefore;
          break;
        }

        if (contentAfter.length > 5 && /[a-zA-Z0-9]/.test(contentAfter)) {
          processedText = contentAfter;
          break;
        }
      }
    }

    const textWithoutUrls = processedText.replace(/https?:\/\/\S+/gi, "").replace(/"__IMAGE_URL_\d+__"/g, "");
    const isParagraphPrompt = textWithoutUrls.length > 300 || 
      /đọc (đoạn văn|đoạn hội thoại|bài khóa|bài đọc|đoạn thông tin|cuộc hội thoại|bài)/i.test(textWithoutUrls) ||
      /read the (text|passage|following|conversation|article)/i.test(textWithoutUrls);

    if (isParagraphPrompt) {
      const blankRegex = /([_.‥…\u2026]{2,}|_{2,}|(\.\s*){3,}|\[\s*\]|\(\s*\))/;
      if (element) {
        const boldEls = element.querySelectorAll("strong, b");
        if (boldEls.length > 0) {
          const lastBold = boldEls[boldEls.length - 1];
          const boldTextRaw = (lastBold.textContent || "").replace(/[\u00A0\s]+/g, " ").trim();
          const pTextRaw = processedText.replace(/[\u00A0\s]+/g, " ").trim();
          if (boldTextRaw.length > 15 && pTextRaw.endsWith(boldTextRaw)) {
            return lastBold.textContent.trim();
          }
        }
      }

      const segments = processedText.split(/(?<=[.!?]['"”’]*)\s+(?=[A-Z])/);
      if (segments.length >= 2) {
        const lastSegment = segments[segments.length - 1].trim();
        if (lastSegment.length > 15 && lastSegment.length < 500 && lastSegment.length < processedText.length * 0.5) {
          const qKeywords = /^(Which|What|Who|When|Where|Why|How|Is|Are|Do|Does|Did|Can|Could|It is probable|According to|In paragraph|The passage|The author|The word|The purpose|From|Based on|It can be|The statement|The phrase)/i;
          if (qKeywords.test(lastSegment) || /[?？]/.test(lastSegment) || blankRegex.test(lastSegment)) {
            processedText = lastSegment;
          }
        }
      }
    }

    return processedText;
  }

  async function fetchAPI(url, options = {}) {
    const showNetwork = await new Promise(resolve => {
      chrome.storage.local.get(["hou_show_network_status"], res => {
        resolve(res.hou_show_network_status !== false);
      });
    });

    if (showNetwork) {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } else {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "FETCH_API", url, options }, resolve);
      });
      if (!res || !res.success) throw new Error(res ? res.error : "Không thể kết nối mạng");
      return res.data;
    }
  }

  async function fetchQuestionsForDocuments(docIds) {
    const promises = docIds.map(id => 
      fetchAPI(`${window.houQuizConfig.API_URL}/questions/document/${id}`)
        .then(res => res && res.questions ? res.questions : [])
        .catch(err => {
          console.error(`[HouQuiz] Lỗi tải tài liệu ${id}:`, err);
          return [];
        })
    );
    const results = await Promise.all(promises);
    return results.flat();
  }

  window.houQuizUtils = {
    stripVietnameseDiacritics,
    compareNormalized,
    normalizeTextForMatching,
    getSimilarityScore,
    fetchAPI,
    extractPostAudioQuestionText,
    cleanQuestionContent,
    fetchQuestionsForDocuments
  };
})();
