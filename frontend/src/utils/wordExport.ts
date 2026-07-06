import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { cleanQuestionText } from "./questionHelper.js";

interface Question {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  choices: string[];
  url_question?: string | null;
  url_answer?: string | null;
  order_index: number;
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return buffer;
  } catch (error) {
    console.error("Failed to fetch image buffer from url:", url, error);
    return null;
  }
}

export async function exportQuestionsToWord(
  questions: Question[],
  documentTitle: string
): Promise<void> {
  const paragraphs: Paragraph[] = [];

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];

    // 1. Question title: Câu X: question text
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Câu ${idx + 1}: ${cleanQuestionText(q.question, !!q.url_question)}`, bold: true }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // 2. Question image (if present)
    if (q.url_question) {
      const imgBuffer = await fetchImageBuffer(q.url_question);
      if (imgBuffer) {
        const imgType = q.url_question.toLowerCase().includes(".jpg") || q.url_question.toLowerCase().includes(".jpeg") ? "jpg" : "png";
        paragraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: { width: 320, height: 180 },
                type: imgType as "png" | "jpg" | "gif"
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    }

    // 3. Choices (if present)
    if (q.choices && q.choices.length > 0) {
      q.choices.forEach((choice, cIdx) => {
        const choiceLetter = String.fromCharCode(65 + cIdx); // A, B, C, D...
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${choiceLetter}. ${choice}` }),
            ],
            indent: { left: 360 }, // indent slightly for choices
            spacing: { after: 60 },
          })
        );
      });
    }

    // 4. Correct answer: Đáp án đúng: answer text
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Đáp án đúng: ${cleanQuestionText(q.answer, !!q.url_answer)}`, bold: true }),
        ],
        spacing: { before: 100, after: 100 },
      })
    );

    // 5. Answer image (if present)
    if (q.url_answer) {
      const imgBuffer = await fetchImageBuffer(q.url_answer);
      if (imgBuffer) {
        const imgType = q.url_answer.toLowerCase().includes(".jpg") || q.url_answer.toLowerCase().includes(".jpeg") ? "jpg" : "png";
        paragraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: { width: 320, height: 180 },
                type: imgType as "png" | "jpg" | "gif"
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    } else {
      paragraphs.push(
        new Paragraph({
          children: [],
          spacing: { after: 200 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: documentTitle.toUpperCase(),
                bold: true,
                size: 32,
              }),
            ],
            spacing: { after: 400 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${documentTitle}.docx`);
}
