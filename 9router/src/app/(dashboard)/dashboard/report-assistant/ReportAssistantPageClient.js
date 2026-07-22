"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button, Badge } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import useUserStore from "@/store/userStore";

import {
  DEFAULT_TEMPERATURE,
  REPORT_KNOWLEDGE_GLOBAL_USER,
  RESTRICTED_REPORT_ASSISTANT_SUBJECTS,
  getSK,
} from "./constants";

import {
  createId,
  safeParse,
  formatBytes,
  relTime,
  getReportAssistantLunaModels,
  getReportAssistantChatModels,
} from "./utils/helpers";

import {
  clearAllKnowledgeContentCaches,
  ensureKnowledgeCacheSessionOwner,
} from "./utils/knowledgeCache";

import { renderMarkdownAndMath } from "./utils/markdownRenderer";
import {
  prepareReportContent,
  getReportTitleWithDownloadCounter,
} from "./utils/reportFormatter";

import { buildContentWithAttachments } from "./utils/attachmentExtractor";

import { ConfirmDialog } from "./components/ConfirmDialog";
import { PdfPreviewModal } from "./components/PdfPreviewModal";
import { SettingsModal } from "./components/SettingsModal";
import {
  AssistantAvatar,
  UserAvatar,
  TypingDots,
  MessageFilesGrid,
} from "./components/ChatBubble";

import { useChatSession } from "./hooks/useChatSession";
import { useAgentWorkflow } from "./hooks/useAgentWorkflow";

