import { NextResponse } from "next/server";
import { createAgentContext } from "../context";
import { handleInit } from "../actions/init";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request) {
  try {
    const { ctx, errorResponse } = await createAgentContext(request);
    if (errorResponse) return errorResponse;
    return handleInit(ctx);
  } catch (err) {
    console.error("[agent/init/route] POST error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
