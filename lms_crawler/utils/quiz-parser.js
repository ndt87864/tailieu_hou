const cheerio = require('cheerio');

function stripRightAnswerPrefix(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^The correct answer is:\s*/i, "")
    .replace(/^Đáp án đúng là:\s*/i, "")
    .replace(/^Câu trả lời đúng là:\s*/i, "")
    .replace(/^The correct answers are:\s*/i, "")
    .replace(/^Các đáp án đúng là:\s*/i, "")
    .replace(/[\u2713\u2714\u2611\u2705]/g, "")
    .trim();
}

function parseNumberedAnswers(answerText) {
  if (!answerText) return [];
  const answers = [];
  const trimmedText = stripRightAnswerPrefix(answerText);

  const numberedPattern = /(?:^|[,;\n]\s*)(\d+)\s*[.\):\-]\s*([^,;\n]+)/g;
  let match;
  let hasNumberedFormat = false;

  const startsWithNumber = /^\s*\d+\s*[.\):\-]/.test(trimmedText);

  if (startsWithNumber) {
    while ((match = numberedPattern.exec(trimmedText)) !== null) {
      const idx = parseInt(match[1], 10);
      const ans = stripRightAnswerPrefix(match[2]);
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
      parts = trimmedText.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    } else {
      const listPattern = /^\s*\d+\s*[.\):\-]/;
      if (listPattern.test(trimmedText)) {
        parts = trimmedText.split(/(?=\d+\s*[.\):\-])/).map((p) => p.trim()).filter(Boolean);
      } else {
        const potentialParts = trimmedText.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
        if (potentialParts.length <= 1 || potentialParts.every((p) => p.length > 30)) {
          parts = [trimmedText];
        } else {
          parts = potentialParts;
        }
      }
    }

    parts.forEach((part, idx) => {
      const numMatch = part.match(/^(\d{1,2})\s*[.\):\-]\s*(.+)$/);
      if (numMatch && parseInt(numMatch[1], 10) <= 99) {
        answers.push({ index: parseInt(numMatch[1], 10), answer: stripRightAnswerPrefix(numMatch[2]) });
      } else {
        const answer = stripRightAnswerPrefix(part);
        if (answer) answers.push({ index: idx + 1, answer });
      }
    });
  }

  answers.sort((a, b) => a.index - b.index);
  return answers;
}

/**
 * Parse right answers from fill-in-the-blank question
 */
function parseRightAnswers($review, qBlock) {
  const rightAnswerEl = $review(qBlock).find('.outcome .rightanswer, .rightanswer').first();
  
  if (rightAnswerEl.length > 0) {
    return parseNumberedAnswers(rightAnswerEl.text());
  }
  
  return [];
}

function getInputValue($review, input) {
  const tagName = String(input.tagName || input.name || "").toLowerCase();
  if (tagName === "select") {
    const selected = $review(input).find("option[selected]").first();
    const option = selected.length > 0 ? selected : $review(input).find("option").first();
    return stripRightAnswerPrefix(option.text() || option.attr("value") || "");
  }
  return stripRightAnswerPrefix($review(input).attr("value") || "");
}

function cleanFillBlankQuestionText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^mô tả câu hỏi/i, "")
    .replace(/^câu hỏi \d+\s*chưa trả lời/i, "")
    .replace(/^câu hỏi \d+\s*đạt điểm\s*[\d\.,]+/i, "")
    .replace(/^câu hỏi \d+\s*đã trả lời/i, "")
    .replace(/^câu hỏi \d+\s*đúng/i, "")
    .replace(/^câu hỏi \d+\s*sai/i, "")
    .replace(/\[\s*[^\]]+\s*\]/g, "")
    .replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s*/u, "")
    .trim();
}

function getAnswerForInput(parsedRightAnswers, inputIndex, fallbackValue) {
  const byIndex = parsedRightAnswers.find(a => a.index === inputIndex + 1);
  const byPosition = parsedRightAnswers[inputIndex];
  const answer = (byIndex && byIndex.answer) || (byPosition && byPosition.answer) || fallbackValue || "";
  return stripRightAnswerPrefix(answer);
}

function formatFillBlankAnswers(answers) {
  const cleanAnswers = answers.filter(a => a && a.answer);
  if (cleanAnswers.length === 0) return "";
  if (cleanAnswers.length === 1) return cleanAnswers[0].answer;
  return cleanAnswers.map(a => `${a.index}.${a.answer}`).join(", ");
}

/**
 * Extract fill-in-the-blank sub-questions using hou_quiz approach
 */
