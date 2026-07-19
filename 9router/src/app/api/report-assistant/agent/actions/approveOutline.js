import { NextResponse } from "next/server";
import {
  isReferenceOnlySection,
  adaptOutlineTitleToContext,
  sanitizeOutlineSubsections,
  inferSectionTemplateExpectation,
  calculateTargetWordsForSection
} from "../utils";
import { normalizeReportOutlineSections } from "../outlines";
import { setAgentActivity } from "../agentActivity";

export async function handleApproveOutline(ctx) {
  const {
    body,
    chatId,
    username,
    currentState,
    saveAgentState
  } = ctx;

  const { outline } = body || {};

  if (!currentState) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }

  const approvedOutline = normalizeReportOutlineSections(outline || currentState.outline);
  const contentSectionsApproved = approvedOutline.filter((item) => !isReferenceOnlySection(item));
  const sectionsProgress = approvedOutline.map((item) => {
    const existing = (currentState.sections_progress || []).find((p) => String(p.id) === String(item.id));
    const reportContext = item.reportContext || existing?.reportContext || currentState.outline?.[0]?.reportContext || null;
    const isRefSection = isReferenceOnlySection(item);
    return {
      id: item.id,
      title: adaptOutlineTitleToContext(item.title, reportContext),
      description: item.description || item.title,
      level: item.level || existing?.level || 1,
      parent_id: item.parent_id || existing?.parent_id || null,
      subsections: sanitizeOutlineSubsections(item.subsections || existing?.subsections || [])
        .map((subsection) => adaptOutlineTitleToContext(subsection, reportContext)),
      style_guidance: item.style_guidance || existing?.style_guidance || inferSectionTemplateExpectation(item, reportContext),
      reportContext,
      is_reference_section: isRefSection,
      target_words: isRefSection
        ? 0
        : (existing?.target_words || calculateTargetWordsForSection(item, reportContext?.targetWords, contentSectionsApproved)),
      status: existing ? existing.status : "todo",
      content: existing ? existing.content : "",
      feedback: existing ? existing.feedback : "",
    };
  });

  const newState = {
    ...currentState,
    current_step: "DRAFTING",
    outline: approvedOutline,
    sections_progress: sectionsProgress,
  };
  setAgentActivity(newState, null, "drafting_queue_ready", "Agent đã nhận đề cương, chuẩn bị soạn từng mục.", {
    actor: "Report Agent",
    sections: sectionsProgress.length,
  });

  await saveAgentState(chatId, username, newState);
  return NextResponse.json({ ok: true, state: newState });
}
