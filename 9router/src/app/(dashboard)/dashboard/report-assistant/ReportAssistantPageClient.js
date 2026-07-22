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
  const [copiedMessageId, setCopiedMessageId] = useState(null);

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

  const handleStopStreaming = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    // Gửi lệnh stop tới Qwen web nếu có activeSessionId
    if (activeSessionId) {
      try {
        await fetch(`https://chat.qwen.ai/api/v2/chat/completions/stop?chat_id=${activeSessionId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ chat_id: activeSessionId }),
        }).catch(() => {});
      } catch (e) {
        // Ignore cross-origin / network error if direct call fails
      }
    }
    setIsSending(false);
    setStreamingId("");
    setSearchStatus("");
  }, [activeSessionId, apiKey]);

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
  }, [hydrated, fetchUser, loadFullModels]);

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

    try {
      let webSearchContext = "";
      const urls = userText.match(/(https?:\/\/[^\s]+)/g);
      if (webSearchEnabled && urls && urls.length > 0) {
        setSearchStatus("Đang đọc nội dung liên kết qua Jina Reader...");
        showToast("Jina Reader đang đọc nội dung liên kết...", "info");
        for (const u of urls) {
          try {
            const res = await fetch("/api/report-assistant/web-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: u }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.content) {
                webSearchContext += `\n\n--- NỘI DUNG TÀI LIỆU CHI TIẾT TỪ LIÊN KẾT [${u}] ---\n${data.content.slice(0, 15000)}\n------------------------------------------------`;
              }
            }
          } catch (e) {
            console.error("Error fetching Jina Reader content", e);
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
            `Đang tìm kiếm thông tin mới nhất trên Google qua Tavily AI cho từ khoá "${searchQuery}"...`
          );
          showToast("Tavily AI đang tìm kiếm thông tin mới nhất...", "info");
          try {
            const res = await fetch("/api/report-assistant/web-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: searchQuery }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.results) {
                showToast("Tavily AI đã tìm kiếm thông tin thành công!", "success");
                let searchContent = `\n\n--- DỮ LIỆU TÌM KIẾM MỚI NHẤT TỪ TAVILY AI ---`;
                if (data.results.answer) {
                  searchContent += `\n**Tóm tắt câu trả lời:** ${data.results.answer}`;
                }
                searchContent += `\n\n**Các nguồn tin cậy tìm thấy:**`;
                for (const r of data.results.results || []) {
                  searchContent += `\n\n- **[${r.title}](${r.url})**\n  *Nội dung trích dẫn:* ${r.content}`;
                }
                searchContent += `\n--------------------------------------------`;
                webSearchContext += searchContent;
              }
            }
          } catch (e) {
            console.error("Error fetching Tavily Search content", e);
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

      const asstMsgId = createId();
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
          stream: true,
          temperature,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || errJson.message || `Lỗi server (${response.status})`;
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Trình duyệt không hỗ trợ đọc stream response.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";

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

      // Mark message complete
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
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
            <button
              type="button"
              onClick={() => setWebSearchEnabled((prev) => !prev)}
              className={cn(
                "size-8 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer shrink-0 mb-0.5",
                webSearchEnabled
                  ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20"
                  : "text-text-muted hover:text-text-main hover:bg-surface-2"
              )}
              title={
                webSearchEnabled
                  ? "Tắt Tìm kiếm Web (đang Bật)"
                  : "Bật Tìm kiếm Web (Tavily AI)"
              }
            >
              <span className="material-symbols-outlined text-[18px]">
                language
              </span>
            </button>

            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isSending || !activeModel}
              className="size-8 rounded-[8px] flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-2 cursor-pointer disabled:opacity-50 shrink-0 mb-0.5"
              title="Tải lên tài liệu (.pdf, .txt, .docx, hình ảnh...)"
            >
              <span className="material-symbols-outlined text-[18px]">
                attach_file
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAssistantOnlyMode((prev) => !prev)}
              className={cn(
                "size-8 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer shrink-0 mb-0.5",
                !assistantOnlyMode
                  ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20"
                  : "text-text-muted hover:text-text-main hover:bg-surface-2"
              )}
              title={
                !assistantOnlyMode
                  ? "Tắt Chế độ AI Agent (đang Bật)"
                  : "Bật Chế độ AI Agent (Planning & execution)"
              }
            >
              <span className="material-symbols-outlined text-[18px]">
                support_agent
              </span>
            </button>

            {/* Custom Subject Selector */}
            {allSubjects.length > 0 && (
              <div className="relative mb-0.5">
                <button
                  type="button"
                  onClick={() => setSubjectDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] border border-border bg-surface hover:bg-surface-2 transition-all text-xs font-semibold text-text-main cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-brand-500">
                    menu_book
                  </span>
                  <span className="max-w-[130px] truncate">
                    {selectedKnowledgeSubject === "none"
                      ? "Chủ đề báo cáo"
                      : selectedKnowledgeSubject}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-text-subtle">
                    expand_more
                  </span>
                </button>

                {subjectDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSubjectDropdownOpen(false)} />
                    <div className="absolute left-0 bottom-full mb-1.5 z-40 w-56 bg-surface border border-border rounded-xl shadow-lg overflow-hidden py-1">
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <button
                          onClick={() => {
                            setSelectedKnowledgeSubject("none");
                            if (activeSessionId) {
                              setSessions((prev) =>
                                prev.map((s) =>
                                  s.id === activeSessionId
                                    ? {
                                        ...s,
                                        subject: "none",
                                        updatedAt: new Date().toISOString(),
                                      }
                                    : s
                                )
                              );
                            }
                            setSubjectDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                            selectedKnowledgeSubject === "none"
                              ? "bg-brand-500/10 text-brand-600 font-semibold"
                              : "text-text-main hover:bg-surface-2"
                          )}
                        >
                          <span className="material-symbols-outlined text-[15px] text-text-subtle">
                            layers_clear
                          </span>
                          <span>-- Chủ đề báo cáo --</span>
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
                                        ? {
                                            ...sItem,
                                            subject: s,
                                            updatedAt: new Date().toISOString(),
                                          }
                                        : sItem
                                    )
                                  );
                                }
                                setSubjectDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                                active
                                  ? "bg-brand-500/10 text-brand-600 font-semibold"
                                  : "text-text-main hover:bg-surface-2"
                              )}
                            >
                              <span className="material-symbols-outlined text-[15px] text-brand-500">
                                library_books
                              </span>
                              <span className="truncate">{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

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
