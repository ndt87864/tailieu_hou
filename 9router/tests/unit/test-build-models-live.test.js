import { describe, it } from "vitest";
import { buildModelsList } from "@/app/api/v1/models/route.js";

describe("live check", () => {
  it("prints buildModelsList", async () => {
    const list = await buildModelsList(["llm"]);
    console.log("LIVE MODELS:", JSON.stringify(list, null, 2));
  });
});
