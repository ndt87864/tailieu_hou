const cheerio = require('cheerio');
const { processHtmlImagesAndUpload, uploadFileToStorage, cleanQuestionText } = require('./db');

/**
 * Extract multiple choice question data
 */
async function extractMultipleChoice($review, qBlock, getCookieHeader) {
  const choices = [];
  const choiceImgsList = [];
  const choiceBlocks = $review(qBlock).find(".answer div[class*='r0'], .answer div[class*='r1']");

  for (let c = 0; c < choiceBlocks.length; c++) {
    const imgTags = $review(choiceBlocks[c]).find("img");
    for (let i = 0; i < imgTags.length; i++) {
      const src = $review(imgTags[i]).attr("src");
      if (src && !src.includes("grade_") && !src.includes("/theme/image.php") && !src.includes("coursemos/core")) {
        try {
          const publicUrl = await uploadFileToStorage(src, "images/choice_url", getCookieHeader);
          choiceImgsList.push(publicUrl);
        } catch (e) { }
      }
    }

    const choiceHtml = $review(choiceBlocks[c]).html() || "";
    const { cleanHtml: choiceClean } = await processHtmlImagesAndUpload(choiceHtml, getCookieHeader, "images/choice_url");
    const $temp = cheerio.load(choiceClean);
    $temp("input, span.control").remove();
    $temp("img").each((i, img) => {
      const originalSrc = $temp(img).attr("data-original-src") || $temp(img).attr("src");
      if (originalSrc) {
        const isEhouUrl = /https?:\/\/learning\.ehou\.edu\.vn\/pluginfile\.php/i.test(originalSrc);
        const replacement = isEhouUrl ? ` \"${originalSrc}\" ` : ` ${originalSrc} `;
        $temp(img).replaceWith(replacement);
      } else {
        $temp(img).remove();
      }
    });
    choices.push($temp.text().replace(/\s+/g, " ").trim());
  }

  let rightAnswerText = "";
  const ansImgsList = [];
  let rightAnswerBlock = $review(qBlock).find(".rightanswer");
  if (rightAnswerBlock.length === 0) {
    rightAnswerBlock = $review(qBlock).find(".outcome");
  }
  if (rightAnswerBlock.length > 0) {
    const imgTags = rightAnswerBlock.find("img");
    for (let i = 0; i < imgTags.length; i++) {
      const src = $review(imgTags[i]).attr("src");
      if (src && !src.includes("grade_") && !src.includes("/theme/image.php") && !src.includes("coursemos/core")) {
        try {
          const publicUrl = await uploadFileToStorage(src, "images/answer_url", getCookieHeader);
          ansImgsList.push(publicUrl);
        } catch (e) { }
      }
    }

    const clonedBlock = rightAnswerBlock.clone();
    clonedBlock.find(".feedback, .generalfeedback, .accesshide").remove();
    clonedBlock.find("img").each((i, img) => {
      const src = $review(img).attr("src");
      if (src) {
        $review(img).replaceWith(` ${src} `);
      } else {
        $review(img).remove();
      }
    });
    const rawAns = clonedBlock.text().replace(/\s+/g, " ").trim();
    const match = rawAns.match(/(?:Đáp án đúng là:|The correct answer is:|Câu trả lời đúng là:|The correct answers are:|Các đáp án đúng là:)\s*(.*)/i);
    rightAnswerText = match ? match[1].trim() : rawAns;
    rightAnswerText = rightAnswerText.replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
  }

  if (!rightAnswerText) {
    const correctImg = $review(qBlock).find("img[src*='grade_correct'], img.questioncorrectnessicon, img[alt*='correct']");
    for (let imgIdx = 0; imgIdx < correctImg.length; imgIdx++) {
      const imgEl = correctImg[imgIdx];
      const alt = ($review(imgEl).attr("alt") || "").toLowerCase();
      const title = ($review(imgEl).attr("title") || "").toLowerCase();
      const src = ($review(imgEl).attr("src") || "").toLowerCase();

      const isIncorrect = alt.includes("không") || alt.includes("incorrect") ||
        title.includes("không") || title.includes("incorrect") ||
        src.includes("incorrect") || src.includes("grade_incorrect");

      if (!isIncorrect && (alt.includes("đúng") || alt.includes("correct") || src.includes("grade_correct"))) {
        const matchedChoiceEl = $review(imgEl).closest(".r0, .r1, label, div");
        if (matchedChoiceEl.length > 0) {
          const temp = matchedChoiceEl.clone();
          temp.find("input, span.control, .questioncorrectnessicon").remove();
          temp.find("img").each((i, img) => {
            const imgUrl = $review(img).attr("src") || "";
            if (imgUrl.includes("grade_correct") || imgUrl.includes("grade_incorrect") || imgUrl.includes("questioncorrectnessicon")) {
              $review(img).remove();
            } else {
              const originalSrc = $review(img).attr("data-original-src") || imgUrl;
              if (originalSrc) {
                $review(img).replaceWith(` ${originalSrc} `);
              } else {
                $review(img).remove();
              }
            }
          });
          rightAnswerText = temp.text().trim();
          rightAnswerText = rightAnswerText.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*/u, "").trim();
          break;
        }
      }
    }
  }

  return {
    choices,
    choiceImgsList,
    rightAnswerText,
    ansImgsList
  };
}

/**
 * Extract question text and images
 */
async function extractQuestionText($review, qBlock, getCookieHeader) {
  const qtextEl = $review(qBlock).find(".qtext, .questiontext, .formulation").first();
  if (qtextEl.length === 0) return { questionText: "", qImgs: [] };

  const qtextHtml = qtextEl.html() || "";
  const { cleanHtml, uploadedImages: qImgs } = await processHtmlImagesAndUpload(qtextHtml, getCookieHeader, "images/question_url");
  const $temp = cheerio.load(cleanHtml);
  $temp("script, style, .answer, label, .prompt, .accesshide").remove();
  $temp("img").each((i, img) => {
    const originalSrc = $temp(img).attr("data-original-src") || $temp(img).attr("src");
    if (originalSrc) {
      const isEhouUrl = /https?:\/\/learning\.ehou\.edu\.vn\/pluginfile\.php/i.test(originalSrc);
      const replacement = isEhouUrl ? ` \"${originalSrc}\" ` : ` ${originalSrc} `;
      $temp(img).replaceWith(replacement);
    } else {
      $temp(img).remove();
    }
  });
  const questionText = cleanQuestionText($temp, $temp.root());

  return { questionText, qImgs };
}

module.exports = {
  extractMultipleChoice,
  extractQuestionText
};
