import { NextResponse } from "next/server";
import {
  buildReportContext,
  reportContextPrompt,
  formatTemplateStyleGuide,
  isUsableParsedOutline,
  adaptOutlineTitleToContext,
  sanitizeOutlineSubsections,
  inferSectionTemplateExpectation,
  isReferenceOnlySection,
  calculateTargetWordsForSection,
  safeParseJson
} from "../utils";
import {
  normalizeReportOutlineSections,
  buildInternshipB49Outline,
  buildCareerOrientationOutline
} from "../outlines";
import {
  buildAgentActivity,
  setReportLunaChatId,
  setReportLunaMessageId
} from "../agentActivity";
import { callLLM } from "../llm";
import { parseOutlineKnowledge } from "../outlineParse";

export async function handleInit(ctx) {
  const {
    body,
    chatId,
    username,
    authToken,
    requestBaseUrl,
    targetModelId,
    reportSession,
    prompts,
    saveAgentState
  } = ctx;

  const {
    userPrompt,
    subject,
    outlineSource,
    runId,
    outlineKnowledge,
    templateKnowledge
  } = body || {};

  if (!userPrompt) {
    return NextResponse.json({ error: "Missing userPrompt for init" }, { status: 400 });
  }

  const reportContext = buildReportContext(userPrompt, subject, outlineSource);
  if (runId) {
    reportContext.runId = runId;
  }

  const outlineKnowledgeText = String(outlineKnowledge || "").trim();
  const templateKnowledgeText = String(templateKnowledge || "").trim();
  let parsedOutline = [];

  if (templateKnowledgeText) {
    const templateStudySystem = prompts.templateStudySystem;
    const templateStudyUser = prompts.getTemplateStudyUser(
      reportContextPrompt(reportContext, 4),
      templateKnowledgeText
    );

    try {
      const templateGuide = await callLLM(
        targetModelId,
        [
          { role: "system", content: templateStudySystem },
          { role: "user", content: templateStudyUser },
        ],
        0.2,
        authToken,
        username,
        requestBaseUrl,
        reportSession,
      );
      reportContext.templateStyleGuide = formatTemplateStyleGuide(templateGuide).slice(0, 7000);
    } catch (templateGuideErr) {
      console.warn("Failed to analyze template style guide:", templateGuideErr.message);
    }
  }

  if (outlineKnowledgeText) {
    const interpretSystemPrompt = prompts.interpretSystemPrompt;
    const interpretUserPrompt = prompts.getInterpretUserPrompt(
      reportContextPrompt(reportContext, 4),
      subject,
      outlineSource,
      outlineKnowledgeText,
      templateKnowledgeText,
      reportContext.templateStyleGuide
    );

    try {
      const llmResult = await callLLM(
        targetModelId,
        [
          { role: "system", content: interpretSystemPrompt },
          { role: "user", content: interpretUserPrompt },
        ],
        0.25,
        authToken,
        username,
        requestBaseUrl,
        reportSession,
      );
      parsedOutline = safeParseJson(llmResult, []);
    } catch (interpretErr) {
      console.warn("Failed to interpret outline knowledge with LLM, trying parser fallback:", interpretErr.message);
      parsedOutline = parseOutlineKnowledge(outlineKnowledgeText, reportContext);
    }

    if (!isUsableParsedOutline(parsedOutline)) {
      parsedOutline = [];
    }
  }

  if (parsedOutline.length === 0) {
    const outlineExample = `[
  {
    "id": "1",
    "title": "Mở đầu",
    "description": "Lý do chọn đề tài, mục tiêu, đối tượng, phạm vi và phương pháp nghiên cứu",
    "subsections": [
      "1. Lý do chọn đề tài",
      "2. Mục tiêu nghiên cứu",
      "3. Đối tượng và phạm vi nghiên cứu",
      "4. Phương pháp nghiên cứu"
    ]
  },
  {
    "id": "2",
    "title": "Chương 1: [Tiêu đề chương lý luận phù hợp với đề tài]",
    "description": "Cơ sở lý luận, khái niệm, vai trò và các tiêu chí đánh giá liên quan đến chủ đề nghiên cứu",
    "subsections": [
      "1.1. [Tiêu mục lý luận thứ nhất]",
      "1.2. [Tiêu mục lý luận thứ hai]",
      "1.3. [Tiêu mục lý luận thứ ba]"
    ]
  },
  {
    "id": "3",
    "title": "Chương 2: [Tiêu đề chương thực trạng tại đơn vị kiến tập]",
    "description": "Phân tích thực trạng hoạt động, số liệu thực tế giai đoạn 2023 - 2025, đánh giá ưu điểm và hạn chế tại đơn vị",
    "subsections": [
      "2.1. Khái quát về đơn vị nghiên cứu",
      "2.2. Phân tích thực trạng chuyên môn thứ nhất",
      "2.3. Phân tích thực trạng chuyên môn thứ hai",
      "2.4. Đánh giá ưu điểm, hạn chế và nguyên nhân"
    ]
  },
  {
    "id": "4",
    "title": "Chương 3: [Tiêu đề chương giải pháp hoàn thiện]",
    "description": "Định hướng phát triển, đề xuất các giải pháp khả thi và kiến nghị nhằm giải quyết hạn chế ở chương 2",
    "subsections": [
      "3.1. Định hướng hoàn thiện hoạt động của đơn vị",
      "3.2. Giải pháp hoàn thiện chuyên môn",
      "3.3. Kiến nghị đối với các cơ quan liên quan"
    ]
  },
  {
    "id": "5",
    "title": "Kết luận",
    "description": "Tổng kết ngắn gọn kết quả nghiên cứu và ý nghĩa thực tiễn",
    "subsections": []
  },
  {
    "id": "6",
    "title": "Danh mục tài liệu tham khảo",
    "description": "Danh sách các văn bản pháp luật, sách, bài báo và nguồn tài liệu tham khảo đã sử dụng",
    "subsections": []
  }
]`;
    const systemPrompt = prompts.getOutlinePlannerSystem(outlineExample);
    const promptMsg = prompts.getOutlinePlannerUser(
      userPrompt,
      subject,
      outlineSource,
      templateKnowledgeText,
      reportContext.templateStyleGuide
    );
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: promptMsg }
    ];

    const llmResult = await callLLM(targetModelId, messages, 0.4, authToken, username, requestBaseUrl, reportSession);
    parsedOutline = safeParseJson(llmResult, reportContext.internshipReport
      ? buildInternshipB49Outline(reportContext)
      : (reportContext.careerOrientationReport
        ? buildCareerOrientationOutline(reportContext)
        : [
          { id: "1", title: "Chương I: Tổng quan", description: "Giới thiệu chung về đề tài", reportContext },
          { id: "2", title: "Chương II: Nội dung chi tiết", description: "Phân tích thực trạng và số liệu", reportContext },
          { id: "3", title: "Chương III: Kết luận & Đề xuất", description: "Tóm tắt các kiến nghị", reportContext }
        ]));
    if (!parsedOutline || !Array.isArray(parsedOutline) || parsedOutline.length === 0) {
      console.warn("Parsed outline is invalid, using default fallback");
      parsedOutline = reportContext.internshipReport
        ? buildInternshipB49Outline(reportContext)
        : (reportContext.careerOrientationReport
          ? buildCareerOrientationOutline(reportContext)
          : [
            { id: "1", title: "Chương I: Tổng quan", description: "Giới thiệu chung về đề tài", reportContext },
            { id: "2", title: "Chương II: Nội dung chi tiết", description: "Phân tích thực trạng và số liệu", reportContext },
            { id: "3", title: "Chương III: Kết luận & Đề xuất", description: "Tóm tắt các kiến nghị", reportContext }
          ]);
    }
  }

  if (reportSession.lunaChatId) {
    reportContext.lunaChatId = reportSession.lunaChatId;
  }
  if (reportSession.lunaMessageId) {
    reportContext.lunaMessageId = reportSession.lunaMessageId;
  }

  parsedOutline = normalizeReportOutlineSections(parsedOutline.map((item) => ({
    ...item,
    title: adaptOutlineTitleToContext(item.title, reportContext),
    subsections: sanitizeOutlineSubsections(item.subsections)
      .map((subsection) => adaptOutlineTitleToContext(subsection, reportContext)),
    reportContext: item.reportContext || reportContext,
  }))).map((item) => ({
    ...item,
    style_guidance: item.style_guidance || inferSectionTemplateExpectation(item, reportContext),
  }));

  if (reportContext.internshipReport || reportContext.careerOrientationReport) {
    parsedOutline = parsedOutline.filter((item) => !isReferenceOnlySection(item));
  }

  const contentSections = parsedOutline.filter((item) => !isReferenceOnlySection(item));
  const sectionsProgress = parsedOutline.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    level: item.level || 1,
    parent_id: item.parent_id || null,
    subsections: item.subsections || [],
    style_guidance: item.style_guidance || inferSectionTemplateExpectation(item, item.reportContext || reportContext),
    reportContext: item.reportContext || reportContext,
    is_reference_section: isReferenceOnlySection(item),
    target_words: calculateTargetWordsForSection(item, reportContext.targetWords, contentSections),
    status: "todo",
    content: "",
    feedback: "",
  }));

  const newState = {
    chat_id: chatId,
    current_step: "OUTLINING",
    current_activity: buildAgentActivity("outline_ready", "Agent đã lập đề cương và đang chờ bạn phê duyệt.", {
      actor: "Report Agent",
      sections: sectionsProgress.length,
    }),
    outline: parsedOutline,
    sections_progress: sectionsProgress,
  };
  setReportLunaChatId(newState, reportSession.lunaChatId);
  setReportLunaMessageId(newState, reportSession.lunaMessageId);

  await saveAgentState(chatId, username, newState);
  return NextResponse.json({ ok: true, state: newState });
}
