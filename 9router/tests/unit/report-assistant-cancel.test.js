import { describe, expect, it, vi } from "vitest";
import { handleCancel } from "../../src/app/api/report-assistant/agent/actions/cancel.js";

describe("report assistant cancel action handler", () => {
  it("transitions drafting section with content to review_required and clears lease", async () => {
    const currentState = {
      username: "testuser",
      current_step: "DRAFTING",
      sections_progress: [
        { id: "sec-1", status: "done", content: "Completed content" },
        { id: "sec-2", status: "drafting", content: "Some partial draft content" },
        { id: "sec-3", status: "todo", content: "" }
      ]
    };

    const invalidateWorkerLease = vi.fn().mockResolvedValue(true);
    const saveAgentState = vi.fn().mockResolvedValue(true);

    const ctx = {
      chatId: "chat-123",
      username: "testuser",
      currentState,
      invalidateWorkerLease,
      saveAgentState
    };

    const response = await handleCancel(ctx);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.state.current_step).toBe("CANCELLED");
    expect(body.state.cancelled_at).toBeDefined();

    // Check sections progress
    const sec1 = body.state.sections_progress.find(s => s.id === "sec-1");
    const sec2 = body.state.sections_progress.find(s => s.id === "sec-2");
    const sec3 = body.state.sections_progress.find(s => s.id === "sec-3");

    expect(sec1.status).toBe("done");
    // Should be review_required and have feedback, not "done" or "cancelled"
    expect(sec2.status).toBe("review_required");
    expect(sec2.feedback).toContain("gián đoạn");
    expect(sec3.status).toBe("todo");

    expect(invalidateWorkerLease).toHaveBeenCalledWith({ chatId: "chat-123", username: "testuser" });
    expect(saveAgentState).toHaveBeenCalledWith("chat-123", "testuser", currentState);
  });

  it("transitions drafting section without content to cancelled and clears lease", async () => {
    const currentState = {
      username: "testuser",
      current_step: "DRAFTING",
      sections_progress: [
        { id: "sec-1", status: "drafting", content: "" }
      ]
    };

    const invalidateWorkerLease = vi.fn().mockResolvedValue(true);
    const saveAgentState = vi.fn().mockResolvedValue(true);

    const ctx = {
      chatId: "chat-123",
      username: "testuser",
      currentState,
      invalidateWorkerLease,
      saveAgentState
    };

    const response = await handleCancel(ctx);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.state.current_step).toBe("CANCELLED");

    const sec1 = body.state.sections_progress.find(s => s.id === "sec-1");
    expect(sec1.status).toBe("cancelled");

    expect(invalidateWorkerLease).toHaveBeenCalled();
    expect(saveAgentState).toHaveBeenCalled();
  });
});
