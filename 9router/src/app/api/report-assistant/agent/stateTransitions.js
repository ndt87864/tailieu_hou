export function syncReportCompletionState(state) {
  if (!state || state.current_step === "CANCELLED") return state;

  const sections = Array.isArray(state.sections_progress) ? state.sections_progress : [];
  if (sections.length > 0 && sections.every((section) => section.status === "done")) {
    state.current_step = "COMPLETED";
  } else if (sections.some((section) => section.status === "review_required")) {
    state.current_step = "REVIEW_REQUIRED";
  }
  return state;
}

export function applyCriticDecision(state, sectionId, { approved, content, feedback, webSources }) {
  const section = state?.sections_progress?.find(
    (candidate) => String(candidate.id) === String(sectionId),
  );
  if (!section) return null;

  section.content = content;
  section.web_sources = webSources;
  section.status = approved ? "done" : "review_required";
  section.feedback = approved ? "" : String(feedback || "").replace(/^REJECTED\s*/i, "").trim();
  if (!approved) state.current_step = "REVIEW_REQUIRED";
  return section;
}

export function recoverInterruptedDraft(section, { stale = false, now = new Date().toISOString() } = {}) {
  if (!section || section.status !== "drafting") return section;

  if (String(section.content || "").trim()) {
    section.status = "review_required";
    section.feedback = section.feedback || "Bản nháp bị gián đoạn trước khi hoàn tất kiểm định. Vui lòng xem lại hoặc tạo lại mục này.";
    section.activity = {
      ...(section.activity || {}),
      phase: "interrupted_draft_recovered",
      message: "Đã phục hồi bản nháp bị gián đoạn để người dùng xem lại.",
      updatedAt: now,
    };
  } else if (stale) {
    section.status = "todo";
    section.feedback = "";
    if (section.activity) {
      section.activity.phase = "stale_reset";
      section.activity.message = "Mục này bị kẹt và đã tự động được đặt lại trạng thái chờ soạn thảo.";
      section.activity.updatedAt = now;
    }
  }

  return section;
}
