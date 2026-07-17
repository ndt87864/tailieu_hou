import { NextResponse } from "next/server";
import { getScannerHistory, createScannerHistory, clearScannerHistory } from "@/lib/localDb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const history = await getScannerHistory();
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching scanner history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.filename || !body.fileType || !body.model || !body.results) {
      return NextResponse.json({ error: "Missing required fields (filename, fileType, model, results)" }, { status: 400 });
    }
    const record = await createScannerHistory(body);
    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("Error creating scanner history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearScannerHistory();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing scanner history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
