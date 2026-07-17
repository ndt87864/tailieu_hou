import fs from "fs";
import path from "path";
import ReportAssistantPageClient from "./ReportAssistantPageClient";

export const metadata = {
  title: "Trợ lý báo cáo | VeloRoute",
  description: "Hỗ trợ viết và phân tích báo cáo chuyên nghiệp sử dụng VeloRoute làm proxy thông minh.",
};

export default function ReportAssistantPage() {
  let initialPrompt = "";
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
    initialPrompt = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error("Failed to read harness prompt file in Server Component:", err);
  }

  return <ReportAssistantPageClient initialPrompt={initialPrompt} />;
}
