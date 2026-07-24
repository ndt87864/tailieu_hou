"use client";

import { useState, useRef, useCallback } from "react";
import { createId, isReportAssistantLunaModel } from "../utils/helpers";
import { buildContentWithAttachments } from "../utils/attachmentExtractor";

export function useReportAssistantChat({
  activeSessionId,
  setActiveSessionId,
  createSession,
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
  const isLunaModel = isReportAssistantLunaModel(activeModel?.id);
  const effectiveStreamEnabled = isLunaModel ? true : streamEnabled;

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
    let targetChatId = activeSessionId;
    if (!targetChatId && typeof createSession === "function") {
      const newSession = createSession(activeModel);
      targetChatId = newSession.id;
      setSessions((prev) => [newSession, ...prev]);
      if (typeof setActiveSessionId === "function") {
        setActiveSessionId(targetChatId);
      }
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/dashboard/report-assistant/${targetChatId}`);
      }
    }

    if (!targetChatId || isSending || isSendingRef.current || (!draft.trim() && attachedFiles.length === 0)) return;
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
        if (s.id !== targetChatId) return s;
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
          chatId: targetChatId,
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
          stream: effectiveStreamEnabled,
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

      if (!effectiveStreamEnabled) {
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
              const choiceDelta = chunk.choices?.[0]?.delta;

              // Trích xuất delta text từ các vị trí tiêu chuẩn
              const delta =
                choiceDelta?.content ??
                choiceDelta?.text ??
                chunk.choices?.[0]?.text ??
                chunk.choices?.[0]?.message?.content ??
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
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          const updatedMessages = (s.messages || []).map((m) =>
            m.id === asstMsgId
              ? { ...m, content: fullContent, status: "done" }
              : m
          );
          let newTitle = s.title;
          if ((!newTitle || newTitle === "New Chat") && fullContent.trim()) {
            const cleanText = fullContent.replace(/[#*`_~]/g, "").trim();
            newTitle = cleanText.slice(0, 20);
          }
          return {
            ...s,
            title: newTitle,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
        })
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
    handleRegenerateMessage: async (targetMsgId) => {
      if (!activeSessionId || isSending || isSendingRef.current) return;

      // Tìm session và message cần regenerate
      let userPrompt = "";
      let userFiles = [];
      let targetAsstId = targetMsgId;

      setSessions((prev) => {
        const session = prev.find((s) => s.id === activeSessionId);
        if (!session || !session.messages) return prev;

        const msgs = session.messages;
        let asstIdx = -1;

        if (targetAsstId) {
          asstIdx = msgs.findIndex((m) => m.id === targetAsstId);
        } else {
          // Nếu không truyền ID, lấy tin nhắn assistant cuối cùng
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant" && !msgs[i].isOutlineCard && !msgs[i].isReportCard) {
              asstIdx = i;
              targetAsstId = msgs[i].id;
              break;
            }
          }
        }

        if (asstIdx === -1) return prev;

        // Tìm tin nhắn user ngay trước tin nhắn assistant này
        for (let i = asstIdx - 1; i >= 0; i--) {
          if (msgs[i].role === "user") {
            userPrompt = msgs[i].content;
            userFiles = msgs[i].files || [];
            break;
          }
        }

        if (!userPrompt && userFiles.length === 0) return prev;

        // Cập nhật trạng thái tin nhắn assistant thành streaming & xoá content cũ
        return prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === targetAsstId
                    ? { ...m, content: "", status: "streaming" }
                    : m
                ),
                updatedAt: new Date().toISOString(),
              }
            : s
        );
      });

      if (!userPrompt && userFiles.length === 0) return;

      isSendingRef.current = true;
      setIsSending(true);
      setStreamingId(targetAsstId);

      try {
        const activeSystemPrompt = systemPrompt.trim()
          ? systemPrompt
          : defaultSystemPrompt;

        const requestMessages = [];
        if (activeSystemPrompt) {
          requestMessages.push({ role: "system", content: activeSystemPrompt });
        }
        requestMessages.push({
          role: "user",
          content: await buildContentWithAttachments(userPrompt, userFiles),
        });

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
            stream: effectiveStreamEnabled,
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

        if (!effectiveStreamEnabled) {
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
                const choiceDelta = chunk.choices?.[0]?.delta;

                const delta =
                  choiceDelta?.content ??
                  choiceDelta?.text ??
                  chunk.choices?.[0]?.text ??
                  chunk.choices?.[0]?.message?.content ??
                  "";

                if (delta) {
                  fullContent += delta;
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === activeSessionId
                        ? {
                            ...s,
                            messages: (s.messages || []).map((m) =>
                              m.id === targetAsstId
                                ? { ...m, content: fullContent, status: "streaming" }
                                : m
                            ),
                            updatedAt: new Date().toISOString(),
                          }
                        : s
                    )
                  );
                }
              } catch (e) {}
            }
          }
        }

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            const updatedMessages = (s.messages || []).map((m) =>
              m.id === targetAsstId
                ? { ...m, content: fullContent, status: "done" }
                : m
            );
            let newTitle = s.title;
            if ((!newTitle || newTitle === "New Chat") && fullContent.trim()) {
              const cleanText = fullContent.replace(/[#*`_~]/g, "").trim();
              newTitle = cleanText.slice(0, 20);
            }
            return {
              ...s,
              title: newTitle,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
            };
          })
        );

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
                      m.id === targetAsstId ? { ...m, status: "done" } : m
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
          showToast("Lỗi tạo lại phản hồi: " + displayMsg, "error");
        }
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
        setStreamingId("");
        setSearchStatus("");
        abortRef.current = null;
      }
    },
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
