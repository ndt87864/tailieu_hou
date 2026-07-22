import { NextResponse } from "next/server";
import { turso } from "@/lib/tursoClient";
import { getProviderConnections } from "@/lib/localDb";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { normalizeUsername, isRestrictedUser, isRestrictedReportAssistantSubject } from "@/lib/userResourceMapping";
import { ensureRestrictedUserResources } from "@/lib/restrictedUserProvisioning";
import { hasValidCliToken, isLocalRequest } from "@/dashboardGuard";
import * as promptsBase from "./prompts";
import { getDraftingSystemCareer } from "./promptsCareer";
import { getDraftingSystemB49 } from "./promptsB49";
import { getDraftingSystemStandard } from "./promptsStandard";
import { createAgentStateStore } from "./agentStateStore";
import { normalizeReportAssistantModelId } from "./llm";
import { normalizeAgentState, getReportLunaChatId, getReportLunaMessageId } from "./agentActivity";

import { handleInit } from "./actions/init";
import { handleApproveOutline } from "./actions/approveOutline";
import { handleCancel } from "./actions/cancel";
import { handleReloadSection } from "./actions/reloadSection";
import { handleStatus } from "./actions/status";
import { handleDraftNext } from "./actions/draftNext";

const prompts = {
  ...promptsBase,
  getDraftingSystemCareer,
  getDraftingSystemB49,
  getDraftingSystemStandard,
};

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const {
  getAgentState,
  saveAgentState,
  claimWorkerLease,
  releaseWorkerLease,
  invalidateWorkerLease,
} = createAgentStateStore(turso);

export async function POST(request) {
  try {
    const authToken = request.cookies.get("auth_token")?.value || null;
    const body = await request.json();
    const {
      action,
      chatId,
      username: rawUsername,
      modelId,
    } = body || {};

    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    // 1. Authorize connection and check provider setup
    const isCli = hasValidCliToken(request);
    const isLocal = isLocalRequest(request);
    let username = "admin";
    let targetModelId = normalizeReportAssistantModelId(modelId);

    if (isCli || isLocal) {
      username = normalizeUsername(rawUsername || "admin");
    } else {
      const session = await getDashboardAuthSession(request);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
      }
      username = session.username;
    }

    if (isRestrictedUser(username) && isRestrictedReportAssistantSubject(body?.subject)) {
      await ensureRestrictedUserResources(username);
    }

    const requestBaseUrl = request.nextUrl.origin || "http://localhost:20128";

    // Obtain current state
    const stateResult = await getAgentState(chatId, username);
    const currentState = stateResult.data;

    const reportSession = {
      lunaChatId: getReportLunaChatId(currentState),
      lunaMessageId: getReportLunaMessageId(currentState),
    };

    const ctx = {
      request,
      body,
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
      claimWorkerLease,
      releaseWorkerLease,
      invalidateWorkerLease
    };

    if (action === "init") {
      return handleInit(ctx);
    }

    if (action === "approve_outline" || action === "approveOutline") {
      return handleApproveOutline(ctx);
    }

    if (action === "cancel") {
      return handleCancel(ctx);
    }

    if (action === "reload_section" || action === "reloadSection") {
      return handleReloadSection(ctx);
    }

    if (action === "status") {
      return handleStatus(ctx);
    }

    if (action === "draft_next" || action === "draft_next_worker" || action === "draftNext") {
      return handleDraftNext(ctx);
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[agent/route] POST error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export const __test__ = {
  saveAgentState,
  getAgentState,
  claimWorkerLease,
  releaseWorkerLease,
  invalidateWorkerLease,
};
