import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "src",
      "app",
      "(dashboard)",
      "dashboard",
      "report-assistant",
      "harness_prompt.md"
    );
    const prompt = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ prompt });
  } catch (err) {
    console.error("Failed to read harness prompt:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
