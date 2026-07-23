import { NextResponse } from "next/server";
import { createAgentContext } from "../context";
import { handleReloadSection } from "../actions/reloadSection";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request) {
  try {
    const { ctx, errorResponse } = await createAgentContext(request);
    if (errorResponse) return errorResponse;
    return handleReloadSection(ctx);
  } catch (err) {
    console.error("[agent/reload-section/route] POST error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
