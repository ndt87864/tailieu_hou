import { NextResponse } from "next/server";
import { normalizeAgentState, setAgentActivity, setReportLunaChatId, setReportLunaMessageId } from "../agentActivity";
import { buildCareerOrientationOutline, buildInternshipB49Outline } from "../outlines";

export async function handleReloadSection(ctx) {
  const {
    body,
    chatId,
    username,
    currentState,
    invalidateWorkerLease,
    saveAgentState
  } = ctx;

  if (!currentState) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }
  const { sectionId } = body || {};
  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  normalizeAgentState(currentState);
  const progress = currentState.sections_progress || [];
  const section = progress.find((p) => String(p.id) === String(sectionId));
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Invalidate existing worker leases to force takeover/reload safety
  await invalidateWorkerLease({ chatId, username });

  // 1. Ensure reportContext is present & synchronized from currentState/outline if missing
  const activeReportContext =
    section.reportContext ||
    currentState.outline?.find((o) => String(o.id) === String(sectionId))?.reportContext ||
    currentState.outline?.[0]?.reportContext ||
    progress.find((p) => p.reportContext)?.reportContext ||
    null;

  const applyClear = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
  };
  const cleanContext = applyClear(activeReportContext);

  // Reset the target section
  section.status = "todo";
  section.content = "";
  section.feedback = "";
  section.web_sources = [];
  section.activity = null;
  section.activity_history = [];
  section.reportContext = cleanContext;

  // Sync section properties from the approved outline item if available
  const outlineItem = currentState.outline?.find((o) => String(o.id) === String(sectionId));
  if (outlineItem) {
    if (outlineItem.subsections && Array.isArray(outlineItem.subsections)) {
      section.subsections = [...outlineItem.subsections];
    }
    if (outlineItem.title) section.title = outlineItem.title;
    if (outlineItem.description) section.description = outlineItem.description;
    if (outlineItem.style_guidance) section.style_guidance = outlineItem.style_guidance;
    if (outlineItem.target_words) section.target_words = outlineItem.target_words;
  }

  // Reset Luna credentials for this section/chat context
  setReportLunaChatId(currentState, "");
  setReportLunaMessageId(currentState, "");

  // Dynamically sync template subsections for predefined templates (career orientation, B49 internship)
  if (cleanContext?.careerOrientationReport) {
    const template = buildCareerOrientationOutline(cleanContext);
    const templateSection = template.find((t) => String(t.id) === String(section.id));
    if (templateSection) {
      section.subsections = templateSection.subsections || section.subsections || [];
      section.title = templateSection.title || section.title;
      section.description = templateSection.description || section.description;
    }
  } else if (cleanContext?.internshipReport) {
    const template = buildInternshipB49Outline(cleanContext);
    const templateSection = template.find((t) => String(t.id) === String(section.id));
    if (templateSection) {
      section.subsections = templateSection.subsections || section.subsections || [];
      section.title = templateSection.title || section.title;
      section.description = templateSection.description || section.description;
    }
  }

  // Re-activate DRAFTING step
  currentState.current_step = "DRAFTING";
  setAgentActivity(currentState, section, "section_reload_triggered", `Đặt lại mục để tạo lại: ${section.title}`, {
    actor: "User",
    sectionId: section.id,
  });

  await saveAgentState(chatId, username, currentState);
  return NextResponse.json({ ok: true, state: currentState });
}
