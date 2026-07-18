import { nowSec } from "./_base.js";
import { getExecutor } from "../../executors/index.js";
import { proxyAwareFetch } from "../../utils/proxyFetch.js";

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
      messages: [{ role: "user", content: prompt }],
      chat_type: "t2i",
      sub_chat_type: "t2i",
      size: body.size || "16:9",
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

    const responseBody = await result.response.json();

    // Fallback: If no content is found in choices but we have a sessionChatId, fetch the chat room details
    const choices = responseBody.choices || [];
    const content = choices[0]?.message?.content || "";
    if (!content && result.sessionChatId) {
      try {
        const chatId = result.sessionChatId;
        const chatUrl = `https://chat.qwen.ai/api/v2/chats/${chatId}`;
        const headers = executor.buildHeaders(credentials, false, chatId);
        const chatsRes = await proxyAwareFetch(chatUrl, { headers }, executor.proxyOptions);
        if (chatsRes.ok) {
          const chatData = await chatsRes.json();
          const messages = chatData?.data?.chat?.history?.messages || {};
          const lastMsgId = chatData?.data?.chat?.history?.currentId;
          const lastMsg = messages[lastMsgId];
          if (lastMsg && lastMsg.role === "assistant") {
            const imgContent = lastMsg.content_list?.find(item => item.phase === "image_gen")?.content || lastMsg.content;
            if (imgContent) {
              responseBody.choices = [{
                index: 0,
                message: { role: "assistant", content: imgContent },
                finish_reason: "stop"
              }];
            }
          }
        }
      } catch (err) {
        log.error("LUNA_T2I", "Fallback fetch chat failed:", err);
      }
    }

    return responseBody;
  },

  normalize: (responseBody, prompt) => {
    const choices = responseBody.choices || [];
    const content = choices[0]?.message?.content || "";

    // Find markdown image URLs: ![...](url) or standard http image links (including query parameters)
    const match = content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i) || 
                  content.match(/(https?:\/\/[^\s\)]+)/i);
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
