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
      const activeSystemPrompt = systemPrompt.trim()
        ? systemPrompt
        : (isReportIntent(userText) || !assistantOnlyMode ? defaultSystemPrompt : defaultSystemPrompt);

      const requestMessages = [];
      if (activeSystemPrompt) {
        requestMessages.push({ role: "system", content: activeSystemPrompt });
      }
      requestMessages.push({
        role: "user",
        content: await buildContentWithAttachments(userText, filePayloads),
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
