import { NextResponse } from "next/server";
import { normalizeAgentState, setAgentActivity } from "../agentActivity";
import { recoverInterruptedDraft } from "../stateTransitions";

export async function handleCancel(ctx) {
  const {
    chatId,
    username,
    currentState,
    invalidateWorkerLease,
    saveAgentState
  } = ctx;

  if (!currentState) {
    return NextResponse.json({ ok: true, state: null });
  }

  normalizeAgentState(currentState);
  currentState.current_step = "CANCELLED";
  currentState.cancelled_at = new Date().toISOString();
  setAgentActivity(currentState, null, "cancelled", "Người dùng đã hủy quy trình tạo báo cáo.", {
    actor: "User",
  });

  const progress = currentState.sections_progress || [];
  for (const section of progress) {
    if (section.status === "drafting") {
      if (String(section.content || "").trim()) {
        recoverInterruptedDraft(section, { stale: true });
      } else {
        section.status = "cancelled";
      }
    }
  }

  await invalidateWorkerLease({ chatId, username: username || currentState.username });

  await saveAgentState(chatId, username || currentState.username, currentState);
  return NextResponse.json({ ok: true, state: currentState });
}
