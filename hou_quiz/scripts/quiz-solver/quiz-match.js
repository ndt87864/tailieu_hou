(function () {
  "use strict";

  // Hàm so khớp câu hỏi trắc nghiệm theo 2 chiến lược yêu cầu:
  // 1. So khớp câu hỏi + đáp án khớp với database có dữ liệu 'choices'.
  // 2. Nếu không khớp hoặc không có choices, so khớp trực tiếp với 'answer' thay vì qua choices.
  function matchQuestionWithDB(pageQuestion, dbQuestions) {
    const utils = window.houQuizUtils;
    const cleanWebQ = utils.normalizeTextForMatching(pageQuestion.text);
    
    // Tìm các ứng viên có câu hỏi khớp tương đối
    const candidates = dbQuestions.filter(dbQ => {
      const cleanDbQ = utils.normalizeTextForMatching(dbQ.question);
      const isMatch = utils.compareNormalized(cleanWebQ, cleanDbQ);
      if (cleanDbQ.includes("This is a web page for people") || cleanWebQ.includes("This is a web page for people")) {
        console.log("[HouQuiz Debug Match] So sánh:", {
          cleanWebQ,
          cleanDbQ,
          isMatch
        });
      }
      return isMatch;
    });

    if (candidates.length === 0) {
      if (cleanWebQ.includes("This is a web page for people")) {
        console.log("[HouQuiz Debug Match] Không tìm thấy candidates cho câu hỏi này. Thử tìm chứa chuỗi tương tự trong DB:");
        dbQuestions.forEach(dbQ => {
          const cleanDbQ = utils.normalizeTextForMatching(dbQ.question);
          if (cleanDbQ.includes("This is a web page") || cleanDbQ.includes("career centre")) {
            console.log("[HouQuiz Debug Match] DB candidate gần giống:", {
              dbQText: dbQ.question,
              cleanDbQ,
              levenshtein: utils.getSimilarityScore(cleanWebQ, cleanDbQ)
            });
          }
        });
      }
      return null;
    }

    // Sắp xếp ứng viên theo độ tương đồng giảm dần để ưu tiên câu khớp nhất (tránh khớp nhầm câu dài gần giống)
    candidates.sort((a, b) => {
      const simA = utils.getSimilarityScore(cleanWebQ, utils.normalizeTextForMatching(a.question));
      const simB = utils.getSimilarityScore(cleanWebQ, utils.normalizeTextForMatching(b.question));
      return simB - simA;
    });

    // Hàm kiểm tra xem bộ choices trên web và bộ choices trong DB có khớp nhau hay không
    function checkChoicesMatch(webOptions, dbChoices) {
      if (!Array.isArray(webOptions) || !Array.isArray(dbChoices)) return false;
      if (webOptions.length === 0 || dbChoices.length === 0) return false;

      let matchCount = 0;
      for (const webOpt of webOptions) {
        const cleanWebOpt = utils.normalizeTextForMatching(webOpt);
        const found = dbChoices.some(dbOpt => {
          const cleanDbOpt = utils.normalizeTextForMatching(dbOpt);
          return utils.compareNormalized(cleanWebOpt, cleanDbOpt);
        });
        if (found) matchCount++;
      }
      
      // Ngưỡng khớp: ít nhất 75% số lựa chọn
      const threshold = Math.min(webOptions.length, dbChoices.length) * 0.75;
      return matchCount >= threshold;
    }

    // Duyệt qua từng ứng viên đã được sắp xếp theo độ tương đồng giảm dần
    for (const dbQ of candidates) {
      const dbChoices = Array.isArray(dbQ.choices) ? dbQ.choices : [];
      const dbAnswer = String(dbQ.answer || "").trim();
      const isExactQuestion = cleanWebQ === utils.normalizeTextForMatching(dbQ.question);

      // Chiến lược 1: Nếu DB có choices và khớp bộ choices
      if (dbChoices.length > 0 && checkChoicesMatch(pageQuestion.options, dbChoices)) {
        // Tìm xem lựa chọn trên web nào khớp với đáp án đúng
        for (const optionText of pageQuestion.options) {
          const cleanOption = utils.normalizeTextForMatching(optionText);
          if (utils.compareNormalized(cleanOption, dbAnswer)) {
            const isExactAnswer = cleanOption === utils.normalizeTextForMatching(dbAnswer);
            return {
              questionId: dbQ.id,
              dbQuestionText: dbQ.question,
              answerText: dbAnswer,
              matchedOptionText: optionText,
              isExact: isExactQuestion && isExactAnswer,
              matchType: "choices"
            };
          }
        }

        // Khớp qua index ký hiệu a, b, c, d
        const alphabet = ["a", "b", "c", "d", "e", "f"];
        const answerIndex = alphabet.indexOf(dbAnswer.toLowerCase());
        if (answerIndex !== -1 && dbChoices[answerIndex]) {
          const correctChoiceText = dbChoices[answerIndex];
          for (const optionText of pageQuestion.options) {
            const cleanOption = utils.normalizeTextForMatching(optionText);
            if (utils.compareNormalized(cleanOption, correctChoiceText)) {
              const isExactAnswer = cleanOption === utils.normalizeTextForMatching(correctChoiceText);
              return {
                questionId: dbQ.id,
                dbQuestionText: dbQ.question,
                answerText: correctChoiceText,
                matchedOptionText: optionText,
                isExact: isExactQuestion && isExactAnswer,
                matchType: "choices"
              };
            }
          }
        }
      }

      // Chiến lược 2: So khớp trực tiếp với answer (fallback hoặc khi DB không có choices)
      for (const optionText of pageQuestion.options) {
        const cleanOption = utils.normalizeTextForMatching(optionText);
        if (utils.compareNormalized(cleanOption, dbAnswer)) {
          const isExactAnswer = cleanOption === utils.normalizeTextForMatching(dbAnswer);
          return {
            questionId: dbQ.id,
            dbQuestionText: dbQ.question,
            answerText: dbAnswer,
            matchedOptionText: optionText,
            isExact: isExactQuestion && isExactAnswer,
            matchType: "answer"
          };
        }
      }

      // Khớp trực tiếp qua index khi DB có choices
      if (dbChoices.length > 0) {
        const alphabet = ["a", "b", "c", "d", "e", "f"];
        const answerIndex = alphabet.indexOf(dbAnswer.toLowerCase());
        if (answerIndex !== -1 && dbChoices[answerIndex]) {
          const correctChoiceText = dbChoices[answerIndex];
          for (const optionText of pageQuestion.options) {
            const cleanOption = utils.normalizeTextForMatching(optionText);
            if (utils.compareNormalized(cleanOption, correctChoiceText)) {
              const isExactAnswer = cleanOption === utils.normalizeTextForMatching(correctChoiceText);
              return {
                questionId: dbQ.id,
                dbQuestionText: dbQ.question,
                answerText: correctChoiceText,
                matchedOptionText: optionText,
                isExact: isExactQuestion && isExactAnswer,
                matchType: "answer"
              };
            }
          }
        }
      }
    }

    return null;
  }

  // ==================== FILL IN THE BLANK LOGIC ====================
  const BLANK_PATTERNS = [
    /\.{2,}/g,
    /…+/g,
    /_{2,}/g,
    /\[\s*\]/g,
    /\(\s*\)/g,
    /\{\s*\}/g,
    /‥+/g,
    /[\u2026]+/g,
  ];

  function normalizeForBlankComparison(text) {
    if (!text) return "";
    const utils = window.houQuizUtils;
    let normalized = text;
    const moodleUrlPattern = /https?:\/\/[^\s"']+\/pluginfile\.php\/[^\s"']+\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
    normalized = normalized.replace(moodleUrlPattern, '$1');
    const truncatedUrlPattern = /(?:\.){2,}\/([A-Za-z0-9_\-]+\.(?:png|jpe?g|gif|svg|webp|bmp))/gi;
    normalized = normalized.replace(truncatedUrlPattern, '$1');
    const TEMP_PLACEHOLDER = "___BLANK___";

    BLANK_PATTERNS.forEach((pattern) => {
      normalized = normalized.replace(pattern, ` ${TEMP_PLACEHOLDER} `);
    });

    normalized = normalized.replace(/^\s*([a-z]|\d+)[\.\):]\s*/i, "");
    
    // Loại bỏ feedback đáp án dạng [T], [F], [True], [False] thường xuất hiện ở trang xem lại sau input
    normalized = normalized.replace(/\[\s*[T|F|True|False|t|f]\s*\]/gi, "");
    
    normalized = normalized.replace(/[''`´]/g, " ");

    normalized = normalized.replace(
      /"(?:https?:\/\/[^"]+\/|(?:\.){3,}\/)([^"?]+)(?:\?[^"]*)?"/gi,
      (match, filename) => " " + filename + " ",
    );

    normalized = normalized.replace(
      /[^\p{L}\p{N}\s<>=≤≥≠±\+\-\*\/%^|{}\(\)\[\],]/gu,
      " ",
    );

    normalized = normalized.split(TEMP_PLACEHOLDER).join("...");

    normalized = normalized
      .replace(/\s+/g, " ")
      .replace(/\s*\.\.\.\s*/g, " ... ")
      .trim()
      .toLowerCase();

    const questionStarters = /^(do|does|did|is|are|was|were|can|could|will|would|what|when|where|who|why|how)\s+/i;
    if (questionStarters.test(normalized)) {
      if (normalized.endsWith(" ...")) {
        normalized = "... " + normalized.substring(0, normalized.length - 4).trim();
      }
    }

    return normalized;
  }

  function calculateFillBlankSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const words1 = str1.split(/\s+/).filter((w) => w !== "...");
    const words2 = str2.split(/\s+/).filter((w) => w !== "...");

    if (words1.length === 0 && words2.length === 0) return 1.0;
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter((w) => set2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  function areFillBlankSentencesSimilar(sentence1, sentence2) {
    const norm1 = normalizeForBlankComparison(sentence1);
    const norm2 = normalizeForBlankComparison(sentence2);

    if (norm1 === norm2) return true;
    const similarity = calculateFillBlankSimilarity(norm1, norm2);
    return similarity > 0.95;
  }

  function parseNumberedAnswers(answerText) {
    if (!answerText) return [];
    const answers = [];
    const trimmedText = answerText.trim();

    const numberedPattern = /(?:^|[,;\n]\s*)(\d+)\s*[.\):\-]\s*([^,;\n]+)/g;
    let match;
    let hasNumberedFormat = false;

    const startsWithNumber = /^\s*\d+\s*[.\):\-]/.test(trimmedText);

    if (startsWithNumber) {
      while ((match = numberedPattern.exec(trimmedText)) !== null) {
        const idx = parseInt(match[1]);
        const ans = match[2].trim();
        if (idx > 100) continue;
        if (!ans) continue;
        hasNumberedFormat = true;
        answers.push({ index: idx, answer: ans });
      }
    }

    if (!hasNumberedFormat || answers.length === 0) {
      answers.length = 0;
      let parts = [];

      if (trimmedText.includes("\n")) {
        parts = trimmedText.split(/\n+/).map((p) => p.trim()).filter((p) => p);
      } else {
        const listPattern = /^\s*\d+\s*[.\):\-]/;
        if (listPattern.test(trimmedText)) {
          parts = trimmedText.split(/(?=\d+\s*[.\):\-])/).map((p) => p.trim()).filter((p) => p);
        } else {
          const potentialParts = trimmedText.split(/[,;]+/).map((p) => p.trim()).filter((p) => p);
          if (potentialParts.length <= 1 || potentialParts.every((p) => p.length > 30)) {
            parts = [trimmedText];
          } else {
            parts = potentialParts;
          }
        }
      }

      parts.forEach((part, idx) => {
        const numMatch = part.match(/^(\d{1,2})\s*[.\):\-]\s*(.+)$/);
        if (numMatch && parseInt(numMatch[1]) <= 99) {
          answers.push({ index: parseInt(numMatch[1]), answer: numMatch[2].trim() });
        } else {
          answers.push({ index: idx + 1, answer: part.trim() });
        }
      });
    }

    answers.sort((a, b) => a.index - b.index);
    return answers;
  }

  function matchFillBlankQuestion(pageQuestionText, dbQuestions) {
    if (!dbQuestions || dbQuestions.length === 0) return null;
    if (!pageQuestionText || pageQuestionText.length < 5) return null;

    for (const dbQ of dbQuestions) {
      if (!dbQ.question) continue;
      if (areFillBlankSentencesSimilar(pageQuestionText, dbQ.question)) {
        return dbQ;
      }
    }
    return null;
  }

  window.houQuizMatch = {
    matchQuestionWithDB,
    matchFillBlankQuestion,
    parseNumberedAnswers,
    normalizeForBlankComparison
  };
})();
