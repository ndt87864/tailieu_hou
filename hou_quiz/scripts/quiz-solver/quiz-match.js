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
      return utils.compareNormalized(cleanWebQ, cleanDbQ);
    });

    if (candidates.length === 0) return null;

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

    // --- GIAI ĐOẠN 1: Ưu tiên tìm câu hỏi trùng khớp cả bộ choices ---
    if (Array.isArray(pageQuestion.options) && pageQuestion.options.length > 0) {
      for (const dbQ of candidates) {
        const dbChoices = Array.isArray(dbQ.choices) ? dbQ.choices : [];
        if (dbChoices.length > 0 && checkChoicesMatch(pageQuestion.options, dbChoices)) {
          const dbAnswer = String(dbQ.answer || "").trim();
          const isExactQuestion = cleanWebQ === utils.normalizeTextForMatching(dbQ.question);

          // 1.1 Khớp qua choices (nếu DB có choices)
          // Tìm xem lựa chọn trên web nào khớp với đáp án đúng (dbAnswer)
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

          // 1.2 Nếu dbAnswer chỉ lưu ký hiệu như "A", "B", "C", "D" hoặc "a", "b", "c", "d"
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
      }
    }

    // --- GIAI ĐOẠN 2: Fallback so khớp theo câu hỏi và đáp án trực tiếp ---
    for (const dbQ of candidates) {
      const dbChoices = Array.isArray(dbQ.choices) ? dbQ.choices : [];
      const dbAnswer = String(dbQ.answer || "").trim();
      const isExactQuestion = cleanWebQ === utils.normalizeTextForMatching(dbQ.question);

      // 2.1 Tìm trực tiếp khớp với answer
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

      // 2.2 Nếu dbAnswer là ký hiệu và DB có choices
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

  window.houQuizMatch = {
    matchQuestionWithDB
  };
})();
