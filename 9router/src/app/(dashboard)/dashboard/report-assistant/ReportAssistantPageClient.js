"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import useUserStore from "@/store/userStore";

import { cn } from "@/shared/utils/cn";
import {
  DEFAULT_TEMPERATURE,
  RESTRICTED_REPORT_ASSISTANT_SUBJECTS,
  getSK,
} from "./constants";

import {
  createId,
  safeParse,
  getReportAssistantChatModels,
} from "./utils/helpers";

import {
  ensureKnowledgeCacheSessionOwner,
} from "./utils/knowledgeCache";

import {
  getReportTitleWithDownloadCounter,
} from "./utils/reportFormatter";

import { SettingsModal } from "./components/SettingsModal";
import { SessionSidebar } from "./components/SessionSidebar";
import { ChatPanel } from "./components/ChatPanel";
import { ReportPreviewPanel } from "./components/ReportPreviewPanel";
import { AgentProgressPanel } from "./components/AgentProgressPanel";

import { useChatSession } from "./hooks/useChatSession";
import { useAgentWorkflow } from "./hooks/useAgentWorkflow";
import { useReportAssistantChat } from "./hooks/useReportAssistantChat";
import { useKnowledgeBase } from "./hooks/useKnowledgeBase";

export default function ReportAssistantPageClient({ initialPrompt, initialChatId }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [username, setUsername] = useState("admin");
  const [usernameLoaded, setUsernameLoaded] = useState(false);
  const [isRestrictedUser, setIsRestrictedUser] = useState(false);
  const [allModels, setAllModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const uSK = getSK("admin");
      return (
        localStorage.getItem(uSK.activeModel) ||
        localStorage.getItem("report-assistant.activeModel") ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [apiKey, setApiKey] = useState("");
  const [, setLoadingModels] = useState(true);
  const [fullModelsLoaded, setFullModelsLoaded] = useState(false);
  const [, setLoadError] = useState("");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultSystemPrompt] = useState(initialPrompt);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [assistantOnlyMode, setAssistantOnlyMode] = useState(true);
  const [enabledModelIds, setEnabledModelIds] = useState(new Set());
  const [reportModels, setReportModels] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const showToast = useCallback((message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  }, []);

  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedKnowledgeSubject, setSelectedKnowledgeSubject] = useState("none");
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const uSK = getSK("admin");
      const saved = localStorage.getItem(uSK.webSearchEnabled) ?? localStorage.getItem("report-assistant.webSearchEnabled");
      return saved !== null ? saved === "true" : true;
    } catch { return true; }
  });
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const [streamEnabled, setStreamEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const uSK = getSK("admin");
      const saved = localStorage.getItem(uSK.streamEnabled) ?? localStorage.getItem("report-assistant.streamEnabled");
      return saved !== null ? saved === "true" : true;
    } catch { return true; }
  });
  const [thinkingMode, setThinkingMode] = useState(() => {
    if (typeof window === "undefined") return "auto";
    try {
      const uSK = getSK("admin");
      const saved = localStorage.getItem(uSK.thinkingMode) ?? localStorage.getItem("report-assistant.thinkingMode");
      return saved || "auto";
    } catch { return "auto"; }
  });

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const applyFullModelList = useCallback((models, uName) => {
    if (!Array.isArray(models) || models.length === 0) return;
    const uSK = getSK(uName);
    const rawEnabledModels = localStorage.getItem(uSK.enabledModels);
    const enabledSet = new Set(safeParse(rawEnabledModels, []) || []);
    models.forEach((m) => enabledSet.add(m.id));
    setAllModels(models);
    setEnabledModelIds(enabledSet);

    setSelectedModelId((prev) => {
      if (prev && models.some((m) => m.id === prev)) return prev;
      const saved = localStorage.getItem(uSK.activeModel) || localStorage.getItem("report-assistant.activeModel");
      if (saved && models.some((m) => m.id === saved)) return saved;
      return models[0]?.id || prev;
    });
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
    activeModelId: selectedModelId,
    setActiveModelId: setSelectedModelId,
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

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const activeModel = useMemo(() => {
    const targetModelId = activeSession?.modelId || selectedModelId;
    if (targetModelId) {
      const found = allModels.find((m) => m.id === targetModelId);
      if (found) return found;
      return { id: targetModelId, name: targetModelId.split("/").pop() };
    }
    return allModels[0] || null;
  }, [allModels, activeSession, selectedModelId]);

  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    const uSK = getSK(username);
    try {
      localStorage.setItem(uSK.assistantOnlyMode, String(assistantOnlyMode));
      localStorage.setItem(uSK.webSearchEnabled, String(webSearchEnabled));
      localStorage.setItem(uSK.streamEnabled, String(streamEnabled));
      localStorage.setItem(uSK.thinkingMode, String(thinkingMode));
    } catch (err) {}
  }, [hydrated, usernameLoaded, username, assistantOnlyMode, webSearchEnabled, streamEnabled, thinkingMode]);

  const {
    subjectsOutlines,
    filesOutlines,
    loadingOutlines,
    loadOutlines,
    subjectsTemplates,
    filesTemplates,
    loadingTemplates,
    loadTemplates,
    allSubjects,
    isSupabaseConfigured,
  } = useKnowledgeBase({ username, isRestrictedUser });

  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
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
    setAgentActive,
    agentState,
    agentLoading,
    selectedReport,
    setSelectedReport,
    reportOpenedSource,
    selectedOutline,
    setSelectedOutline,
    openAgentProgressPreview,
    runAgentInit,
    confirmOutlineAndStartDrafting,
    loadAgentStatus,
    cancelAgentWorkflow,
    agentErrorDialog,
    setAgentErrorDialog,
    reloadSection,
  } = useAgentWorkflow({
    activeSessionId,
    setActiveSessionId,
    username,
    sessions,
    setSessions,
    selectedKnowledgeSubject,
    setSelectedKnowledgeSubject,
    reportModels,
    activeModel: activeModel,
    createSession,
    showToast,
    filesOutlines,
    filesTemplates,
    setDraft,
    setAttachedFiles,
    streamEnabled,
    apiKey,
  });

  const {
    isSending,
    streamingId,
    searchStatus,
    handleSendMessage,
    handleStopStreaming,
    handleRegenerateMessage,
  } = useReportAssistantChat({
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
  });

  const activeDoc = selectedReport || selectedOutline;
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const previewPanelRef = useRef(null);

  useEffect(() => {
    if (activeDoc) {
      const timer = setTimeout(() => {
        setIsRenderingPreview(true);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setIsRenderingPreview(false);
    }
  }, [activeDoc]);

  const activeDocType = selectedReport ? "report" : selectedOutline ? "outline" : null;
  let activeDocTitle = activeDoc?.title || activeDoc?.name || "Preview";
  if (activeDocTitle.includes("Báo cáo hoàn chỉnh")) {
    activeDocTitle = getReportTitleWithDownloadCounter();
  }
  const activeDocFileName = `${activeDocTitle.replace(/[\\/:*?"<>|]/g, "_")}.docx`;

  const closeDoc = useCallback(() => {
    setSelectedOutline(null);
    setSelectedReport(null);
    if (reportOpenedSource === "card") {
      setAgentActive(false);
    } else {
      setAgentActive(true);
    }
  }, [setSelectedOutline, setSelectedReport, reportOpenedSource, setAgentActive]);

  useEffect(() => {
    if (activeSessionId && typeof loadAgentStatus === "function") {
      loadAgentStatus(activeSessionId);
    }
  }, [activeSessionId, loadAgentStatus]);

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

        const { error } = await supabase.storage
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

  const handleDeleteSession = useCallback((sessionId, e) => {
    e.stopPropagation();
    
    const nextSessions = sessions.filter((item) => item.id !== sessionId);
    setSessions(nextSessions);
    
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
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        setActiveSessionId={setActiveSessionId}
        onCreateSession={() => {
          const s = createSession(activeModel);
          setSessions((prev) => [s, ...prev]);
          setActiveSessionId(s.id);
        }}
        onDeleteSession={handleDeleteSession}
      />

      <ChatPanel
        activeDoc={activeDoc}
        agentActive={agentActive}
        agentState={agentState}
        activeSession={activeSession}
        activeSessionId={activeSessionId}
        setSessions={setSessions}
        allModels={allModels}
        activeModel={activeModel}
        setSelectedModelId={setSelectedModelId}
        setModelDropdownOpen={setModelDropdownOpen}
        modelDropdownOpen={modelDropdownOpen}
        usernameLoaded={usernameLoaded}
        username={username}
        getSK={getSK}
        setSettingsOpen={setSettingsOpen}
        draft={draft}
        setDraft={setDraft}
        attachedFiles={attachedFiles}
        setAttachedFiles={setAttachedFiles}
        isSending={isSending}
        streamingId={streamingId}
        searchStatus={searchStatus}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
        assistantOnlyMode={assistantOnlyMode}
        setAssistantOnlyMode={setAssistantOnlyMode}
        setAgentActive={setAgentActive}
        streamEnabled={streamEnabled}
        setStreamEnabled={setStreamEnabled}
        thinkingMode={thinkingMode}
        setThinkingMode={setThinkingMode}
        selectedKnowledgeSubject={selectedKnowledgeSubject}
        setSelectedKnowledgeSubject={setSelectedKnowledgeSubject}
        allSubjects={allSubjects}
        removeAttachedFile={removeAttachedFile}
        handleFileChange={handleFileChange}
        triggerFileInput={triggerFileInput}
        fileInputRef={fileInputRef}
        textareaRef={textareaRef}
        handleSendMessage={handleSendMessage}
        handleStopStreaming={handleStopStreaming}
        handleRegenerateMessage={handleRegenerateMessage}
        showToast={showToast}
        copiedMessageId={copiedMessageId}
        setCopiedMessageId={setCopiedMessageId}
        confirmOutlineAndStartDrafting={confirmOutlineAndStartDrafting}
        setSelectedReport={setSelectedReport}
        setSelectedOutline={setSelectedOutline}
        openAgentProgressPreview={openAgentProgressPreview}
        loadAgentStatus={loadAgentStatus}
      />

      {activeDoc ? (
        <ReportPreviewPanel
          previewPanelRef={previewPanelRef}
          activeDocTitle={activeDocTitle}
          activeDocType={activeDocType}
          activeDocFileName={activeDocFileName}
          activeDoc={activeDoc}
          isRenderingPreview={isRenderingPreview}
          showToast={showToast}
          closeDoc={closeDoc}
        />
      ) : (
        agentActive && agentState && (
          <AgentProgressPanel
            agentState={agentState}
            agentLoading={agentLoading}
            cancelAgentWorkflow={cancelAgentWorkflow}
            setAgentActive={setAgentActive}
            confirmOutlineAndStartDrafting={confirmOutlineAndStartDrafting}
            openAgentProgressPreview={openAgentProgressPreview}
            showToast={showToast}
          />
        )
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        systemPrompt={systemPrompt}
        onSystemPrompt={setSystemPrompt}
        defaultSystemPrompt={defaultSystemPrompt}
        showToast={showToast}
        activeModel={activeModel}
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

      {agentErrorDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[16px] border border-red-500/25 bg-surface shadow-lg overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-border/60 flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] text-red-500 shrink-0">
                error
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-text-main text-slate-900 dark:text-slate-100">
                  {agentErrorDialog.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted text-slate-500 dark:text-slate-400">
                  {agentErrorDialog.message}
                </p>
              </div>
            </div>
            {agentErrorDialog.detail && (
              <div className="mx-5 mt-4 max-h-32 overflow-y-auto custom-scrollbar rounded-[10px] border border-border/60 bg-bg/70 px-3 py-2 text-[11px] leading-relaxed text-text-subtle whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800">
                {agentErrorDialog.detail}
              </div>
            )}
            <div className="px-5 py-4 flex justify-end gap-2">
              {agentErrorDialog.sectionId && (
                <button
                  onClick={() => {
                    const secId = agentErrorDialog.sectionId;
                    const cId = agentErrorDialog.chatId;
                    setAgentErrorDialog(null);
                    reloadSection(secId, cId);
                  }}
                  className="px-4 py-2 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Soạn lại mục này
                </button>
              )}
              <button
                onClick={() => setAgentErrorDialog(null)}
                className="px-4 py-2 rounded-[10px] bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

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
