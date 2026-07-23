import { NextResponse } from "next/server";
import {
  createAgentContext,
  getAgentState,
  saveAgentState,
  claimWorkerLease,
  releaseWorkerLease,
  invalidateWorkerLease,
} from "./context";

import { handleInit } from "./actions/init";
import { handleApproveOutline } from "./actions/approveOutline";
import { handleCancel } from "./actions/cancel";
import { handleReloadSection } from "./actions/reloadSection";
import { handleStatus } from "./actions/status";
import { handleDraftNext } from "./actions/draftNext";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request) {
  try {
    const { ctx, errorResponse } = await createAgentContext(request, { requireAction: true });
    if (errorResponse) return errorResponse;

    const action = ctx.action;

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
