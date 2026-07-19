import { NextResponse } from "next/server";
import { normalizeAgentState, setAgentActivity } from "../agentActivity";
import { buildCareerOrientationOutline } from "../outlines";

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

  // Reset the target section
  section.status = "todo";
  section.content = "";
  section.feedback = "";
  section.web_sources = [];
  section.activity = null;
  section.activity_history = [];

  // Reset Luna credentials for this section/chat context if any
  const applyClear = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
  };
  section.reportContext = applyClear(section.reportContext);

  // Dynamically sync template subsections for career orientation reports on reload
  if (section.reportContext?.careerOrientationReport) {
    const template = buildCareerOrientationOutline(section.reportContext);
    const templateSection = template.find((t) => String(t.id) === String(section.id));
    if (templateSection) {
      section.subsections = templateSection.subsections || [];
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
