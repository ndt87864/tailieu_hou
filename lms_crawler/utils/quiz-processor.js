const cheerio = require('cheerio');
const { processHtmlImagesAndUpload, uploadFileToStorage, cleanQuestionText } = require('./db');
const { parseRightAnswers, extractFillBlankSubQuestions, shouldGroupTable, cleanFillBlankQuestionText } = require('./quiz-parser');

/**
 * Process quiz review page and extract questions
 */
async function processQuizReview($review, questionBlocks, getCookieHeader) {
  const questionsToSave = [];

  for (let q = 0; q < questionBlocks.length; q++) {
    const qBlock = questionBlocks[q];
    const qtextEl = $review(qBlock).find(".qtext");
    const qTextHtml = qtextEl.html() || "";

    const { cleanHtml: qTextCleanHtml, uploadedUrls: qImgs } = await processHtmlImagesAndUpload(qTextHtml, getCookieHeader, "question_url");
    const $tempQ = cheerio.load(qTextCleanHtml);
    const qTextClean = cleanQuestionText($tempQ, $tempQ("body"));

    // Detect if this is a fill-in-the-blank question
    const inputElements = $review(qBlock).find('input[type="text"], input:not([type]), textarea, select');
    const isFillBlank = inputElements.length > 0;

    if (isFillBlank) {
      const { subQuestions, rawAnswerImageUrl } = await processFillBlank($review, qBlock, inputElements, getCookieHeader);
      
      subQuestions.forEach((sq) => {
        questionsToSave.push({
          question: sq.question,
          answer: sq.answer,
          choices: [],
          type: "fill_blank",
          url_question: qImgs.length > 0 ? qImgs.join(",") : null,
          url_answer: rawAnswerImageUrl,
          url_choices: null,
          sourceQuestionIndex: q
        });
      });
    } else {
      // Multiple choice - handled by quiz-extractor
      questionsToSave.push({
        question: qTextClean,
        answer: "", // Will be filled by quiz-extractor
        choices: [],
        type: "multiple_choice",
        url_question: qImgs.length > 0 ? qImgs.join(",") : null,
        url_answer: null,
        url_choices: null,
        sourceQuestionIndex: q
      });
    }
  }

  return questionsToSave;
}

/**
 * Process fill-in-the-blank question
 */
async function processFillBlank($review, qBlock, inputElements, getCookieHeader) {
  const parsedRightAnswers = parseRightAnswers($review, qBlock);
  let rawAnswerImageUrl = null;

  // Extract answer images
  const rightAnswerEl = $review(qBlock).find(".outcome .rightanswer, .rightanswer");
  if (rightAnswerEl.length > 0) {
    const aimgs = rightAnswerEl.find("img");
    const ansImgsList = [];
    for (let i = 0; i < aimgs.length; i++) {
      const src = $review(aimgs[i]).attr("src");
      if (src && !src.includes("grade_") && !src.includes("/theme/image.php") && !src.includes("coursemos/core")) {
        try {
          const publicUrl = await uploadFileToStorage(src, "answer_url", getCookieHeader);
          ansImgsList.push(publicUrl);
        } catch (e) {}
      }
    }
    rawAnswerImageUrl = ansImgsList.length > 0 ? ansImgsList.join(",") : null;
  }

  // Use quiz-parser for sub-question extraction
  const tableContainer = $review(qBlock).find("table");
  const shouldGroupTableValue = shouldGroupTable($review, tableContainer);
  const subQuestions = extractFillBlankSubQuestions($review, qBlock, inputElements, parsedRightAnswers, tableContainer, shouldGroupTableValue, cleanQuestionText);

  // Fallback if no sub-questions found
  if (subQuestions.length === 0 && parsedRightAnswers.length > 0) {
    const cloned = $review(qBlock).clone();
    cloned.find('input[type="text"], input:not([type]), textarea, select').replaceWith(" ... ");
    cloned.find(".outcome, .rightanswer, .feedback, .feedbackspan, .generalfeedback, .specificfeedback, .accesshide, .questioncorrectnessicon, .aftergapfeedback").remove();
    let questionText = cleanFillBlankQuestionText(cloned.text());
    
    if (parsedRightAnswers.length > 1) {
      const combinedAnswer = parsedRightAnswers.map(a => `${a.index}.${a.answer}`).join(", ");
      subQuestions.push({ question: questionText, answer: combinedAnswer });
    } else if (parsedRightAnswers.length === 1) {
      subQuestions.push({ question: questionText, answer: parsedRightAnswers[0].answer });
    }
  }

  return { subQuestions, rawAnswerImageUrl };
}

module.exports = {
  processQuizReview,
  processFillBlank
};
