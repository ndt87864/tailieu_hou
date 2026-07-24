"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { renderMarkdownAndMath } from "../utils/markdownRenderer";
import { isReportAssistantLunaModel } from "../utils/helpers";
import {
  AssistantAvatar,
  UserAvatar,
  TypingDots,
  MessageFilesGrid,
} from "./ChatBubble";
import { ChatInputBar } from "./ChatInputBar";

export function ChatPanel({
  activeDoc,
  agentActive,
  agentState,
  activeSession,
  activeSessionId,
  setSessions,
  allModels,
  activeModel,
  setSelectedModelId,
  setModelDropdownOpen,
  modelDropdownOpen,
  usernameLoaded,
  username,
  getSK,
  setSettingsOpen,
  draft,
  setDraft,
  attachedFiles,
  setAttachedFiles,
  isSending,
  streamingId,
  searchStatus,
  webSearchEnabled,
  setWebSearchEnabled,
  assistantOnlyMode,
  setAssistantOnlyMode,
  setAgentActive,
  streamEnabled,
  setStreamEnabled,
  thinkingMode,
  setThinkingMode,
  onlyCurrentProvider = true,
  onToggleOnlyCurrentProvider,
  hasActiveLuna = false,
  selectedKnowledgeSubject,
  setSelectedKnowledgeSubject,
  allSubjects,
  removeAttachedFile,
  handleFileChange,
  triggerFileInput,
  fileInputRef,
  textareaRef,
  handleSendMessage,
  handleStopStreaming,
  handleRegenerateMessage,
  showToast,
  copiedMessageId,
  setCopiedMessageId,
  confirmOutlineAndStartDrafting,
  setSelectedReport,
  setSelectedOutline,
  openAgentProgressPreview,
  loadAgentStatus,
}) {
  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [draft, textareaRef]);

  const isLunaModel = isReportAssistantLunaModel(activeModel?.id);

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 min-h-0 h-full bg-bg relative transition-all duration-300",
        activeDoc || (agentActive && agentState)
          ? "hidden md:flex md:w-[40%] xl:w-[40%] border-r border-border shrink-0"
          : "flex-1"
      )}
    >
      {/* Top Header */}
      <div className="h-11 border-b border-border px-4 flex items-center justify-between bg-surface flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xs font-bold text-text-main">Trợ lý học tập</h1>
          {/* Custom Model Selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-bg hover:bg-surface-2 transition-all text-[11px] font-semibold text-text-main cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px] text-brand-500">
                smart_toy
              </span>
              <span>{activeModel?.id?.split("/").pop() || "Chọn mô hình"}</span>
              <span className="material-symbols-outlined text-[14px] text-text-subtle">
                expand_more
              </span>
            </button>

            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)} />
                <div className="absolute left-0 mt-1 z-40 w-60 bg-surface border border-border rounded-xl shadow-lg overflow-hidden py-1">
                  {hasActiveLuna && (
                    <div className="px-3 py-1.5 border-b border-border bg-surface-2/40 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-text-subtle truncate" title="Chỉ sử dụng provider hiện tại khi tạo báo cáo">
                        Chỉ dùng provider Luna
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={onlyCurrentProvider}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleOnlyCurrentProvider?.(!onlyCurrentProvider);
                        }}
                        className={cn(
                          "relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          onlyCurrentProvider ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            onlyCurrentProvider ? "translate-x-2.5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto custom-scrollbar">
                    {allModels.map((m) => {
                      const active = m.id === activeModel?.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModelId(m.id);
                            if (usernameLoaded) {
                              const uSK = getSK(username);
                              try {
                                localStorage.setItem(uSK.activeModel, m.id);
                              } catch { }
                            }
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
                            "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors",
                            active
                              ? "bg-brand-500/10 text-brand-600 font-semibold"
                              : "text-text-main hover:bg-surface-2"
                          )}
                        >
                          <span className="material-symbols-outlined text-[14px] text-brand-500">
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
        <Button size="xs" variant="outline" onClick={() => setSettingsOpen(true)} className="px-2.5 py-1 text-[11px] rounded-lg">
          Cấu hình
        </Button>
      </div>

      {/* Message Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col">
        {!activeSession?.messages || activeSession.messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto my-auto space-y-3 select-none">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-1">
              <span className="material-symbols-outlined text-[28px]">
                auto_awesome
              </span>
            </div>
            <h3 className="text-base font-bold text-text-main">Trợ lý Soạn thảo Báo cáo Học tập</h3>
            <p className="text-[11px] text-text-subtle leading-relaxed">
              Chào mừng bạn! Tôi có thể giúp bạn tạo báo cáo, soạn thảo đề cương học tập, và phân tích tài liệu một cách thông minh. Hãy bắt đầu bằng cách nhập một tin nhắn hoặc chọn một gợi ý bên dưới.
            </p>
            <div className="grid grid-cols-2 gap-2.5 w-full pt-2">
              <button
                onClick={() => setDraft("Lập đề cương báo cáo chi tiết về đề tài chuyển đổi số trong giáo dục đại học.")}
                className="p-2.5 text-left border border-border rounded-lg bg-surface hover:bg-surface-2 transition-all hover:border-brand-500/30 text-xs cursor-pointer group"
              >
                <div className="font-semibold text-text-main flex items-center gap-1 mb-0.5 text-[11px]">
                  <span className="material-symbols-outlined text-[13px] text-brand-500">edit_note</span>
                  Lập đề cương báo cáo
                </div>
                <div className="text-[9px] text-text-subtle truncate">Chuyển đổi số giáo dục...</div>
              </button>
              <button
                onClick={() => setDraft("Viết một báo cáo phân tích về tiềm năng ứng dụng AI trong học tập.")}
                className="p-2.5 text-left border border-border rounded-lg bg-surface hover:bg-surface-2 transition-all hover:border-brand-500/30 text-xs cursor-pointer group"
              >
                <div className="font-semibold text-text-main flex items-center gap-1 mb-0.5 text-[11px]">
                  <span className="material-symbols-outlined text-[13px] text-brand-500">school</span>
                  AI trong học tập
                </div>
                <div className="text-[9px] text-text-subtle truncate">Phân tích ứng dụng AI...</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const rawMsgs = activeSession?.messages || [];
              const currentRunId = agentState?.session_id || agentState?.run_id || agentState?.sections_progress?.[0]?.reportContext?.runId || "";

              const seenReportCardKeys = new Set();
              const cleanedRawMsgs = rawMsgs.filter((m) => {
                if (m.isReportCard || m.content === "Báo cáo hoàn chỉnh") {
                  const key = m.sessionId ? `session_${m.sessionId}` : "legacy_report_card";
                  if (seenReportCardKeys.has(key)) return false;
                  seenReportCardKeys.add(key);
                }
                return true;
              });

              const hasReportCardForCurrentRun = currentRunId
                ? cleanedRawMsgs.some((m) => (m.isReportCard || m.content === "Báo cáo hoàn chỉnh") && (m.sessionId === currentRunId || m.id.includes(currentRunId)))
                : cleanedRawMsgs.some((m) => m.isReportCard || m.content === "Báo cáo hoàn chỉnh");

              const finalMsgs = [...cleanedRawMsgs];
              if (agentState?.current_step === "COMPLETED" && !hasReportCardForCurrentRun) {
                finalMsgs.push({
                  id: `virtual-completed-report-card-${currentRunId || "v1"}`,
                  role: "assistant",
                  isReportCard: true,
                  sessionId: currentRunId || "v1",
                  content: "Báo cáo hoàn chỉnh",
                  createdAt: new Date().toISOString(),
                });
              }
              return finalMsgs.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-3xl group relative",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {msg.role === "user" ? <UserAvatar /> : <AssistantAvatar />}
                  <div className="relative">
                    {msg.isOutlineCard ? (
                      <div className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-surface border border-border/80 rounded-xl shadow-2xs hover:shadow transition-all min-w-[280px]">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                            {msg.outlineStatus === "generating" && agentState?.current_step === "OUTLINING" ? (
                              <span className="material-symbols-outlined text-[18px] animate-spin text-amber-500">sync</span>
                            ) : msg.outlineStatus === "error" ? (
                              <span className="material-symbols-outlined text-[18px] text-rose-500">error</span>
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-main leading-tight">
                              Dàn ý báo cáo
                            </div>
                            <div className="text-[9px] text-text-subtle mt-0.5">
                              {msg.outlineStatus === "generating" && agentState?.current_step === "OUTLINING" ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">Đang lập dàn ý...</span>
                              ) : msg.outlineStatus === "error" ? (
                                <span className="text-rose-500 font-medium">{msg.errorText || "Tạo dàn ý thất bại"}</span>
                              ) : (
                                msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(msg.outlineStatus === "ready" || !msg.outlineStatus) && agentState?.current_step === "WAIT_APPROVAL" && (
                            <button
                              onClick={() => confirmOutlineAndStartDrafting()}
                              className="px-2.5 py-1 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs active:scale-95"
                            >
                              Xác nhận dàn ý
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedReport(null);
                              setSelectedOutline(null);
                              setAgentActive(true);
                              if (activeSessionId) {
                                loadAgentStatus(activeSessionId, true);
                              }
                            }}
                            className="px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/20 transition-all cursor-pointer shadow-2xs"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ) : msg.isReportCard ? (
                      <div className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-surface border border-brand-500/30 rounded-xl shadow-2xs hover:shadow transition-all min-w-[280px]">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold shrink-0">
                            <span className="material-symbols-outlined text-[18px]">description</span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-main leading-tight">
                              Báo cáo hoàn chỉnh
                            </div>
                            <div className="text-[9px] text-text-subtle mt-0.5">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedOutline(null);
                            openAgentProgressPreview(agentState, "Báo cáo hoàn chỉnh", "card");
                          }}
                          className="px-3 py-1 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          <span>Xem báo cáo</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "px-3.5 py-2.5 rounded-xl border text-xs leading-relaxed",
                          msg.role === "user"
                            ? "bg-brand-500 border-brand-500 text-white"
                            : "bg-surface border-border text-text-main"
                        )}
                      >
                        {msg.role === "assistant" && !msg.content && msg.status === "streaming" ? (
                          <div className="flex items-center gap-2 text-text-subtle py-0.5">
                            <span className="material-symbols-outlined text-[15px] animate-spin text-brand-500">progress_activity</span>
                            <span className="text-[11px] font-medium italic">Đang suy nghĩ & tạo phản hồi...</span>
                          </div>
                        ) : (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownAndMath(msg.content || ""),
                            }}
                          />
                        )}
                        <MessageFilesGrid files={msg.files || []} />
                      </div>
                    )}

                    {/* Hover actions */}
                    {!msg.isOutlineCard && !msg.isReportCard && (
                      <div
                        className={cn(
                          "absolute opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-surface border border-border shadow-2xs rounded-md p-0.5 z-10 top-full mt-1",
                          msg.role === "user" ? "right-1" : "left-1"
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
                            "p-0.5 rounded cursor-pointer flex items-center justify-center transition-colors",
                            copiedMessageId === msg.id
                              ? "text-green-500 bg-green-500/10"
                              : "text-text-subtle hover:text-text-main hover:bg-surface-2"
                          )}
                          title={copiedMessageId === msg.id ? "Đã sao chép" : "Sao chép"}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedMessageId === msg.id ? "done" : "content_copy"}
                          </span>
                        </button>
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => handleRegenerateMessage(msg.id)}
                            disabled={isSending}
                            className="p-0.5 rounded text-text-subtle hover:text-text-main hover:bg-surface-2 cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tạo lại câu trả lời"
                          >
                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                          </button>
                        )}
                        {msg.role === "user" && (
                          <button
                            onClick={() => {
                              setDraft(msg.content);
                              textareaRef.current?.focus();
                            }}
                            className="p-0.5 rounded text-text-subtle hover:text-text-main hover:bg-surface-2 cursor-pointer flex items-center justify-center"
                            title="Sửa tin nhắn"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {isSending && (!activeSession?.messages?.some(m => m.id === streamingId && m.content.trim())) && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <AssistantAvatar />
            <TypingDots />
          </div>
        )}

        {/* Live streaming indicator for AI Agent drafting report sections */}
        {agentActive && agentState && agentState.current_step !== "COMPLETED" && agentState.current_step !== "CANCELLED" && agentState.current_step !== "WAIT_APPROVAL" && (() => {
          const currentDraftingSection = (agentState.sections_progress || []).find((s) => s.status === "drafting" || s.status === "stream_drafting");
          if (!currentDraftingSection) return null;

          return (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <AssistantAvatar />
              <div className="p-3 rounded-xl border text-xs leading-relaxed bg-surface border-brand-500/30 text-text-main shadow-2xs flex-1">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/60">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-brand-600 dark:text-brand-400">
                    <span className="material-symbols-outlined text-[15px] animate-spin text-brand-500">sync</span>
                    <span>Đang soạn thảo: {currentDraftingSection.title}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 font-semibold animate-pulse">
                    Stream Realtime
                  </span>
                </div>
                {currentDraftingSection.content ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownAndMath(currentDraftingSection.content),
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-text-subtle py-0.5">
                    <span className="material-symbols-outlined text-[15px] animate-spin text-brand-500">progress_activity</span>
                    <span className="text-[11px] font-medium italic">Đang suy nghĩ & thu thập nội dung cho mục này...</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Input Bar Subcomponent */}
      <ChatInputBar
        searchStatus={searchStatus}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
        assistantOnlyMode={assistantOnlyMode}
        setAssistantOnlyMode={setAssistantOnlyMode}
        agentState={agentState}
        setAgentActive={setAgentActive}
        isLunaModel={isLunaModel}
        streamEnabled={streamEnabled}
        setStreamEnabled={setStreamEnabled}
        thinkingMode={thinkingMode}
        setThinkingMode={setThinkingMode}
        activeModel={activeModel}
        selectedKnowledgeSubject={selectedKnowledgeSubject}
        setSelectedKnowledgeSubject={setSelectedKnowledgeSubject}
        allSubjects={allSubjects}
        attachedFiles={attachedFiles}
        removeAttachedFile={removeAttachedFile}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        triggerFileInput={triggerFileInput}
        textareaRef={textareaRef}
        draft={draft}
        setDraft={setDraft}
        handleSendMessage={handleSendMessage}
        isSending={isSending}
        handleStopStreaming={handleStopStreaming}
        setSessions={setSessions}
        activeSessionId={activeSessionId}
      />
    </div>
  );
}
