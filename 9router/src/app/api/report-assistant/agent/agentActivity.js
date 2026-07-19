import { normalizeReportOutlineSections } from "./outlines";
import { hasSubstantiveDraftContent } from "./utils";
import { recoverInterruptedDraft, syncReportCompletionState } from "./stateTransitions";

const REPORT_STALE_QUEUED_MS = Number.parseInt(process.env.REPORT_AGENT_STALE_QUEUED_MS || "45000", 10);

export function normalizeAgentState(state) {
  if (!state) return state;

  if (Array.isArray(state.outline)) {
    state.outline = normalizeReportOutlineSections(state.outline);
  }

  let progress = Array.isArray(state.sections_progress) ? state.sections_progress : [];
  const normalizedProgress = normalizeReportOutlineSections(progress);
  if (normalizedProgress.length !== progress.length) {
    state.sections_progress = normalizedProgress;
    progress = state.sections_progress;
  }
  for (let index = 0; index < progress.length; index++) {
    const section = progress[index];
    const normalizedSection = normalizedProgress[index];
    if (normalizedSection?.subsections) {
      section.subsections = normalizedSection.subsections;
    }

    if (section.status === "done" && !hasSubstantiveDraftContent(section.content)) {
      section.status = "todo";
      section.feedback = "Mục từng bị đánh dấu hoàn thành nhưng chưa có nội dung; hệ thống đã đưa lại vào hàng chờ soạn.";
      if (section.activity) {
        section.activity.phase = "empty_done_reset";
        section.activity.message = "Mục này chưa có nội dung báo cáo thật nên đã được đưa lại vào hàng chờ soạn.";
        section.activity.updatedAt = new Date().toISOString();
      }
    }

    if (section.status === "drafting") {
      recoverInterruptedDraft(section, { stale: isStaleQueuedDraft(section) });
    }
  }

  syncReportCompletionState(state);

  return state;
}

export function buildAgentActivity(phase, message, details = {}) {
  return {
    phase,
    message,
    details,
    updatedAt: new Date().toISOString(),
  };
}

export function setAgentActivity(state, section, phase, message, details = {}) {
  const lunaChatId = getReportLunaChatId(state);
  const nextDetails = lunaChatId && details?.lunaChatId === undefined
    ? { ...details, lunaChatId }
    : details;
  const activity = buildAgentActivity(phase, message, nextDetails);
  if (state) state.current_activity = activity;
  if (section) {
    section.activity = activity;
    section.activity_history = [
      ...(Array.isArray(section.activity_history) ? section.activity_history : []),
      activity,
    ].slice(-8);
  }
  return activity;
}

export function getReportLunaChatId(state) {
  const candidates = [
    state?.outline?.[0]?.reportContext?.lunaChatId,
    state?.outline?.[0]?.reportContext?.luna_chat_id,
    state?.sections_progress?.[0]?.reportContext?.lunaChatId,
    state?.sections_progress?.[0]?.reportContext?.luna_chat_id,
    state?.current_activity?.details?.lunaChatId,
    state?.current_activity?.details?.luna_chat_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function getReportLunaMessageId(state) {
  const candidates = [
    state?.outline?.[0]?.reportContext?.lunaMessageId,
    state?.outline?.[0]?.reportContext?.luna_message_id,
    state?.sections_progress?.[0]?.reportContext?.lunaMessageId,
    state?.sections_progress?.[0]?.reportContext?.luna_message_id,
    state?.current_activity?.details?.lunaMessageId,
    state?.current_activity?.details?.luna_message_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function setReportLunaChatId(state, lunaChatId) {
  const clean = typeof lunaChatId === "string" ? lunaChatId.trim() : "";
  if (!state || !clean) return state;

  const apply = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaChatId: clean };
  };

  if (Array.isArray(state.outline)) {
    state.outline = state.outline.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (Array.isArray(state.sections_progress)) {
    state.sections_progress = state.sections_progress.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (state.current_activity && typeof state.current_activity === "object") {
    const details = state.current_activity.details && typeof state.current_activity.details === "object"
      ? { ...state.current_activity.details, lunaChatId: clean }
      : { lunaChatId: clean };
    state.current_activity = { ...state.current_activity, details };
  }

  return state;
}

export function setReportLunaMessageId(state, lunaMessageId) {
  const clean = typeof lunaMessageId === "string" ? lunaMessageId.trim() : "";
  if (!state || !clean) return state;

  const apply = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaMessageId: clean };
  };

  if (Array.isArray(state.outline)) {
    state.outline = state.outline.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (Array.isArray(state.sections_progress)) {
    state.sections_progress = state.sections_progress.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: apply(item.reportContext) }
      : item);
  }

  if (state.current_activity && typeof state.current_activity === "object") {
    const details = state.current_activity.details && typeof state.current_activity.details === "object"
      ? { ...state.current_activity.details, lunaMessageId: clean }
      : { lunaMessageId: clean };
    state.current_activity = { ...state.current_activity, details };
  }

  return state;
}

export function getActivityTimeMs(activity) {
  const time = Date.parse(activity?.updatedAt || "");
  return Number.isFinite(time) ? time : 0;
}

export function isStaleQueuedDraft(section) {
  if (!section || section.status !== "drafting") return false;
  const phase = section.activity?.phase || "";
  if (!["section_queued", "section_queued_retry", "section_started"].includes(phase)) return false;
  const updatedAt = getActivityTimeMs(section.activity);
  if (!updatedAt) return true;
  const staleMs = Number.isFinite(REPORT_STALE_QUEUED_MS) && REPORT_STALE_QUEUED_MS > 0
    ? REPORT_STALE_QUEUED_MS
    : 45000;
  return Date.now() - updatedAt > staleMs;
}

export function hasStateChanged(beforeState, afterState) {
  return JSON.stringify({
    current_step: beforeState?.current_step,
    current_activity: beforeState?.current_activity,
    sections_progress: beforeState?.sections_progress,
  }) !== JSON.stringify({
    current_step: afterState?.current_step,
    current_activity: afterState?.current_activity,
    sections_progress: afterState?.sections_progress,
  });
}
