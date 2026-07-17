import { LunaService } from "./src/lib/oauth/services/luna.js";

async function main() {
  const service = new LunaService();
  console.log("Detecting browser...");
  const browserInfo = await service.findBrowser();
  console.log("Browser Info:", browserInfo);

  console.log("Starting captureToken...");
  try {
    const result = await service.captureToken(60000);
    console.log("SUCCESS:", result);
  } catch (error) {
    console.error("CAPTURE ERROR:", error);
  }
}

main();
