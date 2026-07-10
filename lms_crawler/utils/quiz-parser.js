const cheerio = require('cheerio');

/**
 * Parse right answers from fill-in-the-blank question
 */
function parseRightAnswers($review, qBlock) {
  const parsedRightAnswers = [];
  const rightAnswerEl = $review(qBlock).find('.rightanswer').first();
  
  if (rightAnswerEl.length > 0) {
    const answerText = rightAnswerEl.text();
    // Pattern: "1. answer1, 2. answer2" or "answer1, answer2"
    const answerPattern = /(\d+)\.\s*([^,\n]+)/g;
    let match;
    while ((match = answerPattern.exec(answerText)) !== null) {
      parsedRightAnswers.push({
        index: parseInt(match[1]),
        answer: match[2].trim()
      });
    }
    
    // If no numbered pattern, try comma-separated
    if (parsedRightAnswers.length === 0) {
      const parts = answerText.split(',').map(p => p.trim());
      parts.forEach((part, idx) => {
        if (part) {
          parsedRightAnswers.push({ index: idx + 1, answer: part });
        }
      });
    }
  }
  
  return parsedRightAnswers;
}

/**
 * Extract fill-in-the-blank sub-questions using hou_quiz approach
 */
function extractFillBlankSubQuestions($review, qBlock, inputElements, parsedRightAnswers, tableContainer, shouldGroupTable) {
  const subQuestions = [];
  const seenTexts = new Set();
  
  if (parsedRightAnswers.length === 0) return subQuestions;
  
  // Get prefix instruction text from qtext/formulation
  const qtextEl = $review(qBlock).find(".qtext, .questiontext, .formulation").first();
  let prefixInstructionText = "";
  if (qtextEl.length > 0) {
    const clonedQText = qtextEl.clone();
    clonedQText.find("table, ul, ol, .feedback, .feedbackspan, .accesshide, .questioncorrectnessicon, .aftergapfeedback").remove();
    clonedQText.find('input[type="text"], input:not([type]), textarea, select').remove();
    prefixInstructionText = clonedQText.text().replace(/\s+/g, " ").trim();
    prefixInstructionText = prefixInstructionText.replace(/^mô tả câu hỏi/i, "").trim();
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
    cloned.find('input[type="text"], input:not([type]), textarea, select').each((i, inp) => {
      $review(inp).replaceWith(" ... ");
    });
    cloned.find(".feedback, .feedbackspan, .accesshide, .questioncorrectnessicon, .aftergapfeedback").remove();
    
    let text = cloned.text().replace(/\s+/g, " ").trim();
    text = text.replace(/\[\s*[^\]]+\s*\]/g, "").trim();
    text = text.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, "").trim();
    
    // If text is too short, prepend prefix instruction
    const cleanCheck = text.replace(/[\s\.]/g, "");
    if (cleanCheck.length < 5 && prefixInstructionText.length > 2) {
      text = prefixInstructionText + " " + text;
    }
    
    // Create sub-questions for each input in this container
    containerInputs.forEach(({ idx }) => {
      const ans = parsedRightAnswers[idx] || parsedRightAnswers.find(a => a.index === idx + 1);
      if (ans) {
        const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
        if (!seenTexts.has(norm)) {
          seenTexts.add(norm);
          subQuestions.push({
            question: text,
            answer: ans.answer
          });
        }
      }
    });
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
    const rowInputs = $review(row).find('input[type="text"], input:not([type)], textarea, select');
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
  extractFillBlankSubQuestions,
  shouldGroupTable
};
