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
} from "./constants";

import {
  createId,
  safeParse,
  getSK,
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
    return allModels.find((m) => m.id === activeSession?.modelId) || allModels[0] || null;
  }, [allModels, activeSession]);

  const handleSendMessage = useCallback(async () => {
    if (!activeSessionId || isSending) return;
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
      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: activeModel?.id,
          messages: [
            { role: "system", content: systemPrompt || defaultSystemPrompt },
            { role: "user", content: await buildContentWithAttachments(userText, filePayloads) },
          ],
          temperature,
        }),
      });

      const resData = await response.json();
      const content = resData?.choices?.[0]?.message?.content || "";

      const assistMsg = {
        id: createId(),
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [...(s.messages || []), assistMsg],
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (err) {
      console.error(err);
      showToast("Lỗi gửi tin nhắn: " + err.message, "error");
    } finally {
      setIsSending(false);
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
  ]);

  if (!hydrated) return null;

  return (
    <div className="flex h-screen bg-bg text-text-main overflow-hidden font-sans">
      {/* Sidebar - Sessions List */}
      <div className="w-80 border-r border-border bg-surface flex flex-col h-full flex-shrink-0">
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSessions((prev) => prev.filter((item) => item.id !== s.id));
                }}
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
            <Badge variant="default" size="sm">
              {activeModel?.id?.split("/").pop()}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            Cấu hình
          </Button>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeSession?.messages?.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-4 max-w-3xl",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              {msg.role === "user" ? <UserAvatar /> : <AssistantAvatar />}
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
            </div>
          ))}
          {isSending && (
            <div className="flex gap-4 max-w-3xl mr-auto">
              <AssistantAvatar />
              <TypingDots />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-surface">
          <div className="flex items-center gap-3 bg-bg border border-border rounded-2xl px-4 py-2">
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-transparent border-0 outline-none text-sm resize-none text-text-main placeholder:text-text-subtle"
            />
            <Button size="sm" onClick={handleSendMessage} disabled={isSending || !draft.trim()}>
              Gửi
            </Button>
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
    </div>
  );
}
