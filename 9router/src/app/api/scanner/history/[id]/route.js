import { NextResponse } from "next/server";
import { deleteScannerHistory } from "@/lib/localDb";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = await deleteScannerHistory(id);
    return NextResponse.json({ success: true, message: "History item deleted", ...result });
  } catch (error) {
    console.error("Error deleting history item:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