export default function ReportAssistantPageClient({ initialPrompt, initialChatId }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [username, setUsername] = useState("admin");
  const [usernameLoaded, setUsernameLoaded] = useState(false);
  const [isRestrictedUser, setIsRestrictedUser] = useState(false);
  const [allModels, setAllModels] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [fullModelsLoaded, setFullModelsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(initialPrompt);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [assistantOnlyMode, setAssistantOnlyMode] = useState(true);
  const [enabledModelIds, setEnabledModelIds] = useState(new Set());
  const [reportModels, setReportModels] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportModelsLoading, setReportModelsLoading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const showToast = useCallback((message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  }, []);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingId, setStreamingId] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedKnowledgeSubject, setSelectedKnowledgeSubject] = useState("none");
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [searchStatus, setSearchStatus] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const [streamEnabled, setStreamEnabled] = useState(true);
  const [thinkingMode, setThinkingMode] = useState("auto"); // "auto", "fast", "thinking"

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  const applyFullModelList = useCallback((models, uName) => {
    if (!Array.isArray(models) || models.length === 0) return;
    const uSK = getSK(uName);
    const rawEnabledModels = localStorage.getItem(uSK.enabledModels);
    const enabledSet = new Set(safeParse(rawEnabledModels, []) || []);
    models.forEach((m) => enabledSet.add(m.id));
    setAllModels(models);
    setEnabledModelIds(enabledSet);
  }, []);

  const { fetchUser } = useUserStore();

  const loadFullModels = useCallback(async (uName = username) => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/v1/models", { cache: "no-store" });
      const data = await res.json();
      const rawModels = Array.isArray(data?.data) ? data.data : [];
      applyFullModelList(getReportAssistantChatModels(rawModels), uName);
      setFullModelsLoaded(true);
    } catch (err) {
      setLoadError(err.message || "Failed to load models.");
    } finally {
      setLoadingModels(false);
    }
  }, [applyFullModelList, username]);

  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
  } = useChatSession({
    initialChatId,
    username,
    usernameLoaded,
    hydrated,
    activeModelId: allModels[0]?.id || "",
    setActiveModelId: () => {},
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    setAssistantOnlyMode,
    selectedKnowledgeSubject,
    setSelectedKnowledgeSubject,
    allModels,
    enabledModelIds,
    setEnabledModelIds,
    fullModelsLoaded,
    setReportModels,
    applyFullModelList,
    fetchUser,
    loadFullModels,
  });

  const handleStopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsSending(false);
    setStreamingId("");
    setSearchStatus("");
  }, []);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [draft]);

  // Knowledge Base States
  const [subjectsOutlines, setSubjectsOutlines] = useState([]);
  const [filesOutlines, setFilesOutlines] = useState({});
  const [loadingOutlines, setLoadingOutlines] = useState(false);
  const [subjectsTemplates, setSubjectsTemplates] = useState([]);
  const [filesTemplates, setFilesTemplates] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const isSupabaseConfigured = useMemo(() => {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }, []);

  const loadOutlines = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingOutlines(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=outlines`
      );
      const data = await res.json();
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const filesBySubject = data.filesBySubject || {};
      if (isRestrictedUser) {
        const allowed = {};
        for (const subj of RESTRICTED_REPORT_ASSISTANT_SUBJECTS) {
          allowed[subj] = Array.isArray(filesBySubject[subj]) ? filesBySubject[subj] : [];
        }
        setSubjectsOutlines([...RESTRICTED_REPORT_ASSISTANT_SUBJECTS]);
        setFilesOutlines(allowed);
      } else {
        setSubjectsOutlines(subjects);
        setFilesOutlines(filesBySubject);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOutlines(false);
    }
  }, [isSupabaseConfigured, isRestrictedUser]);

  const loadTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=templates`
      );
      const data = await res.json();
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const filesBySubject = data.filesBySubject || {};
      if (isRestrictedUser) {
        const allowed = {};
        for (const subj of RESTRICTED_REPORT_ASSISTANT_SUBJECTS) {
          allowed[subj] = Array.isArray(filesBySubject[subj]) ? filesBySubject[subj] : [];
        }
        setSubjectsTemplates([...RESTRICTED_REPORT_ASSISTANT_SUBJECTS]);
        setFilesTemplates(allowed);
      } else {
        setSubjectsTemplates(subjects);
        setFilesTemplates(filesBySubject);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [isSupabaseConfigured, isRestrictedUser]);

  const loadReportModels = useCallback(async () => {
    setReportModelsLoading(true);
    try {
      const res = await fetch("/api/v1/models", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const rawModels = Array.isArray(data?.data) ? data.data : [];
      setReportModels(getReportAssistantLunaModels(rawModels));
    } catch (err) {
      console.error(err);
    } finally {
      setReportModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    async function initUser() {
      try {
        const [keysRes, authData] = await Promise.all([
          fetch("/api/keys", { cache: "no-store" }),
          fetchUser(),
        ]);
        const keysData = await keysRes.json();
        const key = Array.isArray(keysData?.keys)
          ? keysData.keys.find((k) => k.isActive !== false)?.key || ""
          : "";
        const uName = authData?.username || "admin";
        setUsername(uName);
        setApiKey(key);

        const normalized = uName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const restricted = ["trang", "thu", "thuy", "nga", "mai"].includes(normalized);
        setIsRestrictedUser(restricted);

        ensureKnowledgeCacheSessionOwner(uName);
        await loadFullModels(uName);
      } catch (err) {
        console.error(err);
      } finally {
        setUsernameLoaded(true);
      }
    }
    if (hydrated) {
      initUser();
    }
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && usernameLoaded && isSupabaseConfigured) {
      loadOutlines();
      loadTemplates();
    }
  }, [hydrated, usernameLoaded, isSupabaseConfigured, loadOutlines, loadTemplates]);

  const createSession = useCallback((model, subject = selectedKnowledgeSubject) => ({
    id: createId(),
    title: "New Chat",
    modelId: model?.id || "",
    subject: subject || "none",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [selectedKnowledgeSubject]);

  const {
    agentActive,
    agentState,
    agentLoading,
    selectedReport,
    setSelectedReport,
    selectedOutline,
    setSelectedOutline,
    pendingReportRequest,
    setPendingReportRequest,
    reportWorkflowModelId,
    setReportWorkflowModelId,
    buildAgentReportContent,
    runAgentInit,
    loadAgentStatus,
  } = useAgentWorkflow({
    activeSessionId,
    setActiveSessionId,
    username,
    sessions,
    setSessions,
    selectedKnowledgeSubject,
    setSelectedKnowledgeSubject,
    reportModels,
    activeModel: allModels[0],
    createSession,
    showToast,
    filesOutlines,
    filesTemplates,
    setDraft,
    setAttachedFiles,
  });

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const activeModel = useMemo(() => {
    if (!activeSession?.modelId) {
      return allModels[0] || null;
    }
    const found = allModels.find((m) => m.id === activeSession.modelId);
    if (found) return found;
    return { id: activeSession.modelId };
  }, [allModels, activeSession]);

  // Tự động đồng bộ trạng thái AI Agent Workflow khi chuyển đổi session hoặc bật AI Agent mode
  useEffect(() => {
    if (activeSessionId && typeof loadAgentStatus === "function") {
      loadAgentStatus(activeSessionId);
    }
  }, [activeSessionId, assistantOnlyMode, loadAgentStatus]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = useCallback(
    async (item) => {
      if (!isSupabaseConfigured) {
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error",
                  errorMsg: "Chưa cấu hình Supabase URL/Key",
                }
              : f
          )
        );
        return;
      }

      try {
        const fileExt = item.name.split(".").pop();
        const fileName = `${createId()}.${fileExt}`;
        const filePath = `report_uploads/${username}/${fileName}`;

        const { data, error } = await supabase.storage
          .from("ai_assistant")
          .upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("ai_assistant")
          .getPublicUrl(filePath);

        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "success",
                  url: urlData.publicUrl,
                }
              : f
          )
        );
      } catch (err) {
        console.error("Upload error:", err);
        let errorMsg = err.message || "Tải lên thất bại";
        if (
          errorMsg.toLowerCase().includes("row-level security") ||
          errorMsg.toLowerCase().includes("permission denied") ||
          errorMsg.toLowerCase().includes("policy")
        ) {
          errorMsg = "Lỗi RLS Policy (Vui lòng thiết lập INSERT cho bucket)";
        }
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error",
                  errorMsg,
                }
              : f
          )
        );
      }
    },
    [isSupabaseConfigured, username]
  );

  const handleFileChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const newFiles = files.map((file) => ({
        id: createId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading",
        url: "",
        errorMsg: "",
      }));

      setAttachedFiles((prev) => [...prev, ...newFiles]);

      for (const item of newFiles) {
        uploadFile(item);
      }

      if (e.target) e.target.value = "";
    },
    [uploadFile]
  );

  const removeAttachedFile = useCallback((id) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const allSubjects = useMemo(() => {
    if (isRestrictedUser) return [...RESTRICTED_REPORT_ASSISTANT_SUBJECTS];
    const set = new Set([
      ...Object.keys(filesOutlines || {}),
      ...Object.keys(filesTemplates || {}),
    ]);
    return Array.from(set).filter(Boolean);
  }, [filesOutlines, filesTemplates, isRestrictedUser]);

  const handleSendMessage = useCallback(async () => {
    if (!activeSessionId || isSending || (!draft.trim() && attachedFiles.length === 0)) return;
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
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [...(s.messages || []), userMsg],
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    setDraft("");
    setAttachedFiles([]);

    // Nếu đang BẬT chế độ AI Agent (!assistantOnlyMode), tự động kích hoạt Multi-Agent Workflow
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
            // Trường hợp 1: Nếu từ khóa chứa URL, gọi trực tiếp fetch-combo cho URL đó
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
              const extractedText = data.content || data.text || data.markdown || "";
              if (extractedText) {
                showToast("Thu thập dữ liệu Web Fetch thành công!", "success");
                let searchContent = `\n\n--- DỮ LIỆU TÌM KIẾM & BÓC TÁCH MỚI NHẤT TỪ WEB FETCH (fetch-combo) ---`;
                searchContent += `\n**Nguồn / URL:** ${targetFetchUrl}`;
                searchContent += `\n**Nội dung trích xuất:**\n${extractedText.slice(0, 15000)}`;
                searchContent += `\n------------------------------------------------`;
                webSearchContext += searchContent;
              }
            } else {
              // Fallback qua /api/report-assistant/web-search nếu /v1/web/fetch trả về lỗi
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
              // Ignore parse errors on partial lines
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
        // Dừng thủ công bởi người dùng, đánh dấu tin nhắn dừng
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
  ]);

  const handleDeleteSession = useCallback((sessionId, e) => {
    e.stopPropagation();
    
    const nextSessions = sessions.filter((item) => item.id !== sessionId);
    setSessions(nextSessions);
    
    // Call API to delete session in DB
    fetch(`/api/report-assistant/history?chatId=${sessionId}`, {
      method: "DELETE",
    }).catch((err) => console.warn("Failed to delete session from DB", err));

    if (activeSessionId === sessionId) {
      if (nextSessions.length > 0) {
        const deletedIdx = sessions.findIndex((item) => item.id === sessionId);
        const nextActiveIdx = deletedIdx < nextSessions.length ? deletedIdx : nextSessions.length - 1;
        const nextActiveId = nextSessions[nextActiveIdx].id;
        setActiveSessionId(nextActiveId);
        router.replace(`/dashboard/report-assistant/${nextActiveId}`);
      } else {
        setActiveSessionId("");
        router.replace("/dashboard/report-assistant");
      }
    }
  }, [activeSessionId, sessions, router, setSessions, setActiveSessionId]);

  if (!hydrated) return null;

  return (
    <div className="flex h-screen bg-bg text-text-main overflow-hidden font-sans">
      {/* Sidebar - Sessions List */}
      <div className="w-64 border-r border-border bg-surface flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-main">Lịch sử trò chuyện</h2>
          <Button
            size="sm"
            onClick={() => {
              const s = createSession(activeModel);
              setSessions((prev) => [s, ...prev]);
              setActiveSessionId(s.id);
            }}
          >
            + Chat mới
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={cn(
                "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border",
                s.id === activeSessionId
                  ? "bg-brand-500/10 border-brand-500 text-brand-600 font-medium"
                  : "bg-surface hover:bg-surface-2 border-border"
              )}
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-xs truncate">{s.title || "New Chat"}</p>
                <p className="text-[10px] text-text-subtle">{relTime(s.updatedAt)}</p>
              </div>
              <button
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="text-text-subtle hover:text-rose-500 text-xs p-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="flex-1 flex flex-col h-full bg-bg relative">
        {/* Top Header */}
        <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-text-main">Trợ lý học tập</h1>
            {/* Custom Model Selector */}
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-bg hover:bg-surface-2 transition-all text-xs font-semibold text-text-main cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-brand-500">
                  smart_toy
                </span>
                <span>{activeModel?.id?.split("/").pop() || "Chọn mô hình"}</span>
                <span className="material-symbols-outlined text-[16px] text-text-subtle">
                  expand_more
                </span>
              </button>

              {modelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1.5 z-40 w-64 bg-surface border border-border rounded-xl shadow-lg overflow-hidden py-1">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      {allModels.map((m) => {
                        const active = m.id === activeModel?.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              if (activeSessionId) {
                                setSessions((prev) =>
                                  prev.map((s) =>
                                    s.id === activeSessionId
                                      ? {
                                          ...s,
                                          modelId: m.id,
                                          updatedAt: new Date().toISOString(),
                                        }
                                      : s
                                  )
                                );
                              }
                              setModelDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                              active
                                ? "bg-brand-500/10 text-brand-600 font-semibold"
                                : "text-text-main hover:bg-surface-2"
                            )}
                          >
                            <span className="material-symbols-outlined text-[15px] text-brand-500">
                              psychology
                            </span>
                            <span className="truncate">{m.id.split("/").pop()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            Cấu hình
          </Button>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col">
          {!activeSession?.messages || activeSession.messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-xl mx-auto my-auto space-y-4 select-none">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-2">
                <span className="material-symbols-outlined text-[36px]">
                  auto_awesome
                </span>
              </div>
              <h3 className="text-lg font-bold text-text-main">Trợ lý Soạn thảo Báo cáo Học tập</h3>
              <p className="text-xs text-text-subtle leading-relaxed">
                Chào mừng bạn! Tôi có thể giúp bạn tạo báo cáo, soạn thảo đề cương học tập, và phân tích tài liệu một cách thông minh. Hãy bắt đầu bằng cách nhập một tin nhắn hoặc chọn một tài liệu mẫu bên dưới.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full pt-4">
                <button
                  onClick={() => setDraft("Lập đề cương báo cáo chi tiết về đề tài chuyển đổi số trong giáo dục đại học.")}
                  className="p-3 text-left border border-border rounded-xl bg-surface hover:bg-surface-2 transition-all hover:border-brand-500/30 text-xs cursor-pointer group"
                >
                  <div className="font-semibold text-text-main flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-brand-500">edit_note</span>
                    Lập đề cương báo cáo
                  </div>
                  <div className="text-[10px] text-text-subtle truncate">Chuyển đổi số giáo dục...</div>
                </button>
                <button
                  onClick={() => setDraft("Viết một báo cáo phân tích về tiềm năng ứng dụng AI trong học tập.")}
                  className="p-3 text-left border border-border rounded-xl bg-surface hover:bg-surface-2 transition-all hover:border-brand-500/30 text-xs cursor-pointer group"
                >
                  <div className="font-semibold text-text-main flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px] text-brand-500">school</span>
                    AI trong học tập
                  </div>
                  <div className="text-[10px] text-text-subtle truncate">Phân tích ứng dụng AI...</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeSession?.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-4 max-w-3xl group relative",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {msg.role === "user" ? <UserAvatar /> : <AssistantAvatar />}
                  <div className="relative">
                    <div
                      className={cn(
                        "p-4 rounded-2xl border text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-brand-500 border-brand-500 text-white"
                          : "bg-surface border-border text-text-main"
                      )}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdownAndMath(msg.content),
                        }}
                      />
                      <MessageFilesGrid files={msg.files || []} />
                    </div>

                    {/* Hover actions */}
                    <div
                      className={cn(
                        "absolute opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-surface border border-border shadow-sm rounded-lg p-0.5 z-10 top-full mt-1",
                        msg.role === "user" ? "right-2" : "left-2"
                      )}
                    >
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          showToast("Sao chép thành công!", "success");
                          setCopiedMessageId(msg.id);
                          setTimeout(() => setCopiedMessageId(null), 2000);
                        }}
                        className={cn(
                          "p-1 rounded cursor-pointer flex items-center justify-center transition-colors",
                          copiedMessageId === msg.id
                            ? "text-green-500 bg-green-500/10"
                            : "text-text-subtle hover:text-text-main hover:bg-surface-2"
                        )}
                        title={copiedMessageId === msg.id ? "Đã sao chép" : "Sao chép"}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {copiedMessageId === msg.id ? "done" : "content_copy"}
                        </span>
                      </button>
                      {msg.role === "user" && (
                        <button
                          onClick={() => {
                            setDraft(msg.content);
                            textareaRef.current?.focus();
                          }}
                          className="p-1 rounded text-text-subtle hover:text-text-main hover:bg-surface-2 cursor-pointer flex items-center justify-center"
                          title="Sửa tin nhắn"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isSending && (!activeSession?.messages?.some(m => m.id === streamingId && m.content.trim())) && (
            <div className="flex gap-4 max-w-3xl mr-auto">
              <AssistantAvatar />
              <TypingDots />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-surface flex flex-col gap-2">
          {searchStatus && (
            <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/10 text-brand-600 rounded-[10px] text-xs font-semibold animate-pulse">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span>{searchStatus}</span>
            </div>
          )}

          {/* Active Features Status Badges Bar */}
          <div className="flex flex-wrap items-center gap-1.5 px-1 py-0.5 text-xs">
            {/* 1. Web Search / Fetch Badge */}
            {webSearchEnabled && (
              <span
                onClick={() => setWebSearchEnabled(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium text-[11px] cursor-pointer hover:bg-blue-500/20 transition-colors"
                title="BẬT: Tìm kiếm & Thu thập Web (Click để tắt)"
              >
                <span className="material-symbols-outlined text-[14px]">language</span>
                <span>Web Fetch: BẬT</span>
                <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
              </span>
            )}

            {/* 2. AI Agent Badge */}
            {!assistantOnlyMode && (
              <span
                onClick={() => setAssistantOnlyMode(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 font-medium text-[11px] cursor-pointer hover:bg-brand-500/20 transition-colors"
                title="BẬT: Chế độ AI Agent tự động (Click để tắt)"
              >
                <span className="material-symbols-outlined text-[14px]">support_agent</span>
                <span>AI Agent: BẬT</span>
                <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
              </span>
            )}

            {/* 3. Stream Mode Badge */}
            {streamEnabled && (
              <span
                onClick={() => setStreamEnabled(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium text-[11px] cursor-pointer hover:bg-emerald-500/20 transition-colors"
                title="BẬT: Stream Real-time (Click để tắt)"
              >
                <span className="material-symbols-outlined text-[14px]">stream</span>
                <span>Stream: BẬT</span>
                <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
              </span>
            )}

            {/* 4. Thinking Mode Badge */}
            {(() => {
              const isModel38 = !!(activeModel?.id && (activeModel.id.includes("3.8") || activeModel.id.includes("qwen3.8") || activeModel.id.includes("qwen-3.8")));
              const currentThinkingMode = isModel38 ? "thinking" : thinkingMode;

              return (
                <span
                  onClick={() => {
                    if (isModel38) return;
                    const modes = ["auto", "fast", "thinking"];
                    const nextIdx = (modes.indexOf(thinkingMode) + 1) % modes.length;
                    setThinkingMode(modes[nextIdx]);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors",
                    isModel38 ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:opacity-80",
                    currentThinkingMode === "thinking"
                      ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                      : currentThinkingMode === "fast"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-surface border-border text-text-muted"
                  )}
                  title={`Thinking Mode: ${currentThinkingMode.toUpperCase()} (Click để đổi)`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {currentThinkingMode === "thinking" ? "psychology" : currentThinkingMode === "fast" ? "bolt" : "tune"}
                  </span>
                  <span className="capitalize">Thinking: {currentThinkingMode}</span>
                </span>
              );
            })()}

            {/* 5. Knowledge Subject Badge */}
            {selectedKnowledgeSubject !== "none" && (
              <span
                onClick={() => setSelectedKnowledgeSubject("none")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-medium text-[11px] cursor-pointer hover:bg-purple-500/20 transition-colors"
                title={`Chủ đề báo cáo đang chọn: ${selectedKnowledgeSubject} (Click để bỏ chọn)`}
              >
                <span className="material-symbols-outlined text-[14px]">menu_book</span>
                <span className="max-w-[150px] truncate">{selectedKnowledgeSubject}</span>
                <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
              </span>
            )}
          </div>

          {/* Attached Files Bar */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-bg/50 rounded-xl">
              {attachedFiles.map((file) => {
                const isImg = file.type?.startsWith("image/");
                const isUploading = file.status === "uploading";
                const isError = file.status === "error";

                return (
                  <div
                    key={file.id}
                    className={cn(
                      "relative flex items-center gap-2 pl-2 pr-1 py-1 rounded-[8px] border text-xs font-medium bg-surface min-w-[120px] max-w-[200px]",
                      isError
                        ? "border-danger/30 bg-danger/5 text-danger"
                        : "border-border"
                    )}
                  >
                    {isImg && file.url ? (
                      <img
                        src={file.url}
                        alt={file.name || "Tệp hình ảnh"}
                        className="size-6 rounded-[4px] object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[16px] text-text-muted flex-shrink-0">
                        {isImg ? "image" : "description"}
                      </span>
                    )}

                    <div className="flex-1 min-w-0 leading-tight">
                      <p
                        className="truncate text-[11px] text-text-main"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      {isUploading ? (
                        <p className="text-[9px] text-text-subtle animate-pulse">
                          Uploading...
                        </p>
                      ) : isError ? (
                        <p
                          className="text-[9px] text-danger truncate"
                          title={file.errorMsg}
                        >
                          {file.errorMsg}
                        </p>
                      ) : (
                        <p className="text-[9px] text-text-subtle">
                          {formatBytes(file.size)}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => removeAttachedFile(file.id)}
                      className="size-5 rounded-full hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        close
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-end gap-3 bg-bg border border-border rounded-2xl px-4 py-2">
            {/* Main Combined "+" Menu */}
            <div className="relative mb-0.5">
              <button
                type="button"
                onClick={() => setPlusMenuOpen((prev) => !prev)}
                className={cn(
                  "size-8 rounded-[8px] flex items-center justify-center transition-all cursor-pointer shrink-0 border border-border/60 hover:bg-surface-2",
                  plusMenuOpen ? "bg-surface-2 text-brand-500 border-brand-500/40" : "bg-surface text-text-muted hover:text-text-main"
                )}
                title="Mở menu công cụ hỗ trợ (+)"
              >
                <span className="material-symbols-outlined text-[20px] transition-transform duration-200" style={{ transform: plusMenuOpen ? "rotate(45deg)" : "none" }}>
                  add
                </span>
              </button>

              {plusMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setPlusMenuOpen(false)} />
                  <div className="absolute left-0 bottom-full mb-2 z-40 w-64 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden py-1.5 backdrop-blur-md">
                    <div className="px-3 py-1.5 border-b border-border/50 text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                      Công cụ & Chế độ
                    </div>

                    <div className="p-1 space-y-0.5">
                      {/* 1. Web Search / Fetch */}
                      <button
                        type="button"
                        onClick={() => setWebSearchEnabled((prev) => !prev)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                          webSearchEnabled ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-brand-500">language</span>
                          <span>Tìm kiếm & Thu thập Web (fetch-combo)</span>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                          {webSearchEnabled ? "BẬT" : "TẮT"}
                        </span>
                      </button>

                      {/* 2. Upload File */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerFileInput();
                          setPlusMenuOpen(false);
                        }}
                        disabled={isSending || !activeModel}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-text-main hover:bg-surface-2 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px] text-brand-500">attach_file</span>
                        <span>Đính kèm tài liệu / file</span>
                      </button>

                      {/* 3. AI Agent */}
                      <button
                        type="button"
                        onClick={() => setAssistantOnlyMode((prev) => !prev)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                          !assistantOnlyMode ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-brand-500">support_agent</span>
                          <span>Chế độ AI Agent</span>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                          {!assistantOnlyMode ? "BẬT" : "TẮT"}
                        </span>
                      </button>

                      {/* 4. Stream Toggle */}
                      <button
                        type="button"
                        onClick={() => setStreamEnabled((prev) => !prev)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                          streamEnabled ? "bg-emerald-500/10 text-emerald-600 font-semibold" : "text-text-main hover:bg-surface-2"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-emerald-500">{streamEnabled ? "stream" : "pause_circle"}</span>
                          <span>Stream Real-time</span>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                          {streamEnabled ? "BẬT" : "TẮT"}
                        </span>
                      </button>

                      {/* 5. Thinking Mode */}
                      {(() => {
                        const isModel38 = !!(activeModel?.id && (activeModel.id.includes("3.8") || activeModel.id.includes("qwen3.8") || activeModel.id.includes("qwen-3.8")));
                        const currentThinkingMode = isModel38 ? "thinking" : thinkingMode;
                        return (
                          <button
                            type="button"
                            disabled={isModel38}
                            onClick={() => {
                              if (isModel38) return;
                              const modes = ["auto", "fast", "thinking"];
                              const nextIdx = (modes.indexOf(thinkingMode) + 1) % modes.length;
                              setThinkingMode(modes[nextIdx]);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                              isModel38 ? "opacity-80 cursor-not-allowed" : "hover:bg-surface-2 cursor-pointer"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-[18px] text-purple-500">
                                {currentThinkingMode === "thinking" ? "psychology" : currentThinkingMode === "fast" ? "bolt" : "tune"}
                              </span>
                              <span>Chế độ Suy nghĩ</span>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 capitalize">
                              {currentThinkingMode}
                            </span>
                          </button>
                        );
                      })()}

                      {/* 6. Subject Selector */}
                      {allSubjects.length > 0 && (
                        <div className="pt-1.5 border-t border-border/50">
                          <div className="px-3 py-1 text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                            Chủ đề Báo cáo
                          </div>
                          <div className="max-h-40 overflow-y-auto custom-scrollbar p-0.5">
                            <button
                              onClick={() => {
                                setSelectedKnowledgeSubject("none");
                                if (activeSessionId) {
                                  setSessions((prev) =>
                                    prev.map((s) =>
                                      s.id === activeSessionId
                                        ? { ...s, subject: "none", updatedAt: new Date().toISOString() }
                                        : s
                                    )
                                  );
                                }
                                setPlusMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors",
                                selectedKnowledgeSubject === "none" ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                              )}
                            >
                              <span className="material-symbols-outlined text-[15px] text-text-subtle">layers_clear</span>
                              <span>-- Không chọn --</span>
                            </button>

                            {allSubjects.map((s) => {
                              const active = s === selectedKnowledgeSubject;
                              return (
                                <button
                                  key={s}
                                  onClick={() => {
                                    setSelectedKnowledgeSubject(s);
                                    if (activeSessionId) {
                                      setSessions((prev) =>
                                        prev.map((sItem) =>
                                          sItem.id === activeSessionId
                                            ? { ...sItem, subject: s, updatedAt: new Date().toISOString() }
                                            : sItem
                                        )
                                      );
                                    }
                                    setPlusMenuOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors",
                                    active ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                                  )}
                                >
                                  <span className="material-symbols-outlined text-[15px] text-brand-500">library_books</span>
                                  <span className="truncate">{s}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={isSending || !activeModel}
            />

            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (draft.trim() || attachedFiles.length > 0) {
                    handleSendMessage();
                  }
                }
              }}
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-transparent border-0 outline-none text-sm resize-none text-text-main placeholder:text-text-subtle py-1.5 max-h-40 overflow-y-auto"
            />
            {isSending ? (
              <button
                type="button"
                onClick={handleStopStreaming}
                className="flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-danger border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors mb-0.5"
                title="Dừng phản hồi"
              >
                <span className="material-symbols-outlined text-[18px]">stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!draft.trim() && attachedFiles.length === 0}
                className={cn(
                  "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center transition-all mb-0.5",
                  (draft.trim() || attachedFiles.length > 0)
                    ? "bg-brand-500 hover:bg-brand-600 text-white shadow-sm active:scale-95 cursor-pointer"
                    : "bg-surface-2 text-text-muted cursor-not-allowed opacity-50"
                )}
                title="Gửi tin nhắn"
              >
                <span className="material-symbols-outlined text-[18px] rotate-[-30px]">send</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Drawer: AI Agent Progress Panel (Khi agentActive/agentState BẬT) */}
      {agentActive && agentState && (
        <div className="w-[420px] border-l border-border bg-surface flex flex-col h-full shrink-0 shadow-lg z-20 transition-all">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[22px] animate-spin">sync</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-brand-600 dark:text-brand-400 truncate">
                  AI Agent - Báo cáo tự động
                </h3>
                <p className="text-[11px] text-text-subtle truncate">
                  Quy trình RAG tự động đa bước
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">
                {agentState.current_step || "DRAFTING"}
              </span>
              <button
                onClick={() => setAgentActive(false)}
                className="size-7 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main flex items-center justify-center transition-colors"
                title="Đóng bảng Agent"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Banner Status */}
          <div className="p-4 border-b border-border/50 bg-amber-500/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>Agent đang thực thi quy trình...</span>
            </div>
            <p className="text-[11px] text-text-subtle leading-relaxed">
              Hệ thống đang chạy ngầm tự động soạn thảo từng chương mục một cách độc lập. Bạn có thể thu nhỏ hoặc xem kết quả trực tiếp tại đây.
            </p>
          </div>

          {/* Sections Progress List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <div className="flex items-center justify-between text-xs font-extrabold text-text-subtle uppercase tracking-wider">
              <span>TIẾN ĐỘ CÁC CHƯƠNG MỤC ({agentState.sections_progress?.length || 0})</span>
              <span>
                {agentState.sections_progress?.filter((s) => s.status === "completed").length || 0}/
                {agentState.sections_progress?.length || 0} Hoàn thành
              </span>
            </div>

            {(agentState.sections_progress || []).map((sec, idx) => {
              const isDone = sec.status === "completed";
              const isDrafting = sec.status === "drafting" || sec.status === "in_progress";

              return (
                <div
                  key={sec.id || idx}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all text-xs space-y-2",
                    isDone
                      ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : isDrafting
                      ? "bg-brand-500/5 border-brand-500/40 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-brand-500/20"
                      : "bg-bg/60 border-border text-text-main"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 font-bold">
                    <span className="leading-snug">{sec.title}</span>
                    <span
                      className={cn(
                        "text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full border shrink-0",
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                          : isDrafting
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-600 animate-pulse"
                          : "bg-surface border-border text-text-subtle"
                      )}
                    >
                      {isDone ? "Hoàn thành" : isDrafting ? "DRAFTING" : "TODO"}
                    </span>
                  </div>

                  {sec.description && (
                    <p className="text-[11px] text-text-subtle leading-relaxed">{sec.description}</p>
                  )}

                  {/* Subsections list */}
                  {Array.isArray(sec.subsections) && sec.subsections.length > 0 && (
                    <div className="pt-1 space-y-1 border-t border-border/40">
                      <div className="text-[10px] font-bold text-text-subtle uppercase">Mục con:</div>
                      {sec.subsections.map((sub, sIdx) => (
                        <div key={sIdx} className="text-[11px] text-text-muted flex items-start gap-1 pl-1">
                          <span className="text-brand-500">•</span>
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drafting progress indicator */}
                  {isDrafting && (
                    <div className="pt-2 flex items-center gap-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                      <span>Agent đang xử lý mục: {sec.title}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        systemPrompt={systemPrompt}
        onSystemPrompt={setSystemPrompt}
        defaultSystemPrompt={defaultSystemPrompt}
        temperature={temperature}
        onTemperature={setTemperature}
        assistantOnlyMode={assistantOnlyMode}
        enabledModelIds={enabledModelIds}
        onToggleModel={(id) => {
          setEnabledModelIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        allModels={allModels}
        username={username}
        isSupabaseConfigured={isSupabaseConfigured}
        isRestrictedUser={isRestrictedUser}
        subjectsOutlines={subjectsOutlines}
        filesOutlines={filesOutlines}
        loadingOutlines={loadingOutlines}
        loadOutlines={loadOutlines}
        subjectsTemplates={subjectsTemplates}
        filesTemplates={filesTemplates}
        loadingTemplates={loadingTemplates}
        loadTemplates={loadTemplates}
      />

      {toast.show && (
        <div className={cn(
          "fixed bottom-4 right-4 z-[90] rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm transition-all duration-300",
          toast.type === "success" 
            ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
            : toast.type === "error"
            ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
            : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
        )}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
            </span>
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
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
  // Remove link URLs
  q = q.replace(/https?:\/\/[^\s]+/g, "");
  // Remove markdown images/links
  q = q.replace(/!\[.*?\]\(.*?\)/g, "");
  q = q.replace(/\[.*?\]\(.*?\)/g, "");
  // Remove special prompt commands or phrases like 'lap de cuong', 'viet bao cao'
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
