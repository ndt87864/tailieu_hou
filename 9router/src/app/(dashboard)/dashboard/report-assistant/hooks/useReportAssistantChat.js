"use client";

import { useState, useRef, useCallback } from "react";
import { createId } from "../utils/helpers";
import { buildContentWithAttachments } from "../utils/attachmentExtractor";

export function useReportAssistantChat({
  activeSessionId,
  draft,
  setDraft,
  attachedFiles,
  setAttachedFiles,
  apiKey,
  activeModel,
  systemPrompt,
  defaultSystemPrompt,
  temperature,
  setSessions,
  showToast,
  webSearchEnabled,
  assistantOnlyMode,
  runAgentInit,
  selectedKnowledgeSubject,
  streamEnabled,
  thinkingMode,
}) {
  const [isSending, setIsSending] = useState(false);
  const [streamingId, setStreamingId] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const abortRef = useRef(null);
  const isSendingRef = useRef(false);

  const handleStopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    isSendingRef.current = false;
    setIsSending(false);
    setStreamingId("");
    setSearchStatus("");
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!activeSessionId || isSending || isSendingRef.current || (!draft.trim() && attachedFiles.length === 0)) return;
    isSendingRef.current = true;
    setIsSending(true);

    const userText = draft;
    const filePayloads = attachedFiles.filter((f) => f.status === "success");

    const userMsgId = createId();
    const asstMsgId = createId();
    const userMsg = {
      id: userMsgId,
      role: "user",
      content: userText,
      files: filePayloads,
      createdAt: new Date().toISOString(),
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const currentMsgs = s.messages || [];
        const lastMsg = currentMsgs[currentMsgs.length - 1];
        if (lastMsg && lastMsg.role === "user" && lastMsg.content === userText) {
          return s;
        }
        return {
          ...s,
          messages: [...currentMsgs, userMsg],
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setDraft("");
    setAttachedFiles([]);

    if (!assistantOnlyMode && typeof runAgentInit === "function") {
      try {
        showToast("Đang kích hoạt hệ thống AI Agent lập đề cương báo cáo...", "info");
        await runAgentInit({
          userPrompt: userText,
          selectedReportModelId: activeModel?.id,
          chatId: activeSessionId,
          selectedOutlineSubject: selectedKnowledgeSubject !== "none" ? selectedKnowledgeSubject : "",
        });
      } catch (err) {
        console.error("Lỗi kích hoạt AI Agent:", err);
        showToast("Lỗi khởi chạy AI Agent: " + err.message, "error");
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
      }
      return;
    }

    try {
      let webSearchContext = "";
      const urls = userText.match(/(https?:\/\/[^\s]+)/g);
      if (webSearchEnabled && urls && urls.length > 0) {
        setSearchStatus("Đang đọc nội dung liên kết qua Web Fetch (fetch-combo)...");
        showToast("Hệ thống đang đọc nội dung liên kết qua Web Fetch...", "info");
        for (const u of urls) {
          try {
            const res = await fetch("/api/v1/web/fetch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: "fetch-combo",
                url: u,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const extractedText = data.content || data.text || data.markdown || "";
              if (extractedText) {
                webSearchContext += `\n\n--- NỘI DUNG TÀI LIỆU CHI TIẾT TỪ LIÊN KẾT [${u}] ---\n${extractedText.slice(0, 15000)}\n------------------------------------------------`;
              }
            }
          } catch (e) {
            console.error("Lỗi khi đọc liên kết qua /api/v1/web/fetch", e);
          }
        }
      }

      const activeSystemPrompt = systemPrompt.trim()
        ? systemPrompt
        : (isReportIntent(userText) || !assistantOnlyMode ? defaultSystemPrompt : defaultSystemPrompt);

      if (
        webSearchEnabled &&
        isReportIntent(userText)
      ) {
        const searchQuery = cleanWebSearchQuery(userText);
        if (searchQuery) {
          setSearchStatus(
            `Đang đọc và thu thập dữ liệu web qua Web Fetch (fetch-combo) cho: "${searchQuery}"...`
          );
          showToast("Đang tìm kiếm & bóc tách dữ liệu web (fetch-combo)...", "info");
          try {
            const matchUrl = searchQuery.match(/(https?:\/\/[^\s]+)/g)?.[0];
            const targetFetchUrl = matchUrl || `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

            const res = await fetch("/api/v1/web/fetch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              },
              body: JSON.stringify({
                model: "fetch-combo",
                url: targetFetchUrl,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const rawText = data.content || data.text || data.markdown || (typeof data === "string" ? data : JSON.stringify(data));
              const extractedText = typeof rawText === "string" ? rawText : String(rawText || "");
              if (extractedText) {
                showToast("Thu thập dữ liệu Web Fetch thành công!", "success");
                let searchContent = `\n\n--- DỮ LIỆU TÌM KIẾM & BÓC TÁCH MỚI NHẤT TỪ WEB FETCH (fetch-combo) ---`;
                searchContent += `\n**Nguồn / URL:** ${targetFetchUrl}`;
                searchContent += `\n**Nội dung trích xuất:**\n${extractedText.slice(0, 15000)}`;
                searchContent += `\n------------------------------------------------`;
                webSearchContext += searchContent;
              }
            } else {
              const fallbackRes = await fetch("/api/report-assistant/web-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery }),
              });
              if (fallbackRes.ok) {
                const data = await fallbackRes.json();
                if (data.results) {
                  let searchContent = `\n\n--- DỮ LIỆU TÌM KIẾM MỚI NHẤT TỪ WEB SEARCH ---`;
                  if (data.results.answer) {
                    searchContent += `\n**Tóm tắt câu trả lời:** ${data.results.answer}`;
                  }
                  searchContent += `\n\n**Các nguồn tin cậy:**`;
                  for (const r of data.results.results || []) {
                    searchContent += `\n\n- **[${r.title}](${r.url})**\n  *Nội dung:* ${r.content}`;
                  }
                  searchContent += `\n--------------------------------------------`;
                  webSearchContext += searchContent;
                }
              }
            }
          } catch (e) {
            console.error("Error fetching Web search content via /v1/web/fetch", e);
          }
        }
      }
      setSearchStatus("");

      const requestMessages = [];
      if (activeSystemPrompt) {
        requestMessages.push({ role: "system", content: activeSystemPrompt });
      }
      requestMessages.push({
        role: "user",
        content: await buildContentWithAttachments(userText + webSearchContext, filePayloads),
      });

      const initialAsstMsg = {
        id: asstMsgId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
      };
      setStreamingId(asstMsgId);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [...(s.messages || []), initialAsstMsg],
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );

      abortRef.current = new AbortController();

      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: activeModel?.id,
          messages: requestMessages,
          stream: streamEnabled,
          thinking_mode: thinkingMode,
          temperature,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || errJson.message || `Lỗi server (${response.status})`;
        throw new Error(errMsg);
      }

      let fullContent = "";

      if (!streamEnabled) {
        const data = await response.json();
        fullContent = data.choices?.[0]?.message?.content || "";
      } else {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Trình duyệt không hỗ trợ đọc stream response.");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payloadStr = trimmed.slice(5).trim();
            if (!payloadStr || payloadStr === "[DONE]") continue;

            try {
              const chunk = JSON.parse(payloadStr);
              const delta =
                chunk.choices?.[0]?.delta?.content ||
                chunk.choices?.[0]?.message?.content ||
                "";
              if (delta) {
                fullContent += delta;
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === activeSessionId
                      ? {
                          ...s,
                          messages: (s.messages || []).map((m) =>
                            m.id === asstMsgId
                              ? { ...m, content: fullContent, status: "streaming" }
                              : m
                          ),
                          updatedAt: new Date().toISOString(),
                        }
                      : s
                  )
                );
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      const targetSessionId = activeSessionId;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: (s.messages || []).map((m) =>
                  m.id === asstMsgId
                    ? { ...m, content: fullContent, status: "done" }
                    : m
                ),
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );

      setIsSending(false);
      setStreamingId("");

      if (!fullContent.trim()) {
        throw new Error("Không nhận được phản hồi từ mô hình AI.");
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: (s.messages || []).map((m) =>
                    m.id === asstMsgId ? { ...m, status: "done" } : m
                  ),
                }
              : s
          )
        );
      } else {
        console.error(err);
        const isFetchErr = err?.message === "Failed to fetch" || err?.name === "TypeError";
        const displayMsg = isFetchErr
          ? "Không thể kết nối đến máy chủ API. Vui lòng kiểm tra lại server hoặc thử lại sau giây lát."
          : err.message;
        showToast("Lỗi gửi tin nhắn: " + displayMsg, "error");
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
      setStreamingId("");
      setSearchStatus("");
      abortRef.current = null;
    }
  }, [
    activeSessionId,
    draft,
    attachedFiles,
    isSending,
    apiKey,
    activeModel,
    systemPrompt,
    defaultSystemPrompt,
    temperature,
    setSessions,
    showToast,
    webSearchEnabled,
    assistantOnlyMode,
    runAgentInit,
    selectedKnowledgeSubject,
    streamEnabled,
    thinkingMode,
    setDraft,
    setAttachedFiles,
  ]);

  return {
    isSending,
    streamingId,
    searchStatus,
    handleSendMessage,
    handleStopStreaming,
  };
}

function isReportIntent(text) {
  if (!text) return false;
  const normalized = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(tao bao cao|lap bao cao|viet bao cao)\b/.test(normalized);
}

function cleanWebSearchQuery(text) {
  if (!text) return "";
  let q = text;
  q = q.replace(/https?:\/\/[^\s]+/g, "");
  q = q.replace(/!\[.*?\]\(.*?\)/g, "");
  q = q.replace(/\[.*?\]\(.*?\)/g, "");
  const removes = [
    /lập đề cương/gi,
    /viết báo cáo/gi,
    /soạn thảo báo cáo/gi,
    /chi tiết/gi,
    /về chủ đề/gi,
    /hãy/gi,
    /giúp tôi/gi,
    /cho tôi/gi,
    /tạo báo cáo/gi,
    /báo cáo/gi,
  ];
  for (const r of removes) {
    q = q.replace(r, "");
  }
  return q.replace(/\s+/g, " ").trim().slice(0, 150);
}
