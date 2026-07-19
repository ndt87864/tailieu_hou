import { NextResponse } from "next/server";
import { normalizeAgentState, hasStateChanged } from "../agentActivity";

export async function handleStatus(ctx) {
  const {
    chatId,
    username,
    currentState,
    saveAgentState
  } = ctx;

  if (!currentState) {
    return NextResponse.json({ ok: false, state: null });
  }

  const beforeNormalize = JSON.parse(JSON.stringify(currentState));
  normalizeAgentState(currentState);
  if (hasStateChanged(beforeNormalize, currentState)) {
    await saveAgentState(chatId, currentState.username || username, currentState, currentState.updated_at);
  }
  return NextResponse.json({ ok: true, state: currentState });
}
