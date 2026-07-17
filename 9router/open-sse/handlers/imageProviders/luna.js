import { nowSec } from "./_base.js";
import { getExecutor } from "../../executors/index.js";

export default {
  // Delegate to executor instead of building URL/headers/body manually
  useExecutor: true,

  // Stubs - required by imageGenerationCore interface but unused with useExecutor
  buildUrl: () => "",
  buildHeaders: () => ({}),
  buildBody: () => ({}),

  async executeViaExecutor(model, body, credentials, log) {
    const executor = getExecutor("luna");
    if (!executor) throw new Error("Luna executor not found");

    const prompt = body.prompt;
    const chatBody = {
      messages: [{ role: "user", content: `Please generate an image based on this description: ${prompt}` }],
      stream: false,
    };

    const result = await executor.execute({
      model: model || "qwen3.7-plus",
      body: chatBody,
      stream: false,
      credentials,
      log,
    });

    if (!result.response.ok) {
      const text = await result.response.text();
      throw new Error(text || `HTTP ${result.response.status}`);
    }

    return result.response.json();
  },

  normalize: (responseBody, prompt) => {
    const choices = responseBody.choices || [];
    const content = choices[0]?.message?.content || "";

    // Find markdown image URLs: ![...](url) or standard http image links
    const match = content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i) || 
                  content.match(/(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|webp))/i);
    const imageUrl = match ? match[1] : null;

    if (!imageUrl) {
      throw new Error(`Qwen did not return a generated image. Response text: ${content}`);
    }

    return {
      created: nowSec(),
      data: [{ url: imageUrl, revised_prompt: prompt }],
    };
  },
};
