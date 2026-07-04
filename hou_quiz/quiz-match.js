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

    // Duyệt qua từng ứng viên trong DB để tìm match theo choices hoặc answer
    for (const dbQ of candidates) {
      const dbChoices = Array.isArray(dbQ.choices) ? dbQ.choices : [];
      const dbAnswer = String(dbQ.answer || "").trim();

      // Chiến lược 1: Khớp qua choices (nếu DB có choices)
      if (dbChoices.length > 0) {
        // 1.1 Tìm xem lựa chọn trên web nào khớp với đáp án đúng (dbAnswer)
        for (const optionText of pageQuestion.options) {
          const cleanOption = utils.normalizeTextForMatching(optionText);
          if (utils.compareNormalized(cleanOption, dbAnswer)) {
            return {
              questionId: dbQ.id,
              answerText: dbAnswer,
              matchedOptionText: optionText
            };
          }
        }

        // 1.2 Nếu dbAnswer chỉ lưu ký hiệu như "A", "B", "C", "D" hoặc "a", "b", "c", "d"
        // Ta cần tìm xem dbAnswer tương ứng với choice thứ mấy
        const alphabet = ["a", "b", "c", "d", "e", "f"];
        const answerIndex = alphabet.indexOf(dbAnswer.toLowerCase());
        if (answerIndex !== -1 && dbChoices[answerIndex]) {
          const correctChoiceText = dbChoices[answerIndex];
          for (const optionText of pageQuestion.options) {
            const cleanOption = utils.normalizeTextForMatching(optionText);
            if (utils.compareNormalized(cleanOption, correctChoiceText)) {
              return {
                questionId: dbQ.id,
                answerText: correctChoiceText,
                matchedOptionText: optionText
              };
            }
          }
        }
      }

      // Chiến lược 2: Fallback tìm trực tiếp khớp với answer
      for (const optionText of pageQuestion.options) {
        const cleanOption = utils.normalizeTextForMatching(optionText);
        if (utils.compareNormalized(cleanOption, dbAnswer)) {
          return {
            questionId: dbQ.id,
            answerText: dbAnswer,
            matchedOptionText: optionText
          };
        }
      }
    }

    return null;
  }

  window.houQuizMatch = {
    matchQuestionWithDB
  };
})();
