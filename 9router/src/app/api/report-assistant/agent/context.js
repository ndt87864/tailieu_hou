import { NextResponse } from "next/server";
import { turso } from "../../../../lib/tursoClient";
import { getDashboardAuthSession } from "../../../../lib/auth/dashboardSession";
import { normalizeUsername, isRestrictedUser, isRestrictedReportAssistantSubject } from "../../../../lib/userResourceMapping";
import { ensureRestrictedUserResources } from "../../../../lib/restrictedUserProvisioning";
import { hasValidCliToken, isLocalRequest } from "../../../../dashboardGuard";
import * as promptsBase from "./prompts";
import { getDraftingSystemCareer } from "./promptsCareer";
import { getDraftingSystemB49 } from "./promptsB49";
import { getDraftingSystemStandard } from "./promptsStandard";
import { createAgentStateStore } from "./agentStateStore";
import { normalizeReportAssistantModelId } from "./llm";
import { getReportLunaChatId, getReportLunaMessageId } from "./agentActivity";

const prompts = {
  ...promptsBase,
  getDraftingSystemCareer,
  getDraftingSystemB49,
  getDraftingSystemStandard,
};

export const {
  getAgentState,
  saveAgentState,
  setMemoryState,
  claimWorkerLease,
  releaseWorkerLease,
  invalidateWorkerLease,
} = createAgentStateStore(turso);

export async function createAgentContext(request, options = {}) {
  const { requireAction = false } = options;
  const authToken = request.cookies.get("auth_token")?.value || null;
  const body = await request.json();
  const {
    action,
    chatId,
    username: rawUsername,
    modelId,
  } = body || {};

  if (!chatId) {
    return { errorResponse: NextResponse.json({ error: "Missing chatId" }, { status: 400 }) };
  }

  if (requireAction && !action) {
    return { errorResponse: NextResponse.json({ error: "Missing action" }, { status: 400 }) };
  }

  const isCli = hasValidCliToken(request);
  const isLocal = isLocalRequest(request);
  let username = "admin";
  let targetModelId = normalizeReportAssistantModelId(modelId);

  if (isCli || isLocal) {
    username = normalizeUsername(rawUsername || "admin");
  } else {
    const session = await getDashboardAuthSession(request);
    if (!session) {
      return { errorResponse: NextResponse.json({ error: "Unauthorized access" }, { status: 401 }) };
    }
    username = session.username;
  }

  if (isRestrictedUser(username) && isRestrictedReportAssistantSubject(body?.subject)) {
    await ensureRestrictedUserResources(username);
  }

  const requestBaseUrl = request.nextUrl.origin || "http://localhost:20128";

  const stateResult = await getAgentState(chatId, username);
  const currentState = stateResult.data;

  const reportSession = {
    lunaChatId: getReportLunaChatId(currentState),
    lunaMessageId: getReportLunaMessageId(currentState),
  };

  const ctx = {
    request,
    body,
    action,
    chatId,
    username,
    authToken,
    requestBaseUrl,
    targetModelId,
    currentState,
    reportSession,
    prompts,
    turso,
    getAgentState,
    saveAgentState,
    setMemoryState,
    claimWorkerLease,
    releaseWorkerLease,
    invalidateWorkerLease,
  };

  return { ctx };
}
