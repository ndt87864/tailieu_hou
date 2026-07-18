import { describe, expect, it } from "vitest";
import {
  applyCriticDecision,
  recoverInterruptedDraft,
  syncReportCompletionState,
} from "../../src/app/api/report-assistant/agent/stateTransitions.js";

describe("report assistant state transitions", () => {
  it("preserves review_required and blocks completion", () => {
    const state = { current_step: "DRAFTING", sections_progress: [{ id: "1", status: "review_required" }] };
    syncReportCompletionState(state);
    expect(state.current_step).toBe("REVIEW_REQUIRED");
    expect(state.sections_progress[0].status).toBe("review_required");
  });

  it("completes only when every section is done", () => {
    const state = { current_step: "DRAFTING", sections_progress: [{ status: "done" }, { status: "done" }] };
    syncReportCompletionState(state);
    expect(state.current_step).toBe("COMPLETED");
  });

  it("does not complete while a section remains todo", () => {
    const state = { current_step: "DRAFTING", sections_progress: [{ status: "done" }, { status: "todo" }] };
    syncReportCompletionState(state);
    expect(state.current_step).toBe("DRAFTING");
  });

  it("stores rejected critic output for review", () => {
    const state = { current_step: "DRAFTING", sections_progress: [{ id: "section-1", status: "drafting" }] };
    applyCriticDecision(state, "section-1", {
      approved: false,
      content: "Ban nhap",
      feedback: "REJECTED Can bo sung nguon",
      webSources: [{ url: "https://example.com" }],
    });
    expect(state.current_step).toBe("REVIEW_REQUIRED");
    expect(state.sections_progress[0]).toMatchObject({
      status: "review_required",
      content: "Ban nhap",
      feedback: "Can bo sung nguon",
    });
  });

  it("marks approved critic output done and clears feedback", () => {
    const state = { current_step: "DRAFTING", sections_progress: [{ id: 1, status: "drafting", feedback: "old" }] };
    applyCriticDecision(state, 1, {
      approved: true,
      content: "Noi dung dat yeu cau",
      feedback: "APPROVED",
      webSources: [],
    });
    expect(state.sections_progress[0]).toMatchObject({ status: "done", feedback: "" });
  });

  it("recovers interrupted content for review without losing sources", () => {
    const sources = [{ url: "https://example.com/source" }];
    const section = {
      status: "drafting",
      content: "Ban nhap dang viet",
      web_sources: sources,
      activity: { phase: "drafting_content" },
    };

    recoverInterruptedDraft(section, { stale: true, now: "2026-07-18T00:00:00.000Z" });

    expect(section).toMatchObject({
      status: "review_required",
      content: "Ban nhap dang viet",
      web_sources: sources,
      activity: {
        phase: "interrupted_draft_recovered",
        updatedAt: "2026-07-18T00:00:00.000Z",
      },
    });
    expect(section.feedback).toContain("gián đoạn");
  });

  it("keeps an empty non-stale draft in progress", () => {
    const section = { status: "drafting", content: "", activity: { phase: "section_started" } };
    recoverInterruptedDraft(section, { stale: false });
    expect(section.status).toBe("drafting");
  });

  it("returns an empty stale draft to the queue", () => {
    const section = {
      status: "drafting",
      content: "",
      feedback: "old",
      activity: { phase: "section_started" },
    };
    recoverInterruptedDraft(section, { stale: true, now: "2026-07-18T00:00:00.000Z" });
    expect(section).toMatchObject({
      status: "todo",
      feedback: "",
      activity: { phase: "stale_reset" },
    });
  });

  it("does not change an already completed section", () => {
    const section = { status: "done", content: "Noi dung hoan chinh" };
    recoverInterruptedDraft(section, { stale: true });
    expect(section).toEqual({ status: "done", content: "Noi dung hoan chinh" });
  });
});