function extractFillBlankSubQuestions($review, qBlock, inputElements, parsedRightAnswers, tableContainer, shouldGroupTable, cleanQuestionTextFn) {
  const subQuestions = [];
  const seenTexts = new Set();
  
  // Get prefix instruction text from qtext/formulation
  const qtextEl = $review(qBlock).find(".qtext, .questiontext, .formulation").first();
  let prefixInstructionText = "";
  if (qtextEl.length > 0) {
    const clonedQText = qtextEl.clone();
    clonedQText.find("table, ul, ol, .outcome, .rightanswer, .feedback, .feedbackspan, .generalfeedback, .specificfeedback, .accesshide, .questioncorrectnessicon, .aftergapfeedback").remove();
    clonedQText.find('input[type="text"], input:not([type]), textarea, select').remove();
    
    if (typeof cleanQuestionTextFn === "function") {
      prefixInstructionText = cleanQuestionTextFn($review, clonedQText);
    } else {
      prefixInstructionText = cleanFillBlankQuestionText(clonedQText.text());
    }
  }
  
  // Group inputs by container
  const containerMap = new Map();
  inputElements.each((idx, input) => {
    let container = null;
    if (shouldGroupTable && tableContainer.length > 0 && tableContainer.has(input)) {
      container = tableContainer;
    } else {
      container = $review(input).closest("tr");
      if (container.length === 0) container = $review(input).closest("li");
      if (container.length === 0) container = $review(input).closest("p");
      if (container.length === 0) container = $review(input).closest("div");
      if (container.length === 0 || container.is($review(qBlock))) {
        container = $review(input).parent();
      }
    }
    
    if (container && container.length > 0) {
      const containerKey = container.html() || container.text();
      if (!containerMap.has(containerKey)) {
        containerMap.set(containerKey, { element: container, inputs: [] });
      }
      containerMap.get(containerKey).inputs.push({ idx, input });
    }
  });
  
  // Extract text for each container
  containerMap.forEach(({ element, inputs: containerInputs }) => {
    const cloned = element.clone();
    cloned.find('input[type="text"], input:not([type]), textarea, select').replaceWith(" ... ");
    cloned.find(".outcome, .rightanswer, .feedback, .feedbackspan, .generalfeedback, .specificfeedback, .accesshide, .questioncorrectnessicon, .aftergapfeedback").remove();
    
    let text = cleanFillBlankQuestionText(cloned.text());
    
    // If text is too short, prepend prefix instruction
    const cleanCheck = text.replace(/[\s\.]/g, "");
    if (cleanCheck.length < 5 && prefixInstructionText.length > 2) {
      text = prefixInstructionText + " " + text;
    }
    
    const answers = containerInputs.map(({ idx, input }, localIdx) => {
      const fallbackValue = getInputValue($review, input);
      const rawAnswer = getAnswerForInput(parsedRightAnswers, idx, fallbackValue);
      
      // Xử lý thông minh dấu mũi tên -> cho câu hỏi matching
      let answer = rawAnswer;
      let questionOverrideText = null;
      if (rawAnswer && (rawAnswer.includes("->") || rawAnswer.includes("—>") || rawAnswer.includes("-->") || rawAnswer.toLowerCase().includes(" to "))) {
        const parts = rawAnswer.split(/->|—>|-->|\s+to\s+/i);
        if (parts.length === 2) {
          const leftSide = parts[0].trim().replace(/^[a-zA-Z0-9]\s*[\.\)\-:\/]\s*/u, "").trim();
          const rightSide = parts[1].trim();
          
          // So khớp thử phần bên trái với text hiện tại của câu hỏi
          const cleanText = text.replace(/^[a-zA-Z0-9]\s*[\.\)\-:\/]\s*/u, "").replace(/\s*\.\.\.\s*$/, "").trim();
          if (cleanText.toLowerCase().includes(leftSide.toLowerCase()) || leftSide.toLowerCase().includes(cleanText.toLowerCase())) {
            answer = rightSide;
            questionOverrideText = leftSide;
          }
        }
      }
      
      if (questionOverrideText) {
        text = questionOverrideText + " ...";
      }

      return answer ? { index: parsedRightAnswers.length > 0 ? idx + 1 : localIdx + 1, answer } : null;
    }).filter(Boolean);

    const answerText = formatFillBlankAnswers(answers);
    if (text && answerText) {
      const norm = `${text.toLowerCase().replace(/\s+/g, " ").trim()}||${answerText.toLowerCase()}`;
      if (!seenTexts.has(norm)) {
        seenTexts.add(norm);
        subQuestions.push({
          question: text,
          answer: answerText
        });
      }
    }
  });
  
  return subQuestions;
}

/**
 * Check if table should be grouped for fill-in-the-blank
 */
function shouldGroupTable($review, tableContainer) {
  if (!tableContainer || tableContainer.length === 0) return false;
  
  const rows = Array.from(tableContainer.find("tr"));
  let emptyOrDotRows = 0;
  let totalRowsWithInput = 0;
  
  rows.forEach(row => {
    const rowInputs = $review(row).find('input[type="text"], input:not([type]), textarea, select');
    if (rowInputs.length > 0) {
      totalRowsWithInput++;
      const clonedRow = $review(row).clone();
      clonedRow.find('input[type="text"], input:not([type]), textarea, select').remove();
      clonedRow.find(".feedback, .feedbackspan, .accesshide, .questioncorrectnessicon, .aftergapfeedback").remove();
      const cleanText = clonedRow.text().replace(/[\s\.]/g, "");
      if (cleanText.length < 5) {
        emptyOrDotRows++;
      }
    }
  });
  
  return totalRowsWithInput > 0 && (emptyOrDotRows / totalRowsWithInput) > 0.6;
}

module.exports = {
  parseRightAnswers,
  parseNumberedAnswers,
  stripRightAnswerPrefix,
  cleanFillBlankQuestionText,
  extractFillBlankSubQuestions,
  shouldGroupTable
};
